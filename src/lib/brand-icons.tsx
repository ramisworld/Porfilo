/* @jsxImportSource react */
import { ImageResponse } from "next/og";

export const ICON_SIZE = { width: 32, height: 32 } as const;
export const APPLE_ICON_SIZE = { width: 180, height: 180 } as const;

/**
 * Satori-safe Porfilo mark (PNG favicon / apple-icon / OG). Mirrors the SVG in
 * porfilo-mark-string.ts: a freestanding gradient "aperture P", no app-icon box.
 */
export function PorfiloIcon({ size = 32 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient
            id="pf-stroke"
            x1="7"
            y1="4"
            x2="25"
            y2="28"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#9FB0FF" />
            <stop offset="0.5" stopColor="#6C7BFF" />
            <stop offset="1" stopColor="#A472FF" />
          </linearGradient>
          <radialGradient
            id="pf-eye"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(17.9 11.9) scale(3.2)"
          >
            <stop stopColor="#EAEDFF" />
            <stop offset="1" stopColor="#9A6CFF" />
          </radialGradient>
        </defs>
        <path
          d="M11 27.4 V5.4 H17.9 A6.8 6.8 0 0 1 17.9 19 H11"
          fill="none"
          stroke="url(#pf-stroke)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="17.9" cy="11.9" r="1.7" fill="url(#pf-eye)" />
      </svg>
    </div>
  );
}

/** Shared portfolio mark — a neutral viewport frame, same on every generated site. */
export function PortfolioMarkIcon({ size = 32 }: { size?: number }) {
  const stroke = Math.max(1.5, size * 0.07);
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0e1014",
        borderRadius: size * 0.26,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 110%, rgba(110,231,217,0.35), transparent 60%)",
        }}
      />
      <div
        style={{
          position: "relative",
          width: size * 0.58,
          height: size * 0.52,
          borderRadius: size * 0.1,
          border: `${stroke}px solid rgba(255,255,255,0.75)`,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "rgba(255,255,255,0.04)",
        }}
      >
        <div
          style={{
            height: size * 0.12,
            borderBottom: `${stroke * 0.7}px solid rgba(255,255,255,0.25)`,
            display: "flex",
            alignItems: "center",
            paddingLeft: size * 0.06,
            gap: size * 0.04,
          }}
        >
          <div
            style={{
              width: size * 0.05,
              height: size * 0.05,
              borderRadius: 999,
              background: "#6ee7d9",
            }}
          />
          <div
            style={{
              width: size * 0.05,
              height: size * 0.05,
              borderRadius: 999,
              background: "rgba(255,255,255,0.25)",
            }}
          />
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "flex-end",
            padding: size * 0.06,
          }}
        >
          <div
            style={{
              width: "100%",
              height: size * 0.08,
              borderRadius: size * 0.04,
              background:
                "linear-gradient(90deg, rgba(110,231,217,0.9), rgba(108,123,255,0.7))",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function porfiloIconResponse(size: number) {
  return new ImageResponse(<PorfiloIcon size={size} />, {
    width: size,
    height: size,
  });
}

/** @deprecated Use porfiloIconResponse */
export const portHubIconResponse = porfiloIconResponse;

export function portfolioMarkResponse(size: number) {
  return new ImageResponse(<PortfolioMarkIcon size={size} />, {
    width: size,
    height: size,
  });
}
