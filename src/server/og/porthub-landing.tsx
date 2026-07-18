/* @jsxImportSource react */
import { ImageResponse } from "next/og";

const OG_SIZE = { width: 1200, height: 630 } as const;

const WALL_COLUMNS = [
  ["#1c4e43", "#161d31", "#4a1d2a"],
  ["#2a365a", "#193f35", "#39244f"],
  ["#4d2632", "#233442", "#4a4820"],
  ["#263b58", "#4d2d1b", "#183f3b"],
  ["#3a2445", "#2f4c3e", "#4a2929"],
] as const;

function WorldCard({ accent, index }: { accent: string; index: number }) {
  return (
    <div
      style={{
        display: "flex",
        width: 172,
        height: 208,
        flexDirection: "column",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.16)",
        borderRadius: 9,
        background: "#101015",
        boxShadow: "0 14px 28px rgba(0,0,0,0.42)",
      }}
    >
      <div
        style={{
          display: "flex",
          height: 116,
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 14,
          background: `linear-gradient(145deg, ${accent}, #08080b 78%)`,
        }}
      >
        <div
          style={{
            display: "flex",
            width: 28,
            height: 5,
            background: "rgba(255,255,255,0.72)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div
            style={{
              display: "flex",
              width: index % 2 === 0 ? 106 : 78,
              height: 13,
              background: "rgba(255,255,255,0.9)",
            }}
          />
          <div
            style={{
              display: "flex",
              width: 58,
              height: 4,
              background: "rgba(255,255,255,0.38)",
            }}
          />
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 13,
        }}
      >
        <div style={{ display: "flex", gap: 5 }}>
          <div style={{ display: "flex", width: 30, height: 4, background: accent }} />
          <div style={{ display: "flex", width: 44, height: 4, background: "rgba(255,255,255,0.22)" }} />
        </div>
        <div style={{ display: "flex", width: "100%", height: 1, background: "rgba(255,255,255,0.12)" }} />
      </div>
    </div>
  );
}

/**
 * Satori-safe representation of the exact landing-page hero. Social crawlers
 * cannot execute the client-side moving portfolio wall, so this preserves the
 * same first-frame composition rather than falling back to unrelated artwork.
 */
export function renderPorfiloLandingOgImage() {
  return new ImageResponse(
    <div
      style={{
        position: "relative",
        display: "flex",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#050507",
        color: "#f4f3ee",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -54,
          display: "flex",
          justifyContent: "center",
          gap: 18,
          opacity: 0.72,
        }}
      >
        {WALL_COLUMNS.map((cards, columnIndex) => (
          <div
            key={columnIndex}
            style={{
              display: "flex",
              width: 172,
              flexDirection: "column",
              gap: 18,
              transform: `translateY(${[-64, -152, -96, -174, -58][columnIndex]}px)`,
              filter: columnIndex === 0 || columnIndex === 4 ? "brightness(0.72)" : "brightness(0.9)",
            }}
          >
            {[...cards, ...cards].map((accent, index) => (
              <WorldCard key={`${accent}-${index}`} accent={accent} index={index} />
            ))}
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          background:
            "radial-gradient(55% 68% at 50% 48%, rgba(5,5,7,0.93) 20%, rgba(5,5,7,0.83) 49%, rgba(5,5,7,0.23) 76%, rgba(5,5,7,0.08) 100%)",
        }}
      />

      <div
        style={{
          position: "relative",
          display: "flex",
          width: "100%",
          height: "100%",
          flexDirection: "column",
          alignItems: "center",
          padding: "31px 44px 40px",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "100%",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              padding: "7px 12px 8px 10px",
              border: "2px solid #f4f3ee",
              background: "#f4f3ee",
              boxShadow: "4px 4px 0 #e8380d",
              color: "#0d0d0c",
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: -1,
            }}
          >
            PORFILO
          </div>
          <div
            style={{
              display: "flex",
              padding: "10px 14px",
              border: "2px solid #f4f3ee",
              background: "#f4f3ee",
              boxShadow: "4px 4px 0 #e8380d",
              color: "#0d0d0c",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 1.1,
              textTransform: "uppercase",
            }}
          >
            Sign in →
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            paddingTop: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              marginBottom: 21,
              padding: "8px 11px",
              border: "2px solid #f4f3ee",
              background: "#0d0d0c",
              boxShadow: "4px 4px 0 #e8380d",
              fontFamily: "monospace",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.25,
              textTransform: "uppercase",
            }}
          >
            <span style={{ display: "flex", width: 7, height: 7, background: "#e8380d" }} />
            54 portfolios generated in the last hour
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              color: "#f4f3ee",
              fontSize: 57,
              fontWeight: 900,
              letterSpacing: -4.5,
              lineHeight: 0.9,
              textAlign: "center",
              textTransform: "uppercase",
            }}
          >
            <span>YOUR WORK DESERVES A</span>
            <span>
              <span style={{ color: "#e8380d", marginRight: 14 }}>PORTFOLIO</span> THIS GOOD.
            </span>
          </div>

          <div
            style={{
              display: "flex",
              maxWidth: 584,
              marginTop: 19,
              borderLeft: "5px solid #e8380d",
              padding: "9px 13px",
              background: "rgba(13,13,12,0.88)",
              color: "rgba(244,243,238,0.82)",
              fontFamily: "monospace",
              fontSize: 11,
              lineHeight: 1.45,
              textAlign: "left",
            }}
          >
            Every site behind this page was generated from a real public GitHub profile. Type your username and get yours.
          </div>

          <div
            style={{
              display: "flex",
              width: 526,
              flexDirection: "column",
              marginTop: 20,
              border: "2px solid #f4f3ee",
              background: "rgba(13,13,12,0.96)",
              boxShadow: "8px 8px 0 #e8380d",
            }}
          >
            <div
              style={{
                display: "flex",
                padding: "8px 11px",
                borderBottom: "2px solid #f4f3ee",
                color: "rgba(244,243,238,0.68)",
                fontFamily: "monospace",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 1.3,
                textTransform: "uppercase",
              }}
            >
              <span style={{ color: "#e8380d", marginRight: 11 }}>01</span> GitHub profile
            </div>
            <div style={{ display: "flex", height: 53, alignItems: "center" }}>
              <span style={{ display: "flex", padding: "0 17px", color: "#e8380d", fontFamily: "monospace", fontSize: 17, fontWeight: 900 }}>@</span>
              <span style={{ display: "flex", flex: 1, color: "rgba(244,243,238,0.38)", fontFamily: "monospace", fontSize: 14 }}>your-github</span>
              <span
                style={{
                  display: "flex",
                  margin: 5,
                  padding: "12px 15px",
                  border: "2px solid #f4f3ee",
                  background: "#f4f3ee",
                  boxShadow: "3px 3px 0 #e8380d",
                  color: "#0d0d0c",
                  fontFamily: "monospace",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 0.7,
                  textTransform: "uppercase",
                }}
              >
                Continue →
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    OG_SIZE,
  );
}

/** @deprecated Use renderPorfiloLandingOgImage */
export const renderPorthubLandingOgImage = renderPorfiloLandingOgImage;
