import type { DesignSpec } from "../spec";
import type { ProfileData } from "../../server/profile/model";
import { escapeHtml } from "./support";

export interface BootHandle {
  finish: () => void;
}

/**
 * Boot overlay that covers the engine/WebGL load, then fades. Its STYLE follows
 * the rolled temperament so the pre-load matches the page it reveals.
 *   log     (engineered/cinematic/terminal) — GHOST OS boot sequence: POST, kernel
 *           modules, encrypted uplink, identity decrypt — typed out line by line
 *           with [ OK ]/[WARN] tags, a data-stream bar, and the name decrypting
 *           out of glyph-noise. Holds a realistic minimum duration.
 *   minimal (serene/playful)               — centered name + hairline progress
 *   stark   (raw)                          — huge name + heavy accent bar
 */
export function mountBoot(
  spec: DesignSpec,
  data: ProfileData,
  opts: { reduce: boolean },
): BootHandle {
  if (spec.boot === "off") return { finish: () => undefined };

  const temp = spec.generative.temperament;
  const style =
    temp === "serene" || temp === "playful" ? "minimal" : temp === "raw" ? "stark" : "log";
  const rawName = data.identity.name ?? "user";
  const name = escapeHtml(rawName);
  const startedAt =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  // Hold the boot long enough to read as a real boot, even if the engine is ready
  // instantly. finish() resolves at max(MIN_MS, engine-ready).
  const MIN_MS = opts.reduce ? 0 : 4400;

  const overlay = document.createElement("div");
  overlay.id = "ph-boot";
  const base =
    "position:fixed;inset:0;z-index:1000;background:var(--bg,#06060a);" +
    "transition:opacity .55s ease;display:flex;flex-direction:column;";

  const log = document.createElement("div");
  const bar = document.createElement("div");
  const pct = document.createElement("div");
  const nameEl = document.createElement("div");

  if (style === "log") {
    overlay.style.cssText =
      base +
      "padding:clamp(24px,5vw,56px);color:var(--accent,#39ff14);" +
      "font-family:ui-monospace,Menlo,monospace;";

    // top — secure-shell header + the name decrypting out of glyph noise
    const top = document.createElement("div");
    top.style.cssText = "flex:none;";
    const head = document.createElement("div");
    head.style.cssText =
      "font-size:12px;letter-spacing:.34em;color:var(--accent2,#00e5ff);opacity:.85;";
    head.textContent = "GHOST_OS v2.6 :: SECURE BOOT";
    nameEl.style.cssText =
      "margin-top:14px;font-size:clamp(1.9rem,7vw,4.4rem);font-weight:800;letter-spacing:.04em;" +
      "line-height:1;color:var(--fg,#d8ffe9);text-shadow:0 0 30px var(--accent,#39ff14);";
    top.append(head, nameEl);

    // middle — the boot log, anchored to the bottom so newest lines stay visible
    const logWrap = document.createElement("div");
    logWrap.style.cssText =
      "flex:1;min-height:0;display:flex;flex-direction:column;justify-content:flex-end;" +
      "overflow:hidden;margin:22px 0;";
    log.style.cssText = "font-size:12.5px;line-height:1.85;";
    logWrap.appendChild(log);

    // bottom — data-stream bar + percentage
    const bottom = document.createElement("div");
    bottom.style.cssText = "flex:none;";
    bar.style.cssText =
      "height:3px;width:0;border-radius:2px;transition:width .3s ease;" +
      "background:linear-gradient(90deg,var(--accent,#39ff14),var(--accent2,#00e5ff));" +
      "box-shadow:0 0 16px var(--accent,#39ff14);";
    pct.style.cssText =
      "font-size:11px;letter-spacing:.22em;color:var(--accent,#39ff14);opacity:.7;margin-top:9px;";
    bottom.append(bar, pct);

    overlay.append(top, logWrap, bottom);

    // decrypt the name out of glyph noise, resolving left→right
    const GLYPHS = "01<>/\\[]{}#$%&*+=ABCDEF░▒▓§¥";
    const target = rawName.toUpperCase();
    const totalFrames = 30;
    let frame = 0;
    const tick = () => {
      frame++;
      const revealed = Math.floor((frame / totalFrames) * target.length);
      let out = "";
      for (let c = 0; c < target.length; c++) {
        if (target[c] === " ") out += " ";
        else out += c < revealed ? target[c] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      nameEl.textContent = out;
      if (frame >= totalFrames) {
        nameEl.textContent = target;
        clearInterval(decrypt);
      }
    };
    const decrypt = setInterval(tick, 60);
    if (opts.reduce) {
      clearInterval(decrypt);
      nameEl.textContent = target;
    }
  } else if (style === "stark") {
    overlay.style.cssText =
      base + "justify-content:center;padding:clamp(24px,7vw,90px);color:var(--fg,#111);";
    log.style.cssText =
      "font-family:var(--font-display);font-weight:800;text-transform:uppercase;" +
      "letter-spacing:-.03em;line-height:.9;font-size:clamp(2.6rem,9vw,7rem);";
    log.innerHTML = name;
    bar.style.cssText =
      "height:10px;width:0;margin-top:28px;max-width:560px;background:var(--accent);transition:width .3s ease";
    overlay.append(log, bar);
  } else {
    // minimal
    overlay.style.cssText =
      base + "justify-content:center;align-items:center;text-align:center;color:var(--fg,#111);";
    log.style.cssText =
      "font-family:var(--font-display);font-weight:700;letter-spacing:-.02em;" +
      "text-transform:uppercase;font-size:clamp(1.3rem,3vw,2rem);margin-bottom:18px;opacity:.92;";
    log.innerHTML = name;
    bar.style.cssText =
      "height:2px;width:0;max-width:200px;background:var(--accent);transition:width .35s ease;border-radius:2px;";
    overlay.append(log, bar);
  }
  document.body.appendChild(overlay);

  // ---- the boot sequence ----
  const ok = ' <span style="color:var(--accent2,#00e5ff)">[ OK ]</span>';
  const warn = ' <span style="color:#ffcf4a">[WARN]</span>';
  const dim = (s: string) => '<span style="color:var(--muted,#5c7a6e)">' + s + "</span>";
  const logLines =
    style === "log"
      ? [
          "GHOST BIOS v2.6 — POST ......................" + ok,
          "CPU: 8 x GHOST-CORE @ 4.20GHz ..............." + ok,
          "MEM: 16384MB ECC ..........................." + ok,
          "Initializing cryptographic subsystem ......." + ok,
          "Loading kernel modules ....................." + ok,
          dim("  &gt; mod: matrix_rain") + " ............ ok",
          dim("  &gt; mod: glass_compositor") + " ....... ok",
          dim("  &gt; mod: neon_shader") + " ............ ok",
          "Mounting /dev/identity ....................." + ok,
          "Establishing encrypted uplink .............." + ok,
          "Bypassing ICE firewall ....................." + warn,
          "  retrying on port 443 ....................." + ok,
          "Negotiating handshake [SHA-512] ............" + ok,
          `Fetching repositories for [${name}] ........` + ok,
          "Decrypting profile payload ................." + ok,
          "Compiling render surface (WebGL) ..........." + ok,
          "Spawning ghost_object ......................" + ok,
          '<span style="color:var(--accent2,#00e5ff)">ACCESS GRANTED</span> — welcome, ' + name,
        ]
      : ["", "", "", "", ""];
  const steps = logLines.length;

  let i = 0;
  const step = () => {
    if (i >= steps) return;
    if (style === "log") {
      log.innerHTML += (i ? "<br>" : "") + logLines[i];
      pct.textContent =
        Math.round(((i + 1) / steps) * 100) + "% // BOOTING GHOST_OS";
    }
    bar.style.width = Math.round(((i + 1) / steps) * 100) + "%";
    i++;
    if (opts.reduce) step();
    else {
      // ~210ms base with jitter so it reads like a real boot (~4s total)
      const jitter = 150 + Math.random() * 170;
      setTimeout(step, style === "log" ? jitter : 150);
    }
  };
  step();

  let done = false;
  return {
    finish() {
      if (done) return;
      done = true;
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const wait = Math.max(opts.reduce ? 0 : 320, MIN_MS - (now - startedAt));
      setTimeout(() => {
        overlay.style.opacity = "0";
        setTimeout(() => overlay.remove(), 600);
      }, wait);
    },
  };
}
