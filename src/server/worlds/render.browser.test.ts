import { chromium, type Browser } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WORLD_CATALOG } from "./catalog";
import { renderWorld } from "./render";
import { WORLD_TEST_PROFILE } from "./test-profile";

const runBrowser = process.env.RUN_BROWSER_WORLD_TESTS === "true";

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
        expect(state.deadCredentialLinks).toBe(0);
        expect(state.experienceVisible).toBe(true);
      }

      expect(errors).toEqual([]);
      await page.close();
    }, 20_000);
  }
});
