import Link from "next/link";
import { SignOutButton } from "./sign-out-button";
import { PorfiloWordmark } from "~/app/_components/porfilo-logo";

/**
 * Shared chrome for all signed-in pages: dark canvas, aurora wash, grain,
 * top nav with Porfilo mark + "Signed in as <name>" + Sign out.
 *
 * Two layouts:
 *   default — content centered in a max-width column with min-h-screen.
 *             Used by /generate (a single form + cinematic vertical rhythm).
 *   fit     — viewport-locked on md+ (no scroll), scrollable on mobile only.
 *             Used by /dashboard (a result screen that should fit in one
 *             glance on desktop). Children get `h-full` to work inside the
 *             column.
 */
export function AppShell({
  displayName,
  navAction,
  width = "default",
  fit = false,
  children,
}: {
  displayName: string | null;
  navAction?: React.ReactNode;
  width?: "default" | "wide";
  fit?: boolean;
  children: React.ReactNode;
}) {
  const widthClass = width === "wide" ? "max-w-6xl" : "max-w-3xl";

  // `fit`: desktop is exactly 100vh with overflow hidden so the dashboard
  // never scrolls; mobile keeps the natural document flow so small viewports
  // can still scroll long content.
  const rootClass = fit
    ? "relative min-h-screen md:h-screen md:overflow-hidden bg-[#06060a]"
    : "relative min-h-screen overflow-hidden bg-[#06060a]";

  const sectionClass = fit
    ? `relative z-10 mx-auto flex ${widthClass} flex-col px-6 pb-6 md:h-[calc(100vh-72px)] md:pb-0`
    : `relative z-10 mx-auto flex min-h-[calc(100vh-88px)] ${widthClass} flex-col items-center justify-center px-6 pb-24`;

  return (
    <main className={`${rootClass} text-white antialiased [font-feature-settings:'ss01','cv11']`}>
      <BackgroundDecor />

      <nav className="relative z-10 mx-auto flex h-[72px] max-w-6xl items-center justify-between px-6">
        <Link
          href="/dashboard"
          className="transition hover:opacity-90"
        >
          <PorfiloWordmark />
        </Link>
        <div className="flex items-center gap-4 text-[12px] text-white/45">
          {navAction}
          {displayName && (
            <span className="hidden sm:inline">
              Signed in as <span className="text-white/80">{displayName}</span>
            </span>
          )}
          <SignOutButton />
        </div>
      </nav>

      <section className={sectionClass}>{children}</section>

      {!fit && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/70 to-transparent"
        />
      )}
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
            "radial-gradient(55% 45% at 50% 25%, rgba(54,212,134,0.10), transparent 70%),radial-gradient(50% 40% at 80% 80%, rgba(108,123,255,0.16), transparent 70%),radial-gradient(40% 30% at 15% 85%, rgba(154,108,255,0.12), transparent 70%)",
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
