import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession, isAuthProviderConfigured } from "~/server/auth";
import { rootDomainHost } from "~/lib/root-domain";
import { AuthShell } from "../auth-shell";
import { SignInForm } from "./form";
import styles from "../auth.module.css";

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
    <AuthShell label={claim ? "Claim portfolio" : "Account access"}>
      <div className={styles.accessInner}>
        {claim ? (
          <>
            <span className={styles.kicker}>Portfolio ready / claim it</span>
            <h1>Make the work yours.</h1>
            <p className={styles.lede}>
              Create an account to make it yours — edit the facts, go public, and
              connect your own domain. No passwords.
            </p>
            {liveUrl && (
              <p className={styles.readyUrl}>
                <i />
                <span>{liveUrl}</span>
              </p>
            )}
          </>
        ) : (
          <>
            <span className={styles.kicker}>Account access / passwordless</span>
            <h1>Return to your proof room.</h1>
            <p className={styles.lede}>Sign in or create your account. No passwords.</p>
          </>
        )}

        <SignInForm providers={providers} />

        <p className={styles.terms}>
          By continuing you agree to our{" "}
          <Link href="/terms">terms</Link>
          . Sessions last 30 days.
        </p>
      </div>
    </AuthShell>
  );
}
