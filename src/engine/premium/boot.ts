import type { DesignSpec } from "../spec";
import type { ProfileData } from "../../server/profile/model";
import { escapeHtml } from "./support";

export interface BootHandle {
  finish: () => void;
}

/**
 * Boot overlay that covers the engine/WebGL load, then fades.
 *
 *   log       (engineered/cinematic/terminal) — a proper Linux/systemd boot:
 *             firmware banner → dmesg kernel log with incrementing timestamps →
 *             kernel modules → crypto/identity → systemd services → login prompt
 *             with the name decrypting out of glyph noise. Braille spinner, CRT
 *             scanlines + vignette, emerald signal only. Holds a realistic min.
 *   minimal   (serene/playful) — centered name + hairline progress
 *   stark     (raw) — huge name + heavy accent bar
 */
export function mountBoot(
  spec: DesignSpec,
  data: ProfileData,
  opts: { reduce: boolean },
): BootHandle {
  if (spec.boot === "off") return { finish: () => undefined };

  const temp = spec.generative.temperament;
  const style: "log" | "minimal" | "stark" =
    temp === "serene" || temp === "playful"
      ? "minimal"
      : temp === "raw"
        ? "stark"
        : "log";
  const rawName = data.identity.name ?? "user";
  const brand = rawName.toUpperCase();
  const name = escapeHtml(rawName);
  const startedAt =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const MIN_MS = opts.reduce ? 0 : 4600;

  // inject the blink keyframe (the engine CSS may not be applied yet)
  const blinkStyle = document.createElement("style");
  blinkStyle.textContent = "@keyframes ph-boot-blink{50%{opacity:0}}";
  document.head.appendChild(blinkStyle);

  const overlay = document.createElement("div");
  overlay.id = "ph-boot";
  const base =
    "position:fixed;inset:0;z-index:1000;background:var(--bg,#080a0a);" +
    "transition:opacity .5s ease;display:flex;flex-direction:column;";

  const bar = document.createElement("div");
  const pct = document.createElement("div");
  const spinner = document.createElement("span");

  if (style === "log") {
    overlay.style.cssText =
      base +
      "padding:clamp(20px,4vw,44px) clamp(20px,4vw,52px);" +
      "color:var(--fg,#dfe3e0);font-family:ui-monospace,'JetBrains Mono',Menlo,Consolas,monospace;";

    // CRT scanlines + vignette (behind the content)
    const scan = document.createElement("div");
    scan.style.cssText =
      "position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.13;" +
      "background:repeating-linear-gradient(0deg,rgba(0,0,0,0) 0px,rgba(0,0,0,0) 2px,rgba(0,0,0,.3) 3px,rgba(0,0,0,0) 4px);";
    const vig = document.createElement("div");
    vig.style.cssText =
      "position:absolute;inset:0;z-index:0;pointer-events:none;" +
      "background:radial-gradient(120% 100% at 50% 50%,transparent 48%,rgba(0,0,0,.45) 100%);";
    overlay.append(scan, vig);

    // top — firmware banner
    const top = document.createElement("div");
    top.style.cssText = "flex:none;position:relative;z-index:1;margin-bottom:4px;";
    const fw1 = document.createElement("div");
    fw1.style.cssText =
      "font-size:13px;font-weight:600;letter-spacing:.08em;color:var(--accent,#34d399);";
    fw1.textContent = "GHOST//SHELL";
    const fw2 = document.createElement("div");
    fw2.style.cssText =
      "font-size:10px;letter-spacing:.14em;color:var(--muted,#6a7072);margin-top:3px;";
    fw2.textContent = "BIOS v2.6  \u00b7  Copyright (C) 2026 Ghost Systems";
    top.append(fw1, fw2);

    // middle — boot log (anchored to bottom; old lines clip at top)
    const logWrap = document.createElement("div");
    logWrap.style.cssText =
      "flex:1;min-height:0;display:flex;flex-direction:column;justify-content:flex-end;" +
      "overflow:hidden;margin:16px 0;position:relative;z-index:1;";
    const log = document.createElement("div");
    log.style.cssText = "font-size:12px;line-height:1.75;";
    logWrap.appendChild(log);

    // bottom — progress + status + login
    const bottom = document.createElement("div");
    bottom.style.cssText = "flex:none;position:relative;z-index:1;";
    bar.style.cssText =
      "height:2px;width:0;transition:width .3s ease;background:var(--accent,#34d399);" +
      "box-shadow:0 0 8px color-mix(in srgb,var(--accent,#34d399) 55%,transparent);";
    const statusRow = document.createElement("div");
    statusRow.style.cssText =
      "display:flex;align-items:center;justify-content:space-between;margin-top:10px;" +
      "font-size:11px;letter-spacing:.08em;";
    pct.style.cssText = "color:var(--muted,#6a7072);";
    spinner.style.cssText =
      "color:var(--accent,#34d399);font-size:14px;line-height:1;";
    statusRow.append(pct, spinner);

    // login prompt (fades in after boot completes)
    const login = document.createElement("div");
    login.style.cssText =
      "margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.06);" +
      "font-size:13px;color:var(--fg,#dfe3e0);opacity:0;transition:opacity .35s;";
    const loginPre = document.createElement("span");
    loginPre.style.cssText = "color:var(--muted,#6a7072);";
    loginPre.textContent = "ghost login: ";
    const loginName = document.createElement("span");
    loginName.style.cssText =
      "color:var(--accent,#34d399);font-weight:600;letter-spacing:.02em;";
    login.append(loginPre, loginName);

    bottom.append(bar, statusRow, login);
    overlay.append(top, logWrap, bottom);
    document.body.appendChild(overlay);

    // ---- helpers ----
    const OK_TAG = "[  OK  ]";
    const SKIP_TAG = "[ SKIP ]";
    const ts = (s: number) => "[" + ("    " + s.toFixed(6)).slice(-10) + "]";
    const dim = (s: string) =>
      '<span style="color:var(--muted,#6a7072)">' + s + "</span>";
    const green = (s: string) =>
      '<span style="color:var(--accent,#34d399)">' + s + "</span>";

    // append one boot line; if `tag` is given it's pushed right (dmesg style).
    function bootLine(leftHtml: string, tag?: string) {
      const row = document.createElement("div");
      if (tag) {
        row.style.cssText = "display:flex;align-items:baseline;gap:12px;";
        const l = document.createElement("span");
        l.style.cssText = "flex:1;min-width:0;";
        l.innerHTML = leftHtml;
        const t = document.createElement("span");
        t.style.cssText =
          "flex:none;white-space:nowrap;color:var(--accent,#34d399);";
        t.textContent = tag;
        row.append(l, t);
      } else {
        row.innerHTML = leftHtml;
      }
      log.appendChild(row);
    }

    // ---- the boot sequence: dmesg kernel → modules → crypto → systemd → login ----
    type Step = { html: string; tag?: string };
    const steps: Step[] = [
      // dmesg — kernel
      { html: dim(ts(0.0)) + " GHOST kernel 6.6.0-ghost #1 SMP PREEMPT" },
      { html: dim(ts(0.001)) + " Memory: 16384M available / 2048M reserved" },
      { html: dim(ts(0.014)) + " CPU: 8x GHOST-CORE @ 4.2GHz" },
      { html: dim(ts(0.028)) + " NVMe GHOST-X 2TB: initialized" },
      { html: dim(ts(0.042)) + " Loading kernel modules" },
      // modules — indented, tag at end
      { html: "&nbsp;&nbsp;\u2192 vector-noise.ko", tag: OK_TAG },
      { html: "&nbsp;&nbsp;\u2192 glass-compositor.ko", tag: OK_TAG },
      { html: "&nbsp;&nbsp;\u2192 neon-shader.ko", tag: OK_TAG },
      // crypto + identity — tag at end
      { html: dim(ts(0.081)) + " Crypto: AES-256/SHA-512", tag: OK_TAG },
      { html: dim(ts(0.095)) + " Mounting /dev/identity", tag: OK_TAG },
      { html: dim(ts(0.109)) + " Encrypted uplink :443", tag: OK_TAG },
      {
        html: dim(ts(0.121)) + " Fetching profile: " + brand,
        tag: OK_TAG,
      },
      // systemd — tag at start (inline)
      { html: green(OK_TAG) + " Started Repository Indexer" },
      { html: green(OK_TAG) + " Started Render Surface (WebGL2)" },
      {
        html:
          '<span style="color:var(--muted,#6a7072)">' +
          SKIP_TAG +
          "</span> Skipped Firewall Bypass \u2014 direct route",
      },
      { html: green(OK_TAG) + " Reached Target Graphical Interface" },
    ];
    const total = steps.length;

    // braille spinner
    const SPIN = "\u280b\u2819\u2839\u2838\u283c\u2834\u2826\u2827\u2807\u280f";
    let spinI = 0;
    const spinTimer = setInterval(() => {
      spinner.textContent = SPIN[spinI % SPIN.length]!;
      spinI++;
    }, 70);

    let i = 0;
    const step = () => {
      if (i >= total) {
        // all lines shown — reveal login + decrypt the name
        clearInterval(spinTimer);
        spinner.textContent = "\u2713";
        spinner.style.opacity = ".8";
        login.style.opacity = "1";

        const GLYPHS = "01<>/\\[]{}#$%&*+=\u2591\u2592\u2593\u00a7\u00a5";
        const target = brand;
        const frames = 14;
        let f = 0;
        const decrypt = setInterval(() => {
          f++;
          const rev = Math.floor((f / frames) * target.length);
          let out = "";
          for (let c = 0; c < target.length; c++) {
            if (target[c] === " ") out += " ";
            else
              out +=
                c < rev
                  ? target[c]
                  : GLYPHS[(Math.random() * GLYPHS.length) | 0];
          }
          loginName.textContent = out;
          if (f >= frames) {
            loginName.textContent = target;
            const cursor = document.createElement("span");
            cursor.textContent = "\u2588";
            cursor.style.cssText =
              "margin-left:2px;color:var(--accent,#34d399);animation:ph-boot-blink 1s steps(2) infinite;";
            login.appendChild(cursor);
            clearInterval(decrypt);
          }
        }, 45);
        return;
      }
      const s = steps[i]!;
      bootLine(s.html, s.tag);
      bar.style.width = Math.round(((i + 1) / total) * 100) + "%";
      i++;
      if (opts.reduce) step();
      else {
        const jitter = 130 + Math.random() * 120;
        setTimeout(step, jitter);
      }
    };

    if (opts.reduce) {
      // instant — show everything at once
      while (i < total) {
        const s = steps[i]!;
        bootLine(s.html, s.tag);
        i++;
      }
      bar.style.width = "100%";
      pct.textContent = "100%";
      clearInterval(spinTimer);
      spinner.textContent = "\u2713";
      login.style.opacity = "1";
      loginName.textContent = brand;
      const cursor = document.createElement("span");
      cursor.textContent = "\u2588";
      cursor.style.cssText =
        "margin-left:2px;color:var(--accent,#34d399);animation:ph-boot-blink 1s steps(2) infinite;";
      login.appendChild(cursor);
    } else {
      step();
    }
  } else if (style === "stark") {
    overlay.style.cssText =
      base + "justify-content:center;padding:clamp(24px,7vw,90px);color:var(--fg,#dfe3e0);";
    const nameEl = document.createElement("div");
    nameEl.style.cssText =
      "font-family:var(--font-display);font-weight:800;text-transform:uppercase;" +
      "letter-spacing:-.03em;line-height:.9;font-size:clamp(2.6rem,9vw,7rem);";
    nameEl.innerHTML = name;
    bar.style.cssText =
      "height:10px;width:0;margin-top:28px;max-width:560px;background:var(--accent,#34d399);transition:width .3s ease";
    overlay.append(nameEl, bar);
    document.body.appendChild(overlay);
  } else {
    // minimal
    overlay.style.cssText =
      base +
      "justify-content:center;align-items:center;text-align:center;color:var(--fg,#dfe3e0);";
    const nameEl = document.createElement("div");
    nameEl.style.cssText =
      "font-family:var(--font-display);font-weight:700;letter-spacing:-.02em;" +
      "text-transform:uppercase;font-size:clamp(1.3rem,3vw,2rem);margin-bottom:18px;opacity:.92;";
    nameEl.innerHTML = name;
    bar.style.cssText =
      "height:2px;width:0;max-width:200px;background:var(--accent,#34d399);transition:width .35s ease;border-radius:2px;";
    overlay.append(nameEl, bar);
    document.body.appendChild(overlay);
  }

  // ---- shared progress driver for minimal/stark ----
  if (style !== "log") {
    let i = 0;
    const total = 5;
    const step = () => {
      if (i >= total) return;
      bar.style.width = Math.round(((i + 1) / total) * 100) + "%";
      i++;
      if (opts.reduce) step();
      else setTimeout(step, 150);
    };
    step();
  }

  let done = false;
  return {
    finish() {
      if (done) return;
      done = true;
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const wait = Math.max(opts.reduce ? 0 : 320, MIN_MS - (now - startedAt));
      setTimeout(() => {
        overlay.style.opacity = "0";
        setTimeout(() => {
          overlay.remove();
          blinkStyle.remove();
        }, 600);
      }, wait);
    },
  };
}
