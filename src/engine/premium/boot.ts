import type { DesignSpec } from "../spec";
import type { ProfileData } from "../../server/profile/model";
import { escapeHtml } from "./support";

export interface BootHandle {
  finish: () => void;
}

/**
 * Boot overlay that covers the engine/WebGL load, then fades. Its STYLE follows
 * the rolled temperament so the pre-load matches the page it reveals — a serene
 * portfolio shouldn't open with fake BIOS logs.
 *   log     (engineered/cinematic/terminal) — system boot log + scan bar
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
  const name = escapeHtml(data.identity.name ?? "user");

  const overlay = document.createElement("div");
  overlay.id = "ph-boot";
  const base =
    "position:fixed;inset:0;z-index:1000;background:var(--bg,#06060a);" +
    "transition:opacity .6s ease;display:flex;flex-direction:column;";
  overlay.style.cssText =
    base +
    (style === "log"
      ? "justify-content:flex-end;padding:48px;color:var(--accent,#39ff14);font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.8;"
      : style === "stark"
        ? "justify-content:center;padding:clamp(24px,7vw,90px);color:var(--fg,#111);"
        : "justify-content:center;align-items:center;text-align:center;color:var(--fg,#111);");

  const log = document.createElement("div");
  const bar = document.createElement("div");

  if (style === "log") {
    bar.style.cssText =
      "height:2px;width:0;margin-top:18px;background:var(--accent,#39ff14);" +
      "box-shadow:0 0 14px var(--accent,#39ff14);transition:width .25s ease";
    overlay.append(log, bar);
  } else if (style === "stark") {
    log.style.cssText =
      "font-family:var(--font-display);font-weight:800;text-transform:uppercase;" +
      "letter-spacing:-.03em;line-height:.9;font-size:clamp(2.6rem,9vw,7rem);";
    log.innerHTML = name;
    bar.style.cssText =
      "height:10px;width:0;margin-top:28px;max-width:560px;background:var(--accent);transition:width .3s ease";
    overlay.append(log, bar);
  } else {
    // minimal
    log.style.cssText =
      "font-family:var(--font-display);font-weight:700;letter-spacing:-.02em;" +
      "text-transform:uppercase;font-size:clamp(1.3rem,3vw,2rem);margin-bottom:18px;opacity:.92;";
    log.innerHTML = name;
    bar.style.cssText =
      "height:2px;width:0;max-width:200px;background:var(--accent);transition:width .35s ease;border-radius:2px;";
    overlay.append(log, bar);
  }
  document.body.appendChild(overlay);

  const logLines = [
    "INIT BIOS... OK",
    "MOUNTING VFS... OK",
    "CONNECTING TO DATA_CORE... OK",
    `FETCHING REPOS FOR [${name}]... OK`,
    "RENDERING UI... OK",
  ];
  const steps = style === "log" ? logLines.length : 5;

  let i = 0;
  const step = () => {
    if (i >= steps) return;
    if (style === "log") log.innerHTML += (i ? "<br>" : "") + logLines[i];
    bar.style.width = Math.round(((i + 1) / steps) * 100) + "%";
    i++;
    if (opts.reduce) step();
    else setTimeout(step, style === "log" ? 170 : 150);
  };
  step();

  let done = false;
  return {
    finish() {
      if (done) return;
      done = true;
      setTimeout(
        () => {
          overlay.style.opacity = "0";
          setTimeout(() => overlay.remove(), 650);
        },
        opts.reduce ? 0 : 350,
      );
    },
  };
}
