"use client";

import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { PorfiloWordmark } from "~/app/_components/porfilo-logo";
import { Arrow, Spinner } from "~/app/_components/icons";
import { AuroraBackground } from "~/app/_components/aurora-background";
import BlurText from "~/components/reactbits/blur-text";
import RotatingText from "~/components/reactbits/rotating-text";
import ShinyText from "~/components/reactbits/shiny-text";

// WebGL aurora — client-only so ogl never runs on the server / hurts FCP.
const Aurora = dynamic(() => import("~/components/reactbits/aurora"), {
  ssr: false,
});

// The nouns the hero cycles through — Porfilo turns a GitHub into any of these.
const HERO_NOUNS = ["portfolio", "résumé", "story", "showcase"] as const;
const HERO_SUBHEAD =
  "Type your username. Get a living, interactive site built from your real work — in seconds.";
const HERO_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// Same regex as the server-side Zod check.
const USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

// Build-log stages map onto a fixed checklist shown to the user.
const TERMINAL_STEPS = [
  "Scanning GitHub profile",
  "Reading repositories",
  "Extracting signal",
  "Composing your site",
  "Publishing",
] as const;

type StageId = "fetching" | "curating" | "writing" | "designing" | "saving";

const STAGE_TO_STEP: Record<StageId, number> = {
  fetching: 0,
  curating: 1,
  writing: 2,
  designing: 3,
  saving: 4,
};

// ───────────────────────────────────────────────────────────────────────────
// Generation state machine
// ───────────────────────────────────────────────────────────────────────────

type View = "idle" | "stream" | "done" | "error";

interface State {
  view: View;
  stage: StageId | null;
  log: { id: number; text: string }[];
  slug: string | null;
  ownerless: boolean;
  /** One-time token required to claim an anonymous portfolio. */
  claimToken: string | null;
  error: string | null;
  lastEventAt: number;
}

type Action =
  | { type: "START_STREAM" }
  | { type: "STAGE"; stage: StageId; message?: string }
  | { type: "LOG"; message: string }
  | { type: "DONE"; slug: string; ownerless: boolean; claimToken: string | null }
  | { type: "ERROR"; error: string }
  | { type: "RESET" }
  | { type: "PING" };

let LOG_ID = 0;

const INITIAL: State = {
  view: "idle",
  stage: null,
  log: [],
  slug: null,
  ownerless: false,
  claimToken: null,
  error: null,
  lastEventAt: 0,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "START_STREAM":
      return { ...INITIAL, view: "stream", lastEventAt: Date.now() };
    case "STAGE":
      return {
        ...state,
        view: "stream",
        stage: action.stage,
        log: action.message
          ? [...state.log, { id: ++LOG_ID, text: action.message }]
          : state.log,
        lastEventAt: Date.now(),
      };
    case "LOG":
      return {
        ...state,
        log: [...state.log, { id: ++LOG_ID, text: action.message }],
        lastEventAt: Date.now(),
      };
    case "DONE":
      return {
        ...state,
        view: "done",
        slug: action.slug,
        ownerless: action.ownerless,
        claimToken: action.claimToken,
        lastEventAt: Date.now(),
      };
    case "ERROR":
      return { ...state, view: "error", error: action.error };
    case "RESET":
      return INITIAL;
    case "PING":
      return { ...state, lastEventAt: Date.now() };
  }
}

function isStageId(s: string): s is StageId {
  return s in STAGE_TO_STEP;
}

// ───────────────────────────────────────────────────────────────────────────
// Landing
// ───────────────────────────────────────────────────────────────────────────

export default function Landing() {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [username, setUsername] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  const reduce = useReducedMotion();

  // Gate the per-character/word motion components (RotatingText, BlurText,
  // ShinyText) so the server render and first client render are identical
  // static text — motion swaps in after mount, avoiding hydration mismatches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => () => ctrlRef.current?.abort(), []);

  // Cursor-tracked light through the glass card.
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
  const canSubmit = trimmed.length > 0 && looksValid && !submitting;

  const start = async () => {
    const u = trimmed;
    if (!u || !USERNAME_RE.test(u)) {
      setTouched(true);
      return;
    }
    setSubmitting(true);
    try {
      const probe = await fetch("/api/github/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: u }),
        cache: "no-store",
      });
      if (probe.status === 429) {
        setTouched(true);
        setSubmitting(false);
        return;
      }
      if (probe.status === 409) {
        window.location.assign("/dashboard");
        return;
      }
      if (!probe.ok) {
        setTouched(true);
        setSubmitting(false);
        return;
      }
      const { exists } = (await probe.json()) as { exists: boolean };
      if (!exists) {
        setTouched(true);
        setSubmitting(false);
        return;
      }

      dispatch({ type: "START_STREAM" });
      await streamGeneration(u, dispatch, ctrlRef);
    } catch (err) {
      if (!(err instanceof Error) || err.name !== "AbortError") {
        dispatch({ type: "ERROR", error: "Network error. Please try again." });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    ctrlRef.current?.abort();
    dispatch({ type: "RESET" });
    setUsername("");
    setTouched(false);
  };

  // `hidden` (the hydrated inline style) stays deterministic so it can't cause an
  // SSR mismatch — the server can't know the user's motion preference. Reduced
  // motion is honored purely through the transition (duration 0 → instant snap,
  // no visible movement), which is never serialized into the HTML.
  const container = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduce ? 0 : 0.09,
        delayChildren: reduce ? 0 : 0.12,
      },
    },
  };
  const item = {
    hidden: { opacity: 0, y: 16, filter: "blur(6px)" },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: reduce ? 0 : 0.7, ease: HERO_EASE },
    },
  };

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-bg text-fg antialiased [font-feature-settings:'ss01','cv11']">
      {/* ── Background layers (back → front) ──────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {/* WebGL aurora — top band, faded downward so the copy stays legible */}
        <div className="absolute inset-x-0 top-0 h-[85vh] opacity-70 [-webkit-mask-image:linear-gradient(to_bottom,black_8%,transparent_92%)] [mask-image:linear-gradient(to_bottom,black_8%,transparent_92%)]">
          <Aurora amplitude={1.1} blend={0.55} speed={0.7} />
        </div>
        {/* Shared soft radial glows + film grain (also used on auth surfaces) */}
        <AuroraBackground variant="indigo" />
        {/* Vignette to pull focus toward the center */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(125% 85% at 50% 0%, transparent 42%, rgba(0,0,0,0.55) 100%)",
          }}
        />
      </div>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <motion.nav
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0 : 0.6, ease: HERO_EASE }}
        className="relative z-10 mx-auto flex w-full max-w-6xl flex-none items-center justify-between px-6 py-6"
      >
        <PorfiloWordmark
          size={32}
          textClassName="bg-gradient-to-b from-white to-white/70 bg-clip-text text-[22px] font-semibold tracking-[-0.02em] text-transparent"
        />
        <Link href="/sign-in" className="text-sm text-muted transition hover:text-fg">
          Sign in
        </Link>
      </motion.nav>

      {/* ── Hero (fills the viewport) ───────────────────────────────────── */}
      <motion.section
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 pb-10 text-center"
      >
        <motion.div
          variants={item}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-white/[0.025] px-3 py-1 text-[10.5px] font-medium tracking-[0.18em] text-muted uppercase backdrop-blur-md"
        >
          <span className="h-1 w-1 rounded-full bg-success shadow-[0_0_8px_#34d399]" />
          {mounted ? (
            <ShinyText text="Beta" speed={4} className="tracking-[0.18em]" />
          ) : (
            "Beta"
          )}
        </motion.div>

        <motion.h1
          variants={item}
          className="text-balance text-center text-5xl font-medium leading-[1.02] tracking-tight sm:text-6xl md:text-[72px]"
        >
          <span className="block bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
            Your GitHub,
          </span>
          <span className="mt-1 flex items-center justify-center gap-[0.28em]">
            <span className="text-white/80">as a</span>
            {/* Fixed-width cell: invisible sizers reserve the widest word's width so
                "as a" stays put — only the rotating word moves (vertically). */}
            <span className="grid items-center">
              {HERO_NOUNS.map((n) => (
                <span
                  key={n}
                  aria-hidden
                  className="invisible col-start-1 row-start-1 py-[0.08em] leading-[1.05] whitespace-nowrap"
                >
                  {n}
                </span>
              ))}
              <span className="col-start-1 row-start-1 justify-self-start overflow-hidden py-[0.08em] leading-[1.05]">
                {mounted ? (
                  <RotatingText
                    texts={[...HERO_NOUNS]}
                    rotationInterval={2200}
                    staggerDuration={0.018}
                    splitBy="characters"
                    layoutAnimation={false}
                    mainClassName="justify-start"
                    elementLevelClassName="bg-gradient-to-b from-white to-[#a78bfa] bg-clip-text text-transparent"
                  />
                ) : (
                  <span className="bg-gradient-to-b from-white to-[#a78bfa] bg-clip-text text-transparent">
                    {HERO_NOUNS[0]}
                  </span>
                )}
              </span>
            </span>
          </span>
        </motion.h1>

        {mounted ? (
          <BlurText
            text={HERO_SUBHEAD}
            animateBy="words"
            delay={26}
            className="mt-6 max-w-md justify-center text-pretty text-[15px] leading-relaxed text-muted"
          />
        ) : (
          <p className="blur-text mt-6 flex max-w-md flex-wrap justify-center text-pretty text-[15px] leading-relaxed text-muted">
            {HERO_SUBHEAD}
          </p>
        )}

        {/* Glass input card */}
        <motion.div
          variants={item}
          ref={cardRef}
          className="porfilo-glow-card relative mt-12 w-full max-w-md rounded-2xl"
          style={{ "--mx": "50%", "--my": "0%" } as React.CSSProperties}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-6 rounded-[28px] opacity-80 blur-2xl"
            style={{
              background:
                "radial-gradient(420px circle at var(--mx) var(--my), rgba(140,150,255,0.22), transparent 60%)",
            }}
          />
          <span aria-hidden className="porfilo-glow-ring rounded-2xl" />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) void start();
            }}
            noValidate
            className="relative overflow-hidden rounded-2xl border border-border bg-surface p-2 backdrop-blur-xl shadow-glass"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-2xl"
              style={{
                background:
                  "radial-gradient(260px circle at var(--mx) var(--my), rgba(255,255,255,0.09), transparent 60%)",
              }}
            />
            <div className="relative flex items-center gap-1 rounded-xl bg-well p-1 ring-1 ring-border-faint">
              <span className="flex h-10 w-9 items-center justify-center text-[15px] text-faint select-none">
                @
              </span>
              <input
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (touched) setTouched(false);
                }}
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
                className="porfilo-btn porfilo-btn-primary group disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Spinner />
                    Checking
                  </>
                ) : (
                  <>
                    Generate
                    <span className="transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-active:translate-x-1">
                      <Arrow />
                    </span>
                  </>
                )}
              </button>
            </div>
            <p
              role={touched && !looksValid ? "alert" : undefined}
              className={`mt-2.5 px-2 text-[11.5px] transition-colors ${
                touched && !looksValid ? "text-red-300/80" : "text-faint"
              }`}
            >
              {touched && !looksValid
                ? "That doesn't look like a GitHub username."
                : "Free during beta · ~20 seconds · No account needed to start"}
            </p>
          </form>
        </motion.div>

        <motion.div
          variants={item}
          className="mt-10 flex items-center gap-5 text-[11px] tracking-wide text-white/30"
        >
          <span>Real repos, curated</span>
          <span className="h-3 w-px bg-white/10" />
          <span>Interactive, not static</span>
          <span className="h-3 w-px bg-white/10" />
          <span>Your domain, later</span>
        </motion.div>
      </motion.section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="relative z-10 mx-auto flex w-full max-w-6xl flex-none flex-col items-center justify-between gap-4 px-6 py-6 sm:flex-row">
        <div className="flex items-center gap-6 text-[12px] text-faint">
          <span>© {new Date().getFullYear()} Porfilo</span>
        </div>
        <div className="flex items-center gap-6 text-[12px]">
          <Link href="/privacy" className="text-muted transition hover:text-fg">
            Privacy
          </Link>
          <Link href="/terms" className="text-muted transition hover:text-fg">
            Terms
          </Link>
          <a
            href="https://github.com/porfilo"
            target="_blank"
            rel="noreferrer"
            className="text-muted transition hover:text-fg"
          >
            GitHub
          </a>
        </div>
      </footer>

      {/* ── Generation overlay ──────────────────────────────────────────── */}
      {state.view !== "idle" && (
        <GenerationOverlay state={state} username={trimmed} onReset={reset} />
      )}
    </main>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Generation overlay (build log → claim / dashboard)
// ───────────────────────────────────────────────────────────────────────────

function GenerationOverlay({
  state,
  username,
  onReset,
}: {
  state: State;
  username: string;
  onReset: () => void;
}) {
  // On completion we move the visitor straight on — no intermediate preview /
  // claim card. Authed users land on their dashboard; anonymous users go create
  // an account to claim the freshly-built portfolio. The one-time claim token
  // rides along in the callback URL so ownership stays bound to this browser's
  // generation through the sign-in round trip.
  useEffect(() => {
    if (state.view !== "done" || !state.slug) return;
    const next = `/claim?slug=${encodeURIComponent(state.slug)}${
      state.claimToken ? `&ct=${encodeURIComponent(state.claimToken)}` : ""
    }`;
    const target = state.ownerless
      ? `/sign-in?next=${encodeURIComponent(next)}`
      : "/dashboard";
    const t = window.setTimeout(() => window.location.assign(target), 650);
    return () => window.clearTimeout(t);
  }, [state.view, state.ownerless, state.slug, state.claimToken]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: HERO_EASE }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/85 px-6 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: HERO_EASE }}
        className="w-full max-w-md"
      >
        {state.view === "error" ? (
          <ErrorCard error={state.error} onReset={onReset} />
        ) : (
          <BuildLog state={state} username={username} onReset={onReset} />
        )}
      </motion.div>
    </motion.div>
  );
}

function BuildLog({
  state,
  username,
  onReset,
}: {
  state: State;
  username: string;
  onReset: () => void;
}) {
  const activeStep = useMemo(() => {
    if (state.view === "done") return TERMINAL_STEPS.length;
    if (!state.stage) return 0;
    return STAGE_TO_STEP[state.stage] ?? 0;
  }, [state.stage, state.view]);

  const stalled = useStalledFlag(state.lastEventAt, state.view);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-bg-elevated/90 backdrop-blur-2xl shadow-glass">
      {/* Scanline + grid texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.3]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 4px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Header */}
      <div className="relative flex items-center justify-between border-b border-border-subtle px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          <p className="font-mono text-[11px] tracking-[0.16em] text-muted uppercase">
            porfilo · build
          </p>
        </div>
        <button
          onClick={onReset}
          className="text-[11px] text-faint transition hover:text-muted-2"
        >
          Cancel
        </button>
      </div>

      {/* Username line */}
      <div className="relative px-5 pt-4">
        <p className="font-mono text-[13px] text-white/70">
          <span className="text-success/70">$</span> build{" "}
          <span className="text-white">@{username}</span>
        </p>
      </div>

      {/* Steps */}
      <div
        className="relative space-y-2.5 px-5 py-4 font-mono text-[13px]"
        aria-live="polite"
      >
        {TERMINAL_STEPS.map((step, idx) => {
          const done = state.view === "done" || idx < activeStep;
          const active = !done && idx === activeStep;
          return (
            <div
              key={step}
              className={`flex items-center gap-3 transition-colors duration-500 ${
                done ? "text-success" : active ? "text-white" : "text-white/25"
              }`}
            >
              <span className="w-4 shrink-0 text-center text-[11px]">
                {done ? "✓" : active ? "›" : "·"}
              </span>
              <span className={done ? "line-through decoration-success/30" : ""}>
                {step}
              </span>
              {active && (
                <span className="ml-0.5 inline-block h-3.5 w-[7px] animate-pulse bg-success/90" />
              )}
            </div>
          );
        })}
      </div>

      {/* Live log line (while building) */}
      {state.view !== "done" && state.log.length > 0 && (
        <p className="relative border-t border-border-faint px-5 py-3 font-mono text-[11px] text-white/40">
          {state.log[state.log.length - 1]!.text}
        </p>
      )}

      {state.view === "done" ? (
        <p className="relative flex items-center gap-2.5 border-t border-border-faint px-5 py-3.5 font-mono text-[11.5px] text-success/90">
          <Spinner tone="onDark" />
          {state.ownerless
            ? "Ready — create your account to claim it…"
            : "Ready — opening your dashboard…"}
        </p>
      ) : (
        stalled && (
          <p className="relative px-5 pb-4 font-mono text-[11px] text-warn/70">
            Still working — large repos can take a moment.
          </p>
        )
      )}
    </div>
  );
}

function ErrorCard({
  error,
  onReset,
}: {
  error: string | null;
  onReset: () => void;
}) {
  return (
    <div
      role="alert"
      className="w-full rounded-2xl border border-red-500/25 bg-red-500/[0.04] p-6 backdrop-blur-xl"
    >
      <p className="font-medium text-red-300">Couldn&apos;t generate</p>
      <p className="mt-1 text-sm text-muted">
        {error ?? "Something went wrong."}
      </p>
      <div className="mt-5 flex gap-3 text-sm">
        <button
          onClick={onReset}
          className="porfilo-btn porfilo-btn-primary px-3.5"
        >
          Try again
        </button>
        <Link href="/" className="porfilo-btn porfilo-btn-secondary px-3.5">
          Home
        </Link>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// SSE consumer
// ───────────────────────────────────────────────────────────────────────────

async function streamGeneration(
  username: string,
  dispatch: React.Dispatch<Action>,
  ctrlRef: React.MutableRefObject<AbortController | null>,
) {
  ctrlRef.current?.abort();
  const ctrl = new AbortController();
  ctrlRef.current = ctrl;

  let finished = false;

  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username }),
    cache: "no-store",
    signal: ctrl.signal,
  });

  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => null)) as {
      error?: string;
      code?: string;
    } | null;
    if (res.status === 409 && data?.code === "quota_reached") {
      window.location.assign("/dashboard");
      return;
    }
    dispatch({
      type: "ERROR",
      error: data?.error ?? `Request failed (${res.status}).`,
    });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const trimmedBlock = block.trim();
      if (!trimmedBlock) continue;
      if (trimmedBlock.startsWith(":")) {
        dispatch({ type: "PING" });
        continue;
      }
      if (!trimmedBlock.startsWith("data:")) continue;

      let ev: {
        stage: string;
        message?: string;
        slug?: string;
        ownerless?: boolean;
        claimToken?: string;
        error?: string;
        code?: string;
      };
      try {
        ev = JSON.parse(trimmedBlock.slice(5).trim()) as typeof ev;
      } catch {
        continue;
      }

      if (ev.stage === "open") continue;

      if (ev.stage === "error") {
        finished = true;
        if (ev.code === "github_not_found") {
          dispatch({
            type: "ERROR",
            error:
              "We couldn't find that GitHub user. Check spelling and try again.",
          });
        } else if (ev.code === "quota_reached") {
          window.location.assign("/dashboard");
        } else {
          dispatch({ type: "ERROR", error: ev.error ?? "Generation failed." });
        }
        ctrl.abort();
        return;
      }

      if (ev.stage === "done" && ev.slug) {
        finished = true;
        dispatch({
          type: "DONE",
          slug: ev.slug,
          ownerless: ev.ownerless ?? false,
          claimToken: ev.claimToken ?? null,
        });
        return;
      }

      if (isStageId(ev.stage)) {
        dispatch({ type: "STAGE", stage: ev.stage, message: ev.message });
      } else if (ev.message) {
        dispatch({ type: "LOG", message: ev.message });
      }
    }
  }

  if (!finished) {
    dispatch({
      type: "ERROR",
      error: "The build ended unexpectedly. Please try again.",
    });
  }
}

function useStalledFlag(lastEventAt: number, view: View) {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (view !== "stream") return;
    const id = window.setInterval(() => force(), 3000);
    return () => window.clearInterval(id);
  }, [view]);
  if (view !== "stream") return false;
  if (!lastEventAt) return false;
  return Date.now() - lastEventAt > 18_000;
}
