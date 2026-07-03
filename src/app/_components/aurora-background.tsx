/**
 * Porfilo ambient background.
 *
 * The aurora radial-gradient + fractal-noise grain is reused across the
 * marketing landing, auth, and check-email surfaces. Factored here so the
 * three stay in sync and the copy-pasted <svg> noise data-uri lives once.
 */
export function AuroraBackground({
  variant = "indigo",
}: {
  variant?: "indigo" | "ghost";
}) {
  const stops =
    variant === "ghost"
      ? "radial-gradient(55% 45% at 50% 18%, rgba(108,123,255,0.16), transparent 70%),radial-gradient(45% 35% at 82% 78%, rgba(154,108,255,0.12), transparent 70%),radial-gradient(40% 30% at 18% 85%, rgba(64,128,255,0.10), transparent 70%)"
      : "radial-gradient(60% 50% at 50% 20%, rgba(108,123,255,0.18), transparent 70%),radial-gradient(50% 40% at 80% 80%, rgba(154,108,255,0.14), transparent 70%),radial-gradient(40% 30% at 20% 85%, rgba(64,128,255,0.12), transparent 70%)";

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: stops }}
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
