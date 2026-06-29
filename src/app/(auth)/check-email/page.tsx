import Link from "next/link";
import { Suspense } from "react";
import { PorfiloWordmark } from "~/app/_components/porfilo-logo";
import { CheckEmailInner } from "./inner";

export const dynamic = "force-dynamic";

export default function CheckEmailPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06060a] text-white antialiased [font-feature-settings:'ss01','cv11']">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(50% 40% at 50% 30%, rgba(108,123,255,0.16), transparent 70%),radial-gradient(40% 30% at 80% 80%, rgba(154,108,255,0.12), transparent 70%)",
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

      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="transition hover:opacity-90">
          <PorfiloWordmark />
        </Link>
      </nav>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-88px)] max-w-md flex-col items-center justify-center px-6 pb-24">
        <Suspense fallback={null}>
          <CheckEmailInner />
        </Suspense>
      </section>
    </main>
  );
}
