import { chromium, type Browser } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WORLD_CATALOG } from "./catalog";
import { renderWorld } from "./render";
import { WORLD_TEST_PROFILE } from "./test-profile";

const runBrowser = process.env.RUN_BROWSER_WORLD_TESTS === "true";

const EXPECTED_COLLECTION_CLASS: Partial<Record<string, string>> = {
  "variable-type-foundry": "v-type",
  "isometric-microcity": "v-city",
  "modular-synthesizer": "v-synth",
  "electromechanical-pinball": "v-pinball",
  "digital-loom": "v-loom",
  "climate-engine": "v-climate",
  "zen-systems-garden": "v-zen",
  darkroom: "v-darkroom",
  "kinetic-sculpture-garden": "v-sculpture",
  "seismic-archive": "v-seismic",
  "living-blueprint": "v-blueprint",
  "signal-studio": "v-signal",
  "shadowbox-theatre": "v-shadowbox",
  "bioluminescent-field-guide": "v-biolume",
  "grand-complication": "v-timepiece",
  "neural-aperture": "v-aperture",
  "neural-chromatic": "v-chromatic",
  "neural-dither": "v-dither",
  "neural-gravity": "v-gravity",
  "neural-magnetic": "v-magnetic",
  "liquid-chrome-monolith": "v-chrome",
  "impossible-architecture": "v-architecture",
  "agent-colony": "v-colony",
  "paper-cinema": "v-cinema",
  "aerodynamic-laboratory": "v-aero",
  "memory-palace": "v-memory",
  "kinetic-bauhaus-factory": "v-bauhaus",
  "polar-night-expedition": "v-polar",
};

describe.skipIf(!runBrowser).sequential("browser world regression loop", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser?.close();
  });

  for (const world of WORLD_CATALOG) {
    it(`${world.name} has no runtime errors or viewport overflow`, async () => {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
      });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });

      if (world.id === "terminal-nexus") {
        await page.route("http://localhost:3000/**", (route) => {
          const pathname = new URL(route.request().url()).pathname;
          if (pathname === "/engine/v3.js") {
            return route.fulfill({
              contentType: "text/javascript",
              body: readFileSync(join(process.cwd(), "public/engine/v3.js")),
            });
          }
          if (pathname === "/engine/v3.css") {
            return route.fulfill({
              contentType: "text/css",
              body: readFileSync(join(process.cwd(), "public/engine/v3.css")),
            });
          }
          return route.fulfill({ status: 204, body: "" });
        });
      }

      let html = renderWorld(world.id, WORLD_TEST_PROFILE, "alexrivera");
      if (world.id === "terminal-nexus") {
        html = html.replace(
          "<head>",
          '<head><base href="http://localhost:3000/">',
        );
      }
      await page.setContent(html, { waitUntil: "domcontentloaded" });
      if (world.id === "terminal-nexus") {
        await page.waitForSelector(".xp-terminalNexus", { timeout: 5_000 });
      } else {
        await page.waitForTimeout(180);
      }

      for (const width of [1440, 390]) {
        await page.setViewportSize({
          width,
          height: width === 390 ? 844 : 900,
        });
        await page.waitForTimeout(40);
        const state = await page.evaluate(() => ({
          overflow:
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
          bodyText: document.body.innerText,
          bodyClass: document.body.className,
          deadCredentialLinks: document.querySelectorAll('a[href="#"]').length,
          experienceVisible: Boolean(
            document.querySelector("#porfilo-experience"),
          ),
          overflowSources: [...document.querySelectorAll<HTMLElement>("body *")]
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              return (
                rect.right > document.documentElement.clientWidth + 2 ||
                rect.left < -2
              );
            })
            .slice(0, 8)
            .map((element) => ({
              tag: element.tagName,
              className: element.className,
              left: Math.round(element.getBoundingClientRect().left),
              right: Math.round(element.getBoundingClientRect().right),
              scrollWidth: element.scrollWidth,
              clientWidth: element.clientWidth,
            })),
          wideSources: [
            document.documentElement,
            document.body,
            ...document.querySelectorAll<HTMLElement>("body *"),
          ]
            .filter((element) => element.scrollWidth > element.clientWidth + 2)
            .slice(0, 12)
            .map((element) => ({
              tag: element.tagName,
              className: element.className,
              scrollWidth: element.scrollWidth,
              clientWidth: element.clientWidth,
            })),
        }));
        expect(
          state.overflow,
          JSON.stringify({
            positioned: state.overflowSources,
            wide: state.wideSources,
          }),
        ).toBeLessThanOrEqual(2);
        expect(state.bodyText).not.toMatch(/\b(?:undefined|NaN|Infinity)\b/);
        if (world.id !== "terminal") {
          expect(state.bodyText).toMatch(/Long Form Classification Model/i);
        }
        const expectedClass = EXPECTED_COLLECTION_CLASS[world.id];
        if (expectedClass) expect(state.bodyClass).toBe(expectedClass);
        expect(state.deadCredentialLinks).toBe(0);
        expect(state.experienceVisible).toBe(true);
      }

      expect(errors).toEqual([]);
      await page.close();
    }, 20_000);
  }

  it("Variable Type Foundry keeps a long unbroken identity and project rail reachable", async () => {
    const page = await browser.newPage({
      viewport: { width: 1512, height: 868 },
    });
    const profile = {
      ...WORLD_TEST_PROFILE,
      identity: {
        ...WORLD_TEST_PROFILE.identity,
        name: "joshwong197",
        headline:
          "Builds data tools and integration servers for New Zealand corporate records, legislation APIs, and document processing.",
      },
    };
    const html = renderWorld("variable-type-foundry", profile, "joshwong197");
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(80);

    const state = await page.evaluate(() => {
      const side = document.querySelector<HTMLElement>(".ty-side");
      const main = document.querySelector<HTMLElement>(".ty-main");
      const firstProject = document.querySelector<HTMLElement>(".ty-card");
      return {
        viewportWidth: innerWidth,
        bodyScrollWidth: document.body.scrollWidth,
        side: side?.getBoundingClientRect().toJSON(),
        main: main?.getBoundingClientRect().toJSON(),
        firstProject: firstProject?.getBoundingClientRect().toJSON(),
        projectCount: document.querySelectorAll(".ty-card").length,
      };
    });

    expect(state.projectCount).toBe(9);
    expect(state.bodyScrollWidth).toBeLessThanOrEqual(state.viewportWidth + 2);
    expect(state.main?.right).toBeLessThanOrEqual(state.viewportWidth + 2);
    expect(state.side?.left).toBeLessThan(state.viewportWidth);
    expect(state.side?.right).toBeLessThanOrEqual(state.viewportWidth + 2);
    expect(state.firstProject?.left).toBeLessThan(state.viewportWidth);
    await page.close();
  });
});
