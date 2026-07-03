import type { SVGProps } from "react";

/**
 * Shared Porfilo icons.
 *
 * Previously the same Arrow / Spinner / Close shapes were redefined 4–5× across
 * the landing, sign-in, generate, dashboard, and modals. These single sources
 * keep stroke language and sizing consistent.
 */

/** Right-pointing arrow used inside primary CTAs. */
export function Arrow({ className }: { className?: string }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className={`transition-transform group-hover:translate-x-0.5 ${className ?? ""}`.trim()}
    >
      <path
        d="M2 7h9m0 0L7 3m4 4l-4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Up-and-right external-link arrow. */
export function ExternalArrow({ className }: { className?: string }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M5 3h6v6M11 3L4 10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Compact loading ring. `tone="onPrimary"` dims against a white button. */
export function Spinner({
  className = "",
  tone = "onPrimary",
}: {
  className?: string;
  tone?: "onPrimary" | "onDark";
}) {
  const base =
    tone === "onPrimary"
      ? "inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/25 border-t-current"
      : "inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/15 border-t-white/70";
  return <span aria-hidden className={`${base} ${className}`.trim()} />;
}

/** Close / × used by modal headers and dismiss affordances. */
export function CloseIcon({ className, ...props }: { className?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className={className}
      {...props}
    >
      <path
        d="M3 3l8 8M11 3l-8 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
