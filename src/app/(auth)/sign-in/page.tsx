import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession, isAuthProviderConfigured } from "~/server/auth";
import { PorfiloWordmark } from "~/app/_components/porfilo-logo";
import { SignInForm } from "./form";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  // Returning users with a valid Porfilo session skip auth and continue.
  const session = await getSession(await headers());
  if (session?.user) redirect("/generate");

  const providers = isAuthProviderConfigured();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06060a] text-white antialiased [font-feature-settings:'ss01','cv11']">
      <BackgroundDecor />

      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="transition hover:opacity-90">
          <PorfiloWordmark />
        </Link>
        <Link href="/" className="text-sm text-white/50 transition hover:text-white">
          ← Home
        </Link>
      </nav>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-88px)] max-w-md flex-col items-center justify-center px-6 pb-24">
        <h1 className="text-center text-3xl font-medium tracking-tight sm:text-4xl">
          Sign in to Porfilo
        </h1>
        <p className="mt-3 text-center text-[15px] text-white/55">
          Create an account or sign back in. No passwords.
        </p>

        <SignInForm providers={providers} />

        <p className="mt-8 max-w-sm text-center text-[11.5px] leading-relaxed text-white/30">
          By continuing you agree to our terms. Sessions last 30 days.
        </p>
      </section>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/70 to-transparent"
      />
    </main>
  );
}

function BackgroundDecor() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 20%, rgba(108,123,255,0.18), transparent 70%),radial-gradient(50% 40% at 80% 80%, rgba(154,108,255,0.14), transparent 70%),radial-gradient(40% 30% at 20% 85%, rgba(64,128,255,0.12), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
    </>
  );
}
