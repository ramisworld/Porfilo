import "server-only";
import { randomBytes } from "node:crypto";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { Resend } from "resend";
import { env } from "~/env";
import { db } from "~/server/db";
import { limit } from "~/server/ratelimit";

/**
 * BetterAuth — single source of truth for sessions.
 *
 *  - Sessions are server-side rows (`Session` table) + an httpOnly cookie.
 *  - Cookie domain is `.${NEXT_PUBLIC_ROOT_DOMAIN}` so the session survives the
 *    cross-subdomain navigation to `<slug>.porthub.dev`.
 *  - Providers: email magic link (Resend), Google, GitHub. Missing credentials
 *    are tolerated so the app still boots — the corresponding provider is
 *    simply hidden from the sign-in UI via `isAuthProviderConfigured()`.
 */

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

const baseURL = env.BETTER_AUTH_URL ?? "http://localhost:3000";

const authSecret = (() => {
  if (env.BETTER_AUTH_SECRET) return env.BETTER_AUTH_SECRET;
  if (env.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET is required in production.");
  }
  console.warn(
    "[auth] BETTER_AUTH_SECRET is missing; using an ephemeral development secret.",
  );
  return randomBytes(32).toString("base64url");
})();

// Build a cookie domain like `.porthub.dev` so subdomains share the session.
// In dev with `localhost:3000`, leave it undefined (browsers don't allow
// dotted-localhost cookie domains).
const rawRoot = env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
const cookieDomain =
  rawRoot.includes("localhost") || rawRoot.startsWith("127.")
    ? undefined
    : `.${rawRoot.replace(/:\d+$/, "")}`;

async function sendMagicLinkEmail(email: string, url: string) {
  if (!resend || !env.EMAIL_FROM) {
    // Dev fallback: log the link so you can click it from the terminal.
    console.log(`\n[auth] magic link for ${email}:\n  ${url}\n`);
    return;
  }
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: "Your PortHub sign-in link",
    html: magicLinkEmailHtml(url),
    text: `Sign in to PortHub:\n\n${url}\n\nThis link expires in 10 minutes.`,
  });
}

function magicLinkEmailHtml(url: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#06060a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e8e8ef">
  <div style="max-width:480px;margin:0 auto;padding:48px 24px">
    <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.55);margin-bottom:32px">PortHub</div>
    <h1 style="font-size:24px;font-weight:500;letter-spacing:-.01em;margin:0 0 12px">Sign in to PortHub</h1>
    <p style="color:rgba(255,255,255,.6);line-height:1.5;margin:0 0 32px">Click the button below to sign in. This link expires in 10 minutes and can only be used once.</p>
    <a href="${url}" style="display:inline-block;background:#fff;color:#000;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:500;font-size:14px">Sign in →</a>
    <p style="color:rgba(255,255,255,.35);font-size:12px;line-height:1.5;margin:32px 0 0">If you didn't request this, you can safely ignore it.</p>
  </div>
</body></html>`;
}

export const auth = betterAuth({
  baseURL,
  secret: authSecret,
  database: prismaAdapter(db, { provider: "postgresql" }),

  // No passwords — magic link only for the email path.
  emailAndPassword: { enabled: false },

  account: {
    accountLinking: {
      enabled: true,
      disableImplicitLinking: false,
      trustedProviders: ["google", "github"],
      allowDifferentEmails: false,
      updateUserInfoOnLink: true,
    },
  },

  socialProviders: {
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
  },

  plugins: [
    magicLink({
      expiresIn: 60 * 10, // 10 minutes
      sendMagicLink: async ({ email, url }, ctx) => {
        // Cap to 5 sends per email / hour to prevent inbox spam + Resend abuse.
        const rl = limit(`magic:${email.toLowerCase()}`, {
          window: "1h",
          max: 5,
        });
        if (!rl.ok) {
          throw new Error(
            "Too many sign-in emails. Try again in a few minutes.",
          );
        }
        const headers = ctx?.request?.headers ?? ctx?.headers;
        const ip =
          headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          headers?.get("x-real-ip")?.trim() ??
          "local";
        const ipLimit = limit(`magic:ip:${ip}`, { window: "1h", max: 10 });
        if (!ipLimit.ok) {
          throw new Error(
            "Too many sign-in emails from this network. Try again later.",
          );
        }
        await sendMagicLinkEmail(email, url);
      },
    }),
    // Must be last — bridges BetterAuth cookies to Next.js server actions.
    nextCookies(),
  ],

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh sliding window daily
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },

  advanced: {
    cookies: {
      sessionToken: {
        attributes: cookieDomain
          ? { domain: cookieDomain, sameSite: "lax", secure: true }
          : { sameSite: "lax" },
      },
    },
  },

  trustedOrigins: [baseURL],
});

export type Session = typeof auth.$Infer.Session;

/** Server-only helper for RSC / route handlers / tRPC context. */
export async function getSession(headers: Headers) {
  return auth.api.getSession({ headers });
}

/** UI helper: which providers should the sign-in page render? */
export function isAuthProviderConfigured() {
  return {
    google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
    email: true,
  };
}
