"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PorfiloWordmark } from "~/app/_components/porfilo-logo";

const USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export default function Landing() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [touched, setTouched] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Pre-warm the /sign-in route on mount so the first navigation is instant
  // even in dev where Next.js compiles routes on-demand.
  useEffect(() => {
    router.prefetch("/sign-in");
  }, [router]);

  // Aurora field: three drifting radial gradients on a low-DPR canvas.
  // Cheap, silky, and respects reduced-motion.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const blobs = [
      { x: 0.22, y: 0.28, r: 0.55, hue: 245, drift: 0.00012 },
      { x: 0.82, y: 0.62, r: 0.48, hue: 282, drift: 0.00009 },
      { x: 0.5, y: 0.95, r: 0.45, hue: 215, drift: 0.0001 },
    ];

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#06060a";
      ctx.fillRect(0, 0, w, h);
      for (const b of blobs) {
        const ox = reduced ? 0 : Math.sin(t * b.drift) * 0.08;
        const oy = reduced ? 0 : Math.cos(t * b.drift * 1.3) * 0.06;
        const cx = (b.x + ox) * w;
        const cy = (b.y + oy) * h;
        const r = b.r * Math.min(w, h);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `hsla(${b.hue}, 78%, 60%, 0.30)`);
        g.addColorStop(1, "hsla(0, 0%, 0%, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Cursor-tracked light through the glass card. CSS vars drive a soft
  // radial highlight + the outer aura that follows the pointer.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      el.style.setProperty("--mx", `${x}%`);
      el.style.setProperty("--my", `${y}%`);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const trimmed = username.trim().replace(/^@/, "");
  const looksValid = trimmed === "" || USERNAME_RE.test(trimmed);
  const canSubmit = trimmed.length > 0 && looksValid;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    // Username is intentionally NOT persisted — Phase 1 funnels to sign-in.
    // Direct router.push (no useTransition) so the click feels instant.
    router.push("/sign-in");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06060a] text-white antialiased [font-feature-settings:'ss01','cv11']">
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <PorfiloWordmark />
        <a
          href="/sign-in"
          className="text-sm text-white/50 transition hover:text-white"
        >
          Sign in
        </a>
      </nav>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-88px)] max-w-2xl flex-col items-center justify-center px-6 pb-24">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1 text-[10.5px] font-medium tracking-[0.18em] text-white/55 uppercase backdrop-blur-md">
          <span className="h-1 w-1 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          Now in beta
        </div>

        <h1 className="text-balance text-center text-5xl font-medium leading-[1.02] tracking-tight sm:text-6xl md:text-[72px]">
          Your GitHub,
          <br />
          <span className="bg-gradient-to-b from-white to-white/55 bg-clip-text text-transparent">
            as a portfolio.
          </span>
        </h1>
        <p className="mt-6 max-w-md text-center text-pretty text-[15px] leading-relaxed text-white/55">
          One field. One click. A living, interactive site built from your real work.
        </p>

        {/* ───── Liquid glass card ───── */}
        <div
          ref={cardRef}
          className="relative mt-12 w-full max-w-md"
          style={
            {
              "--mx": "50%",
              "--my": "0%",
            } as React.CSSProperties
          }
        >
          {/* outer aura that follows the cursor */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-6 rounded-[28px] opacity-80 blur-2xl"
            style={{
              background:
                "radial-gradient(420px circle at var(--mx) var(--my), rgba(140,150,255,0.22), transparent 60%)",
            }}
          />

          <form
            onSubmit={submit}
            noValidate
            className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] p-2 backdrop-blur-xl"
            style={{
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 0 0 1px rgba(255,255,255,0.02), 0 30px 60px -20px rgba(0,0,0,0.65)",
            }}
          >
            {/* top edge highlight */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
            />
            {/* moving sheen */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl"
              style={{
                background:
                  "radial-gradient(260px circle at var(--mx) var(--my), rgba(255,255,255,0.09), transparent 60%)",
              }}
            />

            <div className="relative flex items-center gap-1 rounded-xl bg-black/35 p-1 ring-1 ring-white/[0.04]">
              <span className="flex h-10 w-9 items-center justify-center text-[15px] text-white/35 select-none">
                @
              </span>
              <input
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (touched) setTouched(false);
                }}
                onFocus={() => router.prefetch("/sign-in")}
                placeholder="your-github"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                aria-invalid={touched && !looksValid}
                className="h-10 flex-1 bg-transparent text-[15px] tracking-tight outline-none placeholder:text-white/25"
              />
              <button
                type="submit"
                disabled={!canSubmit}
                onMouseEnter={() => router.prefetch("/sign-in")}
                className="porfilo-btn porfilo-btn-primary group disabled:cursor-not-allowed"
              >
                Generate
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden
                  className="transition-transform group-hover:translate-x-0.5"
                >
                  <path
                    d="M2 7h9m0 0L7 3m4 4l-4 4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            <p
              role={touched && !looksValid ? "alert" : undefined}
              className={`mt-2.5 px-2 text-[11.5px] transition-colors ${
                touched && !looksValid ? "text-red-300/80" : "text-white/35"
              }`}
            >
              {touched && !looksValid
                ? "That doesn’t look like a GitHub username."
                : "Email sign-in · No credit card · ~20 seconds to build"}
            </p>
          </form>
        </div>

        <div className="mt-10 flex items-center gap-5 text-[11px] tracking-wide text-white/30">
          <span>Free during beta</span>
          <span className="h-3 w-px bg-white/10" />
          <span>One template, many worlds</span>
          <span className="h-3 w-px bg-white/10" />
          <span>Your domain, later</span>
        </div>
      </section>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/70 to-transparent"
      />
    </main>
  );
}
