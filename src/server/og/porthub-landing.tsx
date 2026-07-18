import { readFile } from "node:fs/promises";
import { join } from "node:path";

const LANDING_HERO_IMAGE = join(
  process.cwd(),
  "public",
  "og",
  "porfilo-landing-hero.jpg",
);

let landingHeroBytes: Promise<Buffer> | undefined;

function readLandingHero(): Promise<Buffer> {
  landingHeroBytes ??= readFile(LANDING_HERO_IMAGE);
  return landingHeroBytes;
}

/** The approved landing-hero artwork used for Porfilo's root share card. */
export async function renderPorfiloLandingOgImage(): Promise<Response> {
  const bytes = await readLandingHero();
  return new Response(bytes, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}

/** @deprecated Use renderPorfiloLandingOgImage */
export const renderPorthubLandingOgImage = renderPorfiloLandingOgImage;
