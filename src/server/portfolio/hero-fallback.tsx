/* @jsxImportSource react */
import { ImageResponse } from "next/og";
import { profileDataSchema } from "~/server/profile/model";

const SIZE = { width: 1200, height: 630 } as const;

type FallbackPortfolio = {
  githubUsername: string;
  profileData: unknown;
};

/**
 * Last-resort social card for a portfolio whose browser capture is temporarily
 * unavailable. It deliberately uses that person's actual identity, headline,
 * and stack — never Porfilo's marketing image — so a transient renderer issue
 * cannot erase the portfolio from a shared link.
 */
export function renderPortfolioHeroFallback(
  portfolio: FallbackPortfolio,
): Response {
  const parsed = profileDataSchema.safeParse(portfolio.profileData);
  const profile = parsed.success ? parsed.data : null;
  const name = profile?.identity.name ?? portfolio.githubUsername;
  const role = profile?.identity.role ?? "Developer";
  const headline =
    profile?.identity.headline ?? "Building thoughtful software.";
  const stackItems = profile?.stack.slice(0, 6) ?? [];
  const stack =
    stackItems.length > 0 ? stackItems.join("  ·  ") : "GitHub portfolio";

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "48px 58px",
        background: "#050807",
        color: "#e9f0eb",
        fontFamily: "monospace",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          color: "#36d486",
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: 2,
        }}
      >
        <span>&gt;_ {portfolio.githubUsername}</span>
        <span>UPLINK SECURE</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span
          style={{
            color: "#36d486",
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: 3,
          }}
        >
          {"// PORTFOLIO"}
        </span>
        <span
          style={{
            marginTop: 18,
            fontSize: 78,
            fontWeight: 900,
            letterSpacing: -5,
            lineHeight: 0.92,
          }}
        >
          {name.toUpperCase()}
        </span>
        <span style={{ marginTop: 22, color: "#80e8bd", fontSize: 29 }}>
          ● {role}
        </span>
        <span
          style={{
            maxWidth: 900,
            marginTop: 18,
            color: "#bac4bd",
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: 25,
            lineHeight: 1.3,
          }}
        >
          {headline}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          borderTop: "1px solid #29443a",
          paddingTop: 18,
          color: "#6b756f",
          fontSize: 15,
          letterSpacing: 1,
          textTransform: "uppercase",
        }}
      >
        {stack}
      </div>
    </div>,
    SIZE,
  );
}
