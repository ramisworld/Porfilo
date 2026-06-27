/* @jsxImportSource react */
import { ImageResponse } from "next/og";
import {
  DEFAULT_SPEC,
  designSpecSchema,
  type DesignSpec,
} from "~/engine/spec";
import type { ProfileData } from "~/server/profile/model";
import { portfolioDisplayName } from "~/server/portfolio/metadata";

export const OG_SIZE = { width: 1200, height: 630 } as const;

type OgProps = {
  name: string;
  role: string;
  headline: string;
  langs: string[];
  spec: DesignSpec;
  experience: DesignSpec["experience"];
};

function parseOgInput(
  profileData: unknown,
  designSpec: unknown,
  githubUsername: string,
): OgProps {
  const data = profileData as ProfileData | undefined;
  const parsed = designSpecSchema.safeParse(designSpec);
  const spec = parsed.success ? parsed.data : DEFAULT_SPEC;
  return {
    name: portfolioDisplayName(data, githubUsername),
    role: data?.identity.role?.trim() ?? "Developer",
    headline:
      data?.identity.headline?.trim() ??
      data?.identity.role?.trim() ??
      "Developer",
    langs: (data?.languages ?? []).slice(0, 4).map((l) => l.label),
    spec,
    experience: spec.experience,
  };
}

function LangPills({
  langs,
  fg = "#c8c8d8",
  border = "#23232f",
}: {
  langs: string[];
  fg?: string;
  border?: string;
}) {
  if (!langs.length) return null;
  return (
    <div style={{ display: "flex", gap: 14, marginTop: 36, flexWrap: "wrap" }}>
      {langs.map((l) => (
        <div
          key={l}
          style={{
            fontSize: 22,
            color: fg,
            border: `1px solid ${border}`,
            borderRadius: 999,
            padding: "8px 20px",
          }}
        >
          {l}
        </div>
      ))}
    </div>
  );
}

function TerminalNexusOg({ name, role, headline, langs }: OgProps) {
  const brand = name.toUpperCase();
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#070a09",
        color: "#e8f5ef",
        fontFamily: "monospace",
        padding: "48px 56px",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 3px)",
          opacity: 0.35,
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 18,
          color: "#6b8f7a",
          letterSpacing: 2,
          position: "relative",
        }}
      >
        <span>
          <b style={{ color: "#5dff9e" }}>&gt;_</b> {brand}
        </span>
        <span>UPLINK SECURE</span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative" }}>
        <div style={{ fontSize: 16, color: "#5dff9e", letterSpacing: 4, marginBottom: 16 }}>
          {"// SECURE_SHELL"}
        </div>
        <div style={{ fontSize: 88, fontWeight: 700, letterSpacing: -2, lineHeight: 1 }}>{brand}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, fontSize: 32, color: "#9fdcb8" }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: "#5dff9e" }} />
          {role}
        </div>
        <div
          style={{
            marginTop: 40,
            border: "1px solid #1f3d2f",
            borderRadius: 12,
            background: "#0a1210",
            overflow: "hidden",
            maxWidth: 720,
          }}
        >
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #1f3d2f", display: "flex", gap: 8 }}>
            <span style={{ width: 12, height: 12, borderRadius: 999, background: "#ff5f57" }} />
            <span style={{ width: 12, height: 12, borderRadius: 999, background: "#febc2e" }} />
            <span style={{ width: 12, height: 12, borderRadius: 999, background: "#28c840" }} />
            <span style={{ marginLeft: 12, color: "#6b8f7a", fontSize: 14 }}>whoami.sh</span>
          </div>
          <div style={{ padding: "20px 24px", fontSize: 22, lineHeight: 1.7, color: "#b8dcc8" }}>
            <div><span style={{ color: "#5dff9e" }}>name</span>     {name}</div>
            <div><span style={{ color: "#5dff9e" }}>role</span>     {role}</div>
            <div style={{ color: "#6b8f7a", marginTop: 8 }}>{headline.slice(0, 80)}</div>
          </div>
        </div>
        <LangPills langs={langs} fg="#9fdcb8" border="#1f3d2f" />
      </div>
    </div>
  );
}

function DirectorCutOg({ name, role, headline, langs }: OgProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#050505",
        color: "white",
        fontFamily: "serif",
        position: "relative",
      }}
    >
      <div style={{ height: 56, background: "#000" }} />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "0 80px",
        }}
      >
        <div style={{ fontSize: 20, letterSpacing: 8, color: "#888", marginBottom: 12 }}>ACT I</div>
        <div style={{ fontSize: 18, letterSpacing: 6, color: "#666", marginBottom: 24 }}>A FILM BY</div>
        <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -1, lineHeight: 1.05 }}>{name}</div>
        <div style={{ fontSize: 28, marginTop: 28, letterSpacing: 3, color: "#ccc" }}>
          STARRING AS: {role.toUpperCase()}
        </div>
        <div style={{ fontSize: 24, marginTop: 20, color: "#777", maxWidth: 800, fontStyle: "italic" }}>
          {headline.slice(0, 100)}
        </div>
        <LangPills langs={langs} fg="#aaa" border="#333" />
      </div>
      <div style={{ height: 56, background: "#000" }} />
    </div>
  );
}

function InstrumentOg({ name, role, headline, langs, spec }: OgProps) {
  const t = spec.theme;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: t.bg,
        color: t.fg,
        fontFamily: "sans-serif",
        padding: "56px 72px",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div style={{ fontSize: 16, letterSpacing: 6, color: t.muted, position: "relative" }}>01 / SIGNAL</div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative" }}>
        <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>{name}</div>
        <div style={{ width: 120, height: 4, background: t.accent, marginTop: 24 }} />
        <div style={{ fontSize: 34, color: t.accent, marginTop: 20 }}>{role}</div>
        <div style={{ fontSize: 24, color: t.muted, marginTop: 16, maxWidth: 720 }}>{headline.slice(0, 90)}</div>
        <LangPills langs={langs} fg={t.fg} border={t.border} />
      </div>
    </div>
  );
}

function BrutalistOg({ name, role, headline, langs }: OgProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#f5f0e8",
        color: "#0a0a0a",
        fontFamily: "sans-serif",
        padding: 0,
      }}
    >
      <div style={{ borderBottom: "6px solid #0a0a0a", padding: "24px 56px", fontSize: 18, fontWeight: 700, letterSpacing: 4 }}>
        00 / PROFILE
      </div>
      <div style={{ flex: 1, padding: "48px 56px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontSize: 92, fontWeight: 900, textTransform: "uppercase", lineHeight: 0.95, letterSpacing: -2 }}>
          {name}
        </div>
        <div
          style={{
            display: "inline-flex",
            marginTop: 28,
            background: "#0a0a0a",
            color: "#f5f0e8",
            fontSize: 28,
            fontWeight: 700,
            padding: "12px 24px",
            alignSelf: "flex-start",
          }}
        >
          {role.toUpperCase()}
        </div>
        <div style={{ fontSize: 26, marginTop: 28, maxWidth: 800, borderLeft: "6px solid #0a0a0a", paddingLeft: 20 }}>
          {headline.slice(0, 90)}
        </div>
        <LangPills langs={langs} fg="#0a0a0a" border="#0a0a0a" />
      </div>
    </div>
  );
}

function AuroraOg({ name, role, headline, langs, spec }: OgProps) {
  const t = spec.theme;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: t.bg,
        fontFamily: "sans-serif",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 20% 30%, ${t.accent}55, transparent 45%), radial-gradient(circle at 80% 70%, ${t.accent2}44, transparent 50%)`,
        }}
      />
      <div
        style={{
          position: "relative",
          width: 920,
          padding: "56px 64px",
          borderRadius: 32,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.18)",
          color: t.fg,
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ fontSize: 80, fontWeight: 600, letterSpacing: -2 }}>{name}</div>
        <div style={{ fontSize: 34, color: t.accent, marginTop: 16 }}>{role}</div>
        <div style={{ fontSize: 24, color: t.muted, marginTop: 16, lineHeight: 1.4 }}>{headline.slice(0, 90)}</div>
        <LangPills langs={langs} fg={t.fg} border="rgba(255,255,255,0.2)" />
      </div>
    </div>
  );
}

function GenericOg({ name, role, headline, langs, spec }: OgProps) {
  const t = spec.theme;
  const dotBg =
    spec.background.mode === "dotgrid"
      ? "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)"
      : spec.background.mode === "aurora"
        ? `radial-gradient(circle at 30% 20%, ${t.accent}33, transparent 50%), radial-gradient(circle at 70% 80%, ${t.accent2}33, transparent 50%)`
        : "none";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: t.bg,
        color: t.fg,
        fontFamily: "sans-serif",
        padding: "64px 80px",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: dotBg,
          backgroundSize: spec.background.mode === "dotgrid" ? "24px 24px" : undefined,
        }}
      />
      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontSize: 22, color: t.accent, letterSpacing: 4, marginBottom: 16, textTransform: "uppercase" }}>
          {spec.lexicon?.kicker ?? "Portfolio"}
        </div>
        <div style={{ fontSize: 88, fontWeight: 700, letterSpacing: -2, lineHeight: 1 }}>{name}</div>
        <div style={{ fontSize: 36, color: t.accent, marginTop: 20 }}>{role}</div>
        <div style={{ fontSize: 26, color: t.muted, marginTop: 20, maxWidth: 780, lineHeight: 1.35 }}>
          {headline.slice(0, 100)}
        </div>
        <LangPills langs={langs} fg={t.fg} border={t.border} />
      </div>
    </div>
  );
}

function OgLayout(props: OgProps) {
  switch (props.experience) {
    case "terminalNexus":
      return <TerminalNexusOg {...props} />;
    case "directorCut":
      return <DirectorCutOg {...props} />;
    case "instrument":
      return <InstrumentOg {...props} />;
    case "brutalist":
      return <BrutalistOg {...props} />;
    case "aurora":
      return <AuroraOg {...props} />;
    case "generative":
    case "classic":
    default:
      return <GenericOg {...props} />;
  }
}

export function renderPortfolioOgImage(
  profileData: unknown,
  designSpec: unknown,
  githubUsername: string,
) {
  const props = parseOgInput(profileData, designSpec, githubUsername);
  return new ImageResponse(<OgLayout {...props} />, { ...OG_SIZE });
}
