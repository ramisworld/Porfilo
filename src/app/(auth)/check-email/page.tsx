import Link from "next/link";
import { Suspense } from "react";
import { PorfiloWordmark } from "~/app/_components/porfilo-logo";
import { AuroraBackground } from "~/app/_components/aurora-background";
import { CheckEmailInner } from "./inner";

export const dynamic = "force-dynamic";

export default function CheckEmailPage() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-bg text-fg antialiased [font-feature-settings:'ss01','cv11']">
      <AuroraBackground variant="ghost" />

      <nav className="relative z-10 mx-auto flex w-full max-w-6xl flex-none items-center justify-between px-6 py-6">
        <Link href="/" className="transition hover:opacity-90">
          <PorfiloWordmark />
        </Link>
      </nav>

      <section className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 pb-16">
        <Suspense fallback={null}>
          <CheckEmailInner />
        </Suspense>
      </section>
    </main>
  );
}
