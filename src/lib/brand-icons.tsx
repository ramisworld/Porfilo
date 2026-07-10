/* @jsxImportSource react */
import { ImageResponse } from "next/og";

export const ICON_SIZE = { width: 32, height: 32 } as const;
export const APPLE_ICON_SIZE = { width: 180, height: 180 } as const;

/** Satori-safe mark for OG images (matches favicon look, div-based). */
export function PorfiloIcon({ size = 32 }: { size?: number }) {
  const r = size * 0.22;
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#08080c",
        borderRadius: size * 0.28,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 30% 20%, rgba(108,123,255,0.62), transparent 55%), radial-gradient(circle at 80% 85%, rgba(154,108,255,0.5), transparent 50%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, transparent 45%)",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: size * 0.62,
          height: size * 0.62,
          borderRadius: r,
          border: `${Math.max(1, size * 0.06)}px solid rgba(255,255,255,0.88)`,
          boxShadow: "0 0 14px rgba(108,123,255,0.55)",
        }}
      >
        <div
          style={{
            fontSize: size * 0.38,
            fontWeight: 700,
            color: "white",
            fontFamily: "sans-serif",
            letterSpacing: -0.6,
            marginTop: -size * 0.02,
          }}
        >
          P
        </div>
      </div>
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
