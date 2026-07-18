/* @jsxImportSource react */
import { ImageResponse } from "next/og";

const OG_SIZE = { width: 1200, height: 630 } as const;

/** Satori-safe link preview for the Porfilo landing page. */
export function renderPorfiloLandingOgImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#f4f3ee",
        color: "#0d0d0c",
        padding: "46px 54px",
        fontFamily: "sans-serif",
        border: "14px solid #0d0d0c",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        <span>PORFILO</span>
        <span>GITHUB → PORTFOLIO</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontSize: 82,
            fontWeight: 800,
            lineHeight: 0.96,
            letterSpacing: -4,
            maxWidth: 1000,
          }}
        >
          Your work deserves a portfolio this good.
        </div>
        <div
          style={{
            display: "flex",
            width: 260,
            height: 12,
            marginTop: 30,
            background: "#e8380d",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: "3px solid #0d0d0c",
          paddingTop: 22,
          fontSize: 22,
        }}
      >
        <span>Real repositories. Real proof. Your own world.</span>
        <span style={{ fontWeight: 800 }}>porfilo.com ↗</span>
      </div>
    </div>,
    OG_SIZE,
  );
}

/** @deprecated Use renderPorfiloLandingOgImage */
export const renderPorthubLandingOgImage = renderPorfiloLandingOgImage;
