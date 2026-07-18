import "server-only";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { db } from "~/server/db";
import { buildPortfolioHtml } from "~/server/portfolio/render-html";
import { PORTFOLIO_HERO_IMAGE_VERSION } from "./hero-image-version";

type HeroImagePortfolio = {
  id: string;
  githubUsername: string;
  template: string;
  profileData: unknown;
  designSpec: unknown;
  engineVersion: string | null;
  code: string | null;
  ogImage: Uint8Array | null;
  ogImageFingerprint: string | null;
};

const globalState = globalThis as unknown as {
  porfiloHeroImageInflight?: Map<string, Promise<Uint8Array>>;
};

const inflight =
  globalState.porfiloHeroImageInflight ??
  new Map<string, Promise<Uint8Array>>();
globalState.porfiloHeroImageInflight = inflight;

function fingerprint(html: string): string {
  return createHash("sha256")
    .update(PORTFOLIO_HERO_IMAGE_VERSION)
    .update("\0")
    .update(html)
    .digest("hex");
}

function commandPath(command: string): string | null {
  try {
    const path = execFileSync("which", [command], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return path && existsSync(path) ? path : null;
  } catch {
    return null;
  }
}

function chromiumExecutable(): string {
  const configured = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?.trim();
  if (configured && existsSync(configured)) return configured;

  for (const command of [
    "chromium",
    "chromium-browser",
    "google-chrome-stable",
    "google-chrome",
  ]) {
    const path = commandPath(command);
    if (path) return path;
  }

  const bundled = chromium.executablePath();
  if (bundled && existsSync(bundled)) return bundled;
  throw new Error("No Chromium executable is available for hero screenshots.");
}

function withAssetBase(html: string): string {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
  const origin = root.startsWith("localhost")
    ? `http://${root}`
    : `https://${root}`;
  return html.replace("<head>", `<head><base href="${origin}/">`);
}

export async function capturePortfolioHeroJpeg(
  html: string,
): Promise<Uint8Array> {
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromiumExecutable(),
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--use-gl=swiftshader",
    ],
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 630 },
      deviceScaleFactor: 1,
      colorScheme: "dark",
    });
    // A social image needs the settled hero, never the animated boot screen.
    // Reduced motion makes engine worlds reveal synchronously, which keeps
    // headless Railway captures deterministic under CPU contention.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setContent(withAssetBase(html), {
      waitUntil: "networkidle",
      timeout: 25_000,
    });
    await page.waitForFunction(
      () =>
        Boolean(document.querySelector("#ph-app")) ||
        document.body.innerText.trim().length > 20 ||
        Boolean(document.querySelector("canvas, svg")),
      undefined,
      { timeout: 15_000 },
    );

    if (await page.locator("#ph-boot").count()) {
      // Never fail a social preview simply because a decorative boot animation
      // lingers. The hero below it is already mounted and is the artifact we
      // want to capture.
      await page
        .locator("#ph-boot")
        .waitFor({ state: "detached", timeout: 15_000 })
        .catch(async () => {
          await page.evaluate(() => document.querySelector("#ph-boot")?.remove());
        });
      await page.waitForTimeout(250);
    } else {
      // Self-contained worlds reveal their hero on their own timelines. This
      // mirrors the settled first viewport instead of capturing a blank frame.
      await page.waitForTimeout(2_300);
    }

    await page.evaluate(async () => {
      await document.fonts?.ready;
      window.scrollTo(0, 0);
    });
    return await page.screenshot({
      type: "jpeg",
      quality: 88,
      fullPage: false,
    });
  } finally {
    await browser.close();
  }
}

/**
 * Capture and persist a hero before a portfolio is shared. Generation and
 * profile edits call this explicitly so social crawlers usually only read a
 * finished JPEG from Postgres instead of creating a browser on demand.
 */
export async function primePortfolioHeroImage(
  portfolio: HeroImagePortfolio,
): Promise<void> {
  await portfolioHeroBytes(portfolio);
}

async function createAndCache(
  portfolio: HeroImagePortfolio,
  html: string,
  imageFingerprint: string,
): Promise<Uint8Array> {
  const bytes = await capturePortfolioHeroJpeg(html);
  await db.portfolio.update({
    where: { id: portfolio.id },
    data: {
      ogImage: Buffer.from(bytes),
      ogImageFingerprint: imageFingerprint,
    },
  });
  return bytes;
}

async function portfolioHeroBytes(
  portfolio: HeroImagePortfolio,
): Promise<{ bytes: Uint8Array; fingerprint: string }> {
  const html = buildPortfolioHtml(portfolio);
  if (!html) throw new Error("Portfolio HTML is unavailable.");
  const imageFingerprint = fingerprint(html);

  if (
    portfolio.ogImage?.byteLength &&
    portfolio.ogImageFingerprint === imageFingerprint
  ) {
    return { bytes: portfolio.ogImage, fingerprint: imageFingerprint };
  }

  let pending = inflight.get(imageFingerprint);
  if (!pending) {
    pending = createAndCache(portfolio, html, imageFingerprint).finally(() => {
      inflight.delete(imageFingerprint);
    });
    inflight.set(imageFingerprint, pending);
  }

  try {
    return { bytes: await pending, fingerprint: imageFingerprint };
  } catch (error) {
    // A previously captured real hero is preferable to inventing a different
    // design during a transient Chromium failure.
    if (portfolio.ogImage?.byteLength) {
      return {
        bytes: portfolio.ogImage,
        fingerprint: portfolio.ogImageFingerprint ?? imageFingerprint,
      };
    }
    throw error;
  }
}

export async function renderPortfolioHeroImage(
  portfolio: HeroImagePortfolio,
): Promise<Response> {
  const { bytes, fingerprint: imageFingerprint } =
    await portfolioHeroBytes(portfolio);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control":
        "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      ETag: `"${imageFingerprint}"`,
    },
  });
}
