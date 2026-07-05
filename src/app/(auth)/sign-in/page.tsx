import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession, isAuthProviderConfigured } from "~/server/auth";
import { rootDomainHost } from "~/lib/root-domain";
import { PorfiloWordmark } from "~/app/_components/porfilo-logo";
import { AuroraBackground } from "~/app/_components/aurora-background";
import { SignInForm } from "./form";

export const dynamic = "force-dynamic";

/** Detect the post-generation claim flow and pull the portfolio slug for display. */
function parseClaim(next: string | undefined): { slug: string | null } | null {
  if (!next) return null;
  let decoded = next;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    /* fall back to the raw value */
  }
  if (!decoded.startsWith("/claim")) return null;
  const q = decoded.indexOf("?");
  const slug =
    q >= 0 ? new URLSearchParams(decoded.slice(q + 1)).get("slug") : null;
  return { slug };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // Returning users with a valid Porfilo session skip auth and continue.
  const session = await getSession(await headers());
  if (session?.user) redirect("/dashboard");

  const { next } = await searchParams;
  const providers = isAuthProviderConfigured();
  const claim = parseClaim(next);
  const liveUrl = claim?.slug ? `${claim.slug}.${rootDomainHost()}` : null;

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-bg text-fg antialiased [font-feature-settings:'ss01','cv11']">
      <AuroraBackground variant="ghost" />

      {/* Brand only — no home button on the auth page. */}
      <nav className="relative z-10 mx-auto flex w-full max-w-6xl flex-none items-center justify-center px-6 py-7 sm:justify-start">
        <Link
          href="/"
          aria-label="Porfilo home"
          className="transition hover:opacity-90"
        >
          <PorfiloWordmark />
        </Link>
      </nav>

      {/* Centered card */}
      <section className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 pb-16">
        {claim ? (
          <>
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-success/25 bg-success/[0.06] px-3 py-1 text-[11px] font-medium tracking-wide text-success/90">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              Portfolio ready
            </span>
            <h1 className="text-balance text-center text-3xl font-medium tracking-tight sm:text-4xl">
              Claim your free portfolio
            </h1>
            <p className="mt-3 max-w-sm text-balance text-center text-[14px] leading-relaxed text-muted">
              Create an account to make it yours — edit the facts, go public, and
              connect your own domain. No passwords.
            </p>
            {liveUrl && (
              <p className="mt-4 inline-flex max-w-full items-center gap-2 rounded-lg border border-border-faint bg-well px-3 py-1.5 font-mono text-[12px] text-muted-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success shadow-[0_0_8px_#34d399]" />
                <span className="truncate">{liveUrl}</span>
              </p>
            )}
          </>
        ) : (
          <>
            <h1 className="text-balance text-center text-3xl font-medium tracking-tight sm:text-4xl">
              Welcome to Porfilo
            </h1>
            <p className="mt-3 text-center text-[14px] text-muted">
              Sign in or create your account. No passwords.
            </p>
          </>
        )}

        <SignInForm providers={providers} />

        <p className="mt-8 max-w-xs text-center text-[11.5px] leading-relaxed text-faint">
          By continuing you agree to our{" "}
          <Link
            href="/terms"
            className="text-muted-2 underline decoration-white/15 underline-offset-2 transition hover:text-fg"
          >
            terms
          </Link>
          . Sessions last 30 days.
        </p>
      </section>
    </main>
  );
}
