/* @jsxImportSource react */
import { ImageResponse } from "next/og";

export const ICON_SIZE = { width: 32, height: 32 } as const;
export const APPLE_ICON_SIZE = { width: 180, height: 180 } as const;

/** Satori-safe brutalist mark for OG images and PNG app icons. */
export function PorfiloIcon({ size = 32 }: { size?: number }) {
  const border = Math.max(2, size * 0.065);
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        background: "#f4f3ee",
        border: `${border}px solid #0d0d0c`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: size * 0.19,
          top: size * 0.17,
          width: size * 0.19,
          height: size * 0.66,
          background: "#0d0d0c",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: size * 0.19,
          top: size * 0.17,
          width: size * 0.51,
          height: size * 0.18,
          background: "#0d0d0c",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: size * 0.56,
          top: size * 0.17,
          width: size * 0.16,
          height: size * 0.39,
          background: "#0d0d0c",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: size * 0.19,
          top: size * 0.44,
          width: size * 0.51,
          height: size * 0.17,
          background: "#0d0d0c",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: size * 0.1,
          top: size * 0.1,
          width: size * 0.16,
          height: size * 0.16,
          background: "#e8380d",
        }}
      />
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
