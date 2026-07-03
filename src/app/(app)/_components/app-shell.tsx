import Link from "next/link";
import { SignOutButton } from "./sign-out-button";
import { PorfiloWordmark } from "~/app/_components/porfilo-logo";
import { AuroraBackground } from "~/app/_components/aurora-background";

/**
 * Shared chrome for all signed-in pages.
 *
 * Two layouts:
 *   default — content centered in a max-width column with min-h-screen.
 *   fit     — viewport-locked on md+ (no scroll), scrollable on mobile only.
 *             Used by /dashboard (a result screen that should fit in one
 *             glance on desktop).
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

  const rootClass = fit
    ? "relative min-h-screen md:h-screen md:overflow-hidden bg-bg"
    : "relative min-h-screen overflow-hidden bg-bg";

  const sectionClass = fit
    ? `relative z-10 mx-auto flex ${widthClass} flex-col px-6 pb-6 md:h-[calc(100vh-65px)] md:pb-0`
    : `relative z-10 mx-auto flex min-h-[calc(100vh-65px)] ${widthClass} flex-col items-center justify-center px-6 pb-24`;

  return (
    <main className={`${rootClass} text-fg antialiased [font-feature-settings:'ss01','cv11']`}>
      <AuroraBackground variant="ghost" />

      <nav className="relative z-10 mx-auto flex h-[65px] w-full max-w-6xl items-center justify-between px-6">
        <Link href="/dashboard" className="transition hover:opacity-90">
          <PorfiloWordmark />
        </Link>
        <div className="flex items-center gap-4 text-[12px] text-muted-2">
          {navAction}
          {displayName && (
            <span className="hidden sm:inline">
              Signed in as{" "}
              <span className="text-fg/80">{displayName}</span>
            </span>
          )}
          <SignOutButton />
        </div>
      </nav>

      <section className={sectionClass}>{children}</section>
    </main>
  );
}
