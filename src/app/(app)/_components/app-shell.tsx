import Link from "next/link";
import { SignOutButton } from "./sign-out-button";
import { PorfiloWordmark } from "~/app/_components/porfilo-logo";
import styles from "./app-shell.module.css";

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
  return (
    <main className={styles.shell} data-fit={fit ? "true" : "false"}>
      <div className={styles.grid} aria-hidden />
      <nav className={styles.nav}>
        <Link href="/dashboard" className={styles.brand}>
          <PorfiloWordmark
            size={22}
            textClassName="text-[0.95rem] font-semibold tracking-[-0.01em] text-white"
          />
        </Link>
        <div className={styles.account}>
          {navAction}
          {displayName && (
            <span>
              Account / <b>{displayName}</b>
            </span>
          )}
          <SignOutButton />
        </div>
      </nav>

      <section
        className={styles.content}
        data-fit={fit ? "true" : "false"}
        data-width={width}
      >
        {children}
      </section>
    </main>
  );
}
