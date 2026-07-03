import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession, isAuthProviderConfigured } from "~/server/auth";
import { PorfiloWordmark } from "~/app/_components/porfilo-logo";
import { AuroraBackground } from "~/app/_components/aurora-background";
import { SignInForm } from "./form";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  // Returning users with a valid Porfilo session skip auth and continue.
  const session = await getSession(await headers());
  if (session?.user) redirect("/dashboard");

  const providers = isAuthProviderConfigured();

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-bg text-fg antialiased [font-feature-settings:'ss01','cv11']">
      <AuroraBackground variant="ghost" />

      {/* Nav */}
      <nav className="relative z-10 mx-auto flex w-full max-w-6xl flex-none items-center justify-between px-6 py-6">
        <Link href="/" className="transition hover:opacity-90">
          <PorfiloWordmark />
        </Link>
        <Link href="/" className="text-sm text-muted transition hover:text-fg">
          ← Home
        </Link>
      </nav>

      {/* Centered card */}
      <section className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 pb-16">
        <h1 className="text-balance text-center text-3xl font-medium tracking-tight sm:text-4xl">
          Sign in to Porfilo
        </h1>
        <p className="mt-3 text-center text-[14px] text-muted">
          Create an account or sign back in. No passwords.
        </p>

        <SignInForm providers={providers} />

        <p className="mt-8 max-w-xs text-center text-[11.5px] leading-relaxed text-faint">
          By continuing you agree to our{" "}
          <Link href="/terms" className="text-muted-2 underline decoration-white/15 underline-offset-2 transition hover:text-fg">
            terms
          </Link>
          . Sessions last 30 days.
        </p>
      </section>
    </main>
  );
}
