import { chromium, type Browser } from "@playwright/test";
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
  "shoji-light-house": "shoji-light-house",
  "kinetic-type-bureau": "kinetic-type-bureau",
  "abyssal-signal-array": "abyssal-signal-array",
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
      await page.emulateMedia({ reducedMotion: "reduce" });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });

      if (world.id === "terminal-nexus") {
        await page.route("http://porfilo-assets.test/**", async (route) => {
          const path = new URL(route.request().url()).pathname;
          const asset = path.endsWith(".css")
            ? "public/engine/v3.css"
            : "public/engine/v3.js";
          await route.fulfill({ path: asset });
        });
      }
      const html = renderWorld(
        world.id,
        WORLD_TEST_PROFILE,
        "alexrivera",
        world.id === "terminal-nexus"
          ? "http://porfilo-assets.test"
          : undefined,
      );
      await page.setContent(html, { waitUntil: "domcontentloaded" });
      if (world.id === "terminal-nexus") {
        await page
          .waitForSelector(".xp-terminalNexus", {
            state: "attached",
            timeout: 15_000,
          })
          .catch(() => {
            throw new Error(
              `Terminal Nexus did not mount: ${errors.join(" | ") || "no browser error reported"}`,
            );
          });
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
          expect(state.bodyText).toMatch(/Long Form\s+Classification Model/i);
        }
        const expectedClass = EXPECTED_COLLECTION_CLASS[world.id];
        if (expectedClass) expect(state.bodyClass).toBe(expectedClass);
        expect(state.deadCredentialLinks).toBe(0);
        expect(state.experienceVisible).toBe(true);
      }

      expect(errors).toEqual([]);
      await page.close();
    }, 30_000);
  }

  it("Terminal Nexus renders the headline and optional résumé affordances", async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("http://porfilo-assets.test/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      const asset = path.endsWith(".css")
        ? "public/engine/v3.css"
        : "public/engine/v3.js";
      await route.fulfill({ path: asset });
    });
    const html = renderWorld(
      "terminal-nexus",
      {
        ...WORLD_TEST_PROFILE,
        resume: {
          url: "https://porfilo.com/api/resume/demo",
          fileName: "Rami-Resume.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
          uploadedAt: "2026-08-11T00:00:00.000Z",
        },
      },
      "alexrivera",
      "http://porfilo-assets.test",
    );
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".xp-terminalNexus", { state: "attached" });
    expect(await page.locator(".xp-tn-headline").innerText()).toContain(
      WORLD_TEST_PROFILE.identity.headline,
    );
    expect(await page.locator(".xp-tn-tkv-resume").count()).toBe(1);
    expect(await page.locator(".xp-tn-hs-row-link").count()).toBe(1);
    await page.close();
  }, 30_000);

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
      const bounds = (element: HTMLElement | null) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      };
      return {
        viewportWidth: innerWidth,
        bodyScrollWidth: document.body.scrollWidth,
        side: bounds(side),
        main: bounds(main),
        firstProject: bounds(firstProject),
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

  it("Shōji Shadow House renders only real missions and keeps its blade interaction operable", async () => {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const profile = {
      ...WORLD_TEST_PROFILE,
      projects: WORLD_TEST_PROFILE.projects
        .slice(0, 6)
        .map((project, index) => ({
          ...project,
          name:
            index === 0
              ? "ClassificationModel"
              : index === 1
                ? "A Very Long Multi Word Portfolio Name"
                : project.name,
        })),
    };
    const html = renderWorld("shoji-light-house", profile, "alexrivera");
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(80);

    const before = await page.evaluate(() => ({
      missions: document.querySelectorAll(".mission[data-mission]").length,
      orbitMarks: document.querySelectorAll(".orbit-project").length,
      nativeCursor: getComputedStyle(
        document.querySelector<HTMLElement>(".orbit-project")!,
      ).cursor,
      firstTitleIsSingle: document
        .querySelector(".mission-title")
        ?.classList.contains("single"),
      secondTitleLines: document.querySelectorAll(
        '.mission[data-mission="1"] .title-line',
      ).length,
      titlesFit: Array.from(
        document.querySelectorAll<HTMLElement>(".mission-title"),
      ).every((title) => title.scrollWidth <= title.clientWidth + 1),
    }));
    expect(before).toEqual({
      missions: 6,
      orbitMarks: 6,
      nativeCursor: "none",
      firstTitleIsSingle: true,
      secondTitleLines: 2,
      titlesFit: true,
    });

    await page.locator('.orbit-project[data-i="2"]').click();
    const selected = await page.evaluate(() => {
      const active = document.querySelector<HTMLElement>(
        ".orbit-project.active",
      );
      return {
        selectedIndex: active?.dataset.i,
        selectedPressed: active?.getAttribute("aria-pressed"),
        previewName: document.querySelector("#blade-preview strong")
          ?.textContent,
        dossierControl: document.querySelectorAll(
          '#blade-preview [data-mission-jump="2"]',
        ).length,
      };
    });
    expect(selected).toEqual({
      selectedIndex: "2",
      selectedPressed: "true",
      previewName: WORLD_TEST_PROFILE.projects[2]?.name,
      dossierControl: 1,
    });

    await page.locator('.orbit-project[data-i="2"]').press("ArrowRight");
    expect(
      await page.locator(".orbit-project.active").getAttribute("data-i"),
    ).toBe("3");

    const stage = page.locator("#blade-stage");
    const box = await stage.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box!.x + box!.width / 2 + 90,
      box!.y + box!.height / 2,
    );
    await page.mouse.up();
    const rotation = await page
      .locator("#shuriken")
      .evaluate((element) =>
        element.style.getPropertyValue("--blade-rotation"),
      );
    expect(rotation).not.toBe("");

    await page.locator("#blade-preview [data-mission-jump]").click();
    expect(
      await page.evaluate(() =>
        Math.round(
          document
            .querySelector('.mission[data-mission="3"]')!
            .getBoundingClientRect().top,
        ),
      ),
    ).toBe(53);

    await page.locator('.kage-header [data-jump="missions"]').click();
    const navigation = await page.evaluate(() => ({
      hash: location.hash,
      activeDesktop: document
        .querySelector('.kage-header [data-nav="missions"]')
        ?.classList.contains("active"),
      activeRail: document
        .querySelector('.section-rail [data-nav="missions"]')
        ?.classList.contains("active"),
      targetTop: Math.round(
        document.querySelector("#missions")!.getBoundingClientRect().top,
      ),
    }));
    expect(navigation).toEqual({
      hash: "#missions",
      activeDesktop: true,
      activeRail: true,
      targetTop: 53,
    });

    for (const section of ["arsenal", "contact", "root"]) {
      await page.locator(`.kage-header [data-jump="${section}"]`).click();
      expect(
        await page.evaluate(
          (id) => ({
            hash: location.hash,
            active: document
              .querySelector(`.kage-header [data-nav="${id}"]`)
              ?.classList.contains("active"),
          }),
          section,
        ),
      ).toEqual({ hash: `#${section}`, active: true });
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(80);
    const mobileState = await page.evaluate(() => ({
      titlesFit: Array.from(
        document.querySelectorAll<HTMLElement>(".mission-title"),
      ).every((title) => title.scrollWidth <= title.clientWidth + 1),
      navVisible: getComputedStyle(
        document.querySelector<HTMLElement>(".mobile-nav")!,
      ).display,
    }));
    expect(mobileState).toEqual({ titlesFit: true, navVisible: "grid" });

    await page.locator('.mobile-nav [data-jump="contact"]').click();
    expect(
      await page.evaluate(() => ({
        hash: location.hash,
        active: document
          .querySelector('.mobile-nav [data-nav="contact"]')
          ?.classList.contains("active"),
      })),
    ).toEqual({ hash: "#contact", active: true });

    await page.locator("#copy-mail").click();
    expect(await page.locator("#copy-state").textContent()).toContain("Copied");
    await page.close();
  });

  it("Kinetic Type Bureau renders only real files and keeps its composition machine operable", async () => {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const profile = {
      ...WORLD_TEST_PROFILE,
      projects: WORLD_TEST_PROFILE.projects.slice(0, 6),
      credentials: [],
    };
    const html = renderWorld(
      "kinetic-type-bureau",
      profile,
      "alexrivera",
    );
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(80);

    expect(
      await page.evaluate(() => ({
        files: document.querySelectorAll(".sheet[data-sheet]").length,
        tabs: document.querySelectorAll(".project-tab[data-project]").length,
        bodyClass: document.body.className,
        nativeCursor: getComputedStyle(
          document.querySelector<HTMLElement>(".project-tab")!,
        ).cursor,
        credentialsDisplay: getComputedStyle(
          document.querySelector<HTMLElement>("#open-credentials")!,
        ).display,
      })),
    ).toEqual({
      files: 6,
      tabs: 6,
      bodyClass: "kinetic-type-bureau",
      nativeCursor: "none",
      credentialsDisplay: "none",
    });

    await page.locator('.project-tab[data-project="2"]').click();
    expect(
      await page.evaluate(() => ({
        selected: document
          .querySelector(".project-tab.active")
          ?.getAttribute("data-project"),
        pressed: document
          .querySelector(".project-tab.active")
          ?.getAttribute("aria-pressed"),
        title: document.querySelector(".sheet.active .sheet-title")?.textContent,
      })),
    ).toEqual({
      selected: "2",
      pressed: "true",
      title: profile.projects[2]?.name,
    });

    await page.locator("#next").click();
    expect(
      await page.locator(".project-tab.active").getAttribute("data-project"),
    ).toBe("3");

    await page.locator('.mode[data-mode="b"]').click();
    expect(await page.locator("html").getAttribute("data-layout")).toBe("b");

    const identity = await page.locator("#identity").boundingBox();
    expect(identity).not.toBeNull();
    await page.mouse.move(
      identity!.x + identity!.width * 0.67,
      identity!.y + identity!.height * 0.47,
    );
    await page.mouse.down();
    await page.mouse.move(
      identity!.x + identity!.width * 0.16,
      identity!.y + identity!.height * 0.3,
    );
    await page.mouse.up();
    expect(await page.locator("html").getAttribute("data-layout")).toBe("a");

    await page.locator("#open-contact").click();
    expect(await page.locator("#drawer").getAttribute("aria-hidden")).toBe(
      "false",
    );
    await page.locator("#close-drawer").click();
    expect(await page.locator("#drawer").getAttribute("aria-hidden")).toBe(
      "true",
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(80);
    expect(
      await page.evaluate(() => ({
        overflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
        projectTitleFits: Array.from(
          document.querySelectorAll<HTMLElement>(".sheet-title"),
        ).every((title) => title.scrollWidth <= title.clientWidth + 1),
      })),
    ).toEqual({ overflow: 0, projectTitleFits: true });
    await page.close();
  });

  it("Abyssal Signal Array renders only real contacts and keeps its sonar operable", async () => {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const profile = {
      ...WORLD_TEST_PROFILE,
      projects: WORLD_TEST_PROFILE.projects.slice(0, 6),
      credentials: [],
    };
    const html = renderWorld(
      "abyssal-signal-array",
      profile,
      "alexrivera",
    );
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(80);

    expect(
      await page.evaluate(() => ({
        contacts: document.querySelectorAll(".signal-mark[data-project]")
          .length,
        logEntries: document.querySelectorAll(".signal-button[data-project]")
          .length,
        bodyClass: document.body.className,
        nativeCursor: getComputedStyle(
          document.querySelector<HTMLElement>(".signal-mark")!,
        ).cursor,
        webglSurface:
          Number(document.querySelector("#abyss-webgl")?.getAttribute("width")) >
          0,
        undersellingCopy: document.body.innerText.includes("Below threshold"),
      })),
    ).toEqual({
      contacts: 6,
      logEntries: 6,
      bodyClass: "abyssal-signal-array",
      nativeCursor: "none",
      webglSurface: true,
      undersellingCopy: false,
    });

    await page.locator('.signal-mark[data-project="2"]').click();
    expect(
      await page.evaluate(() => ({
        selected: document
          .querySelector(".signal-mark.active")
          ?.getAttribute("data-project"),
        pressed: document
          .querySelector(".signal-mark.active")
          ?.getAttribute("aria-pressed"),
        title: document.querySelector("#dossier-title")?.textContent,
      })),
    ).toEqual({
      selected: "2",
      pressed: "true",
      title: profile.projects[2]?.name,
    });

    await page.locator("#next-signal").click();
    expect(
      await page.locator(".signal-mark.active").getAttribute("data-project"),
    ).toBe("3");

    const wheelState = await page.locator("#sonar").evaluate((node) => {
      const before = document.querySelector("#bearing-readout")?.textContent;
      const allowed = node.dispatchEvent(
        new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true }),
      );
      return {
        allowed,
        before,
        after: document.querySelector("#bearing-readout")?.textContent,
        selected: document
          .querySelector(".signal-mark.active")
          ?.getAttribute("data-project"),
      };
    });
    expect(wheelState.allowed).toBe(true);
    expect(wheelState.after).not.toBe(wheelState.before);
    expect(wheelState.selected).toBe("3");

    const sonar = await page.locator("#sonar").boundingBox();
    expect(sonar).not.toBeNull();
    const bearingBefore = await page.locator("#bearing-readout").textContent();
    await page.mouse.move(
      sonar!.x + sonar!.width / 2,
      sonar!.y + sonar!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      sonar!.x + sonar!.width * 0.8,
      sonar!.y + sonar!.height * 0.25,
    );
    await page.mouse.up();
    expect(await page.locator("#bearing-readout").textContent()).not.toBe(
      bearingBefore,
    );

    await page.locator("#contact-hatch").click();
    expect(
      await page.locator("#hatch-drawer").getAttribute("aria-hidden"),
    ).toBe("false");
    await page.locator("#close-hatch").click();
    expect(
      await page.locator("#hatch-drawer").getAttribute("aria-hidden"),
    ).toBe("true");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(80);
    expect(
      await page.evaluate(() => ({
        overflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
        dossierTitleFits:
          document.querySelector<HTMLElement>("#dossier-title")!.scrollWidth <=
          document.querySelector<HTMLElement>("#dossier-title")!.clientWidth +
            1,
      })),
    ).toEqual({ overflow: 0, dossierTitleFits: true });
    await page.close();
  });

});
