import Link from "next/link";
import { PorfiloWordmark } from "~/app/_components/porfilo-logo";
import { AuroraBackground } from "~/app/_components/aurora-background";

export const dynamic = "force-static";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-bg text-fg antialiased">
      <AuroraBackground />

      <nav className="absolute inset-x-0 top-0 z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="transition hover:opacity-90">
          <PorfiloWordmark />
        </Link>
      </nav>

      <div className="relative z-10 px-6 text-center">
        <p className="font-mono text-[12px] tracking-[0.2em] text-accent uppercase">
          404
        </p>
        <h1 className="mt-4 text-balance text-4xl font-medium tracking-tight sm:text-5xl">
          This page drifted off the grid.
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-[15px] leading-relaxed text-muted">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <Link href="/" className="porfilo-btn porfilo-btn-primary group mt-8">
          Back to Porfilo
        </Link>
      </div>
    </main>
  );
}
