import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// GSAP plugin policy: core + ScrollTrigger are required and ship with the npm
// package. Register defensively so a missing/blocked plugin degrades to plain
// reveals instead of crashing the page.
let scrollTriggerReady = false;
try {
  gsap.registerPlugin(ScrollTrigger);
  scrollTriggerReady = true;
} catch {
  scrollTriggerReady = false;
}

const reduce =
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Section headings wipe + rise in as they enter — the crazzy "assemble" feel. */
function headingReveals(): void {
  if (!scrollTriggerReady) return;
  // Section headings only — the hero name has its own scramble.
  const heads = Array.from(
    document.querySelectorAll<HTMLElement>("#ph-app section h2"),
  ).filter((h) => !h.closest(".xp-hero"));
  if (!heads.length) return;
  gsap.set(heads, { yPercent: 24, opacity: 0, clipPath: "inset(0 0 100% 0)" });
  ScrollTrigger.batch(heads, {
    start: "top 90%",
    onEnter: (batch) =>
      gsap.to(batch, {
        yPercent: 0,
        opacity: 1,
        clipPath: "inset(0 0 0% 0)",
        duration: 0.9,
        ease: "power4.out",
        stagger: 0.08,
        overwrite: true,
      }),
  });
}

/** Section headings decrypt out of glyph-noise as they scroll in — GHOST decode. */
function decryptHeadings(): void {
  const heads = Array.from(
    document.querySelectorAll<HTMLElement>("#ph-app .xp-tn-h2"),
  );
  if (!heads.length || typeof IntersectionObserver !== "function") return;
  const GLYPHS = "01<>/\\[]{}#$%&*+=!?~^";
  const run = (el: HTMLElement) => {
    const target = el.textContent ?? "";
    let frame = 0;
    const total = 18;
    const id = window.setInterval(() => {
      frame++;
      const rev = Math.floor((frame / total) * target.length);
      let out = "";
      for (let c = 0; c < target.length; c++) {
        const ch = target[c];
        out += ch === " " || c < rev ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (frame >= total) {
        el.textContent = target;
        window.clearInterval(id);
      }
    }, 28);
  };
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          run(e.target as HTMLElement);
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.55 },
  );
  heads.forEach((h) => io.observe(h));
}

/** Buttons/CTAs lean toward the cursor — small, premium, very "alive". */
function magneticButtons(): void {
  if (reduce || window.matchMedia?.("(hover: none)").matches) return;
  const btns = document.querySelectorAll<HTMLElement>(
    "#ph-app .xp-tn-btn, #ph-app .xp-tn-mail, #ph-app .xp-gen-btn, #ph-app .xp-action, #ph-app [data-magnetic]",
  );
  btns.forEach((b) => {
    const xTo = gsap.quickTo(b, "x", { duration: 0.4, ease: "power3" });
    const yTo = gsap.quickTo(b, "y", { duration: 0.4, ease: "power3" });
    b.addEventListener("pointermove", (e) => {
      const r = b.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.32);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.42);
    });
    b.addEventListener("pointerleave", () => {
      xTo(0);
      yTo(0);
    });
  });
}

/** Staggered reveal of every `.reveal` element + heading wipes + magnetics. */
export function initReveals(): void {
  const els = Array.from(
    document.querySelectorAll<HTMLElement>("#ph-app .reveal"),
  );

  if (els.length) {
    if (!scrollTriggerReady || reduce) {
      gsap.to(els, { opacity: 1, y: 0, duration: 0.6, stagger: 0.05 });
    } else {
      gsap.set(els, { opacity: 0, y: 36, scale: 0.985 });
      ScrollTrigger.batch(els, {
        start: "top 88%",
        onEnter: (batch) =>
          gsap.to(batch, {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.75,
            stagger: 0.07,
            ease: "power3.out",
            overwrite: true,
          }),
      });
    }
  }

  if (!reduce) headingReveals();
  if (!reduce) decryptHeadings();
  magneticButtons();
  if (scrollTriggerReady) ScrollTrigger.refresh();
}
