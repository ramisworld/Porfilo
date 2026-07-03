import { ImageResponse } from "next/og";
import { db } from "~/server/db";
import type { ProfileData } from "~/server/profile/model";

export const runtime = "nodejs";
export const alt = "Developer portfolio on PortHub";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const portfolio = await db.portfolio.findUnique({ where: { slug } });
  const data = portfolio?.profileData as ProfileData | undefined;

  const name = data?.identity.name ?? "PortHub";
  const role = data?.identity.role ?? "Developer portfolio";
  const langs = (data?.languages ?? []).slice(0, 4).map((l) => l.label);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#08080c",
          color: "white",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 22, letterSpacing: 6, color: "#8a8aa0" }}>
          PORTHUB
        </div>
        <div style={{ fontSize: 84, fontWeight: 700, marginTop: 24 }}>{name}</div>
        <div style={{ fontSize: 36, color: "#8aa0ff", marginTop: 8 }}>{role}</div>
        <div style={{ display: "flex", gap: 14, marginTop: 40 }}>
          {langs.map((l) => (
            <div
              key={l}
              style={{
                fontSize: 24,
                color: "#c8c8d8",
                border: "1px solid #23232f",
                borderRadius: 999,
                padding: "8px 20px",
              }}
            >
              {l}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
