/* @jsxImportSource react */
import { ImageResponse } from "next/og";
import { PorfiloIcon } from "~/lib/brand-icons";
import { OG_SIZE } from "~/server/portfolio/og-image";

/** Link-preview image for porfilo.com — mirrors the marketing hero. */
export function renderPorfiloLandingOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#06060a",
          color: "white",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Aurora blobs */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 22% 28%, hsla(245,78%,60%,0.32) 0%, transparent 55%), radial-gradient(circle at 82% 62%, hsla(282,78%,60%,0.28) 0%, transparent 50%), radial-gradient(circle at 50% 95%, hsla(215,78%,60%,0.26) 0%, transparent 45%)",
          }}
        />

        {/* Nav */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "40px 56px 0",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 14,
              letterSpacing: 4,
              color: "rgba(255,255,255,0.55)",
              textTransform: "uppercase",
            }}
          >
            <PorfiloIcon size={28} />
            Porfilo
          </div>
        </div>

        {/* Hero */}
        <div
          style={{
            position: "relative",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 64px 48px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              padding: "8px 16px",
              fontSize: 13,
              letterSpacing: 3,
              color: "rgba(255,255,255,0.55)",
              textTransform: "uppercase",
              marginBottom: 32,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: "#34d399",
                boxShadow: "0 0 8px #34d399",
              }}
            />
            Now in beta
          </div>

          <div
            style={{
              fontSize: 72,
              fontWeight: 500,
              lineHeight: 1.02,
              letterSpacing: -2,
              textAlign: "center",
            }}
          >
            Your GitHub,
            <br />
            <span
              style={{
                background: "linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.55) 100%)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              as a portfolio.
            </span>
          </div>

          <div
            style={{
              marginTop: 24,
              fontSize: 22,
              color: "rgba(255,255,255,0.55)",
              textAlign: "center",
              maxWidth: 520,
              lineHeight: 1.45,
            }}
          >
            One field. One click. A living, interactive site built from your real work.
          </div>

          {/* Glass input card */}
          <div
            style={{
              marginTop: 48,
              width: 520,
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              padding: 8,
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.10), 0 30px 60px -20px rgba(0,0,0,0.65)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                borderRadius: 14,
                background: "rgba(0,0,0,0.35)",
                padding: 4,
                border: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              <span
                style={{
                  width: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(255,255,255,0.35)",
                  fontSize: 18,
                }}
              >
                @
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: 18,
                  color: "rgba(255,255,255,0.25)",
                }}
              >
                your-github
              </span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  borderRadius: 10,
                  background: "white",
                  color: "black",
                  fontSize: 16,
                  fontWeight: 500,
                  padding: "10px 18px",
                }}
              >
                Generate →
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 28,
              display: "flex",
              gap: 20,
              fontSize: 14,
              color: "rgba(255,255,255,0.30)",
              letterSpacing: 0.5,
            }}
          >
            <span>Free during beta</span>
            <span>·</span>
            <span>One template, many worlds</span>
            <span>·</span>
            <span>Your domain, later</span>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}

/** @deprecated Use renderPorfiloLandingOgImage */
export const renderPorthubLandingOgImage = renderPorfiloLandingOgImage;
