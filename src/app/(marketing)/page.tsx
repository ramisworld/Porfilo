"use client";

import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { PorfiloWordmark } from "~/app/_components/porfilo-logo";
import { Arrow, Spinner } from "~/app/_components/icons";
import RotatingText from "~/components/reactbits/rotating-text";
import { EXAMPLES } from "../../../landing-prompts/examples";
import styles from "./proof.module.css";

// The nouns the hero cycles through — Porfilo turns a GitHub into any of these.
const HERO_NOUNS = ["portfolio", "résumé", "story", "showcase"] as const;
const HERO_SUBHEAD =
  "Every site behind this page was generated from a real public GitHub profile. Type your username and get yours.";
const HERO_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const SURPRISE_VIBE = "Surprise me — choose the strongest visual world for my work";
const VIBE_STARTERS = [
  { label: "Raw editorial", value: "Raw monochrome editorial with oversized type and sharp grids" },
  { label: "Premium OS", value: "Sophisticated premium operating system with elegant depth and motion" },
  { label: "Quiet minimal", value: "Quiet precise minimalism with warm restraint and generous space" },
  { label: "Cybernetic", value: "Dark cybernetic instrument panel with luminous signals and technical detail" },
] as const;
const PORTFOLIO_PULSE_MS = 15_000;
const PORTFOLIO_PULSE_MIN = 48;
const PORTFOLIO_PULSE_MAX = 60;
const PORTFOLIO_PULSE_CENTER = 54;
const PORTFOLIO_PULSE_BLOCKS = 10;
const PORTFOLIO_PULSE_BLOCK_SIZE = 24;

function buildPortfolioPulse(): readonly number[] {
  let seed = 0x51f15e;
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4_294_967_296;
  };
  const directions: number[] = [];

  // Each six-minute block contains exactly as many arrivals as expirations.
  // A seeded shuffle makes the movement irregular while keeping it neutral.
  for (let blockIndex = 0; blockIndex < PORTFOLIO_PULSE_BLOCKS; blockIndex += 1) {
    let block: number[] = [];
    let isSafe = false;
    for (let attempt = 0; attempt < 100 && !isSafe; attempt += 1) {
      block = [
        ...Array<number>(PORTFOLIO_PULSE_BLOCK_SIZE / 2).fill(1),
        ...Array<number>(PORTFOLIO_PULSE_BLOCK_SIZE / 2).fill(-1),
      ];
      for (let index = block.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [block[index], block[swapIndex]] = [block[swapIndex]!, block[index]!];
      }
      let probe = PORTFOLIO_PULSE_CENTER;
      isSafe = block.every((direction) => {
        probe += direction;
        return probe >= PORTFOLIO_PULSE_MIN && probe <= PORTFOLIO_PULSE_MAX;
      });
    }
    if (!isSafe) throw new Error("Unable to build a safe portfolio pulse block");
    directions.push(...block);
  }

  const pulse = [PORTFOLIO_PULSE_CENTER];
  let value = PORTFOLIO_PULSE_CENTER;
  directions.forEach((direction, index) => {
    value += direction;
    // The final move lands on the first value, so omit the duplicate endpoint.
    if (index < directions.length - 1) pulse.push(value);
  });
  const wrappedDeltas = pulse.map((count, index) => pulse[(index + 1) % pulse.length]! - count);
  const rises = wrappedDeltas.filter((delta) => delta === 1).length;
  const falls = wrappedDeltas.filter((delta) => delta === -1).length;

  if (
    value !== PORTFOLIO_PULSE_CENTER
    || pulse.some((count) => count < PORTFOLIO_PULSE_MIN || count > PORTFOLIO_PULSE_MAX)
    || rises !== falls
    || wrappedDeltas.some((delta) => Math.abs(delta) !== 1)
  ) {
    throw new Error("Invalid portfolio pulse cycle");
  }
  return pulse;
}

const PORTFOLIO_PULSE = buildPortfolioPulse();

function portfolioPulseAt(tick: number): number {
  return PORTFOLIO_PULSE[tick % PORTFOLIO_PULSE.length]!;
}

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
type FormStep = "github" | "vibe";

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
  const [formStep, setFormStep] = useState<FormStep>("github");
  const [vibe, setVibe] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Do not bake a build-time count into static HTML. Until hydration we render
  // a fixed-width placeholder, then publish the current global tick.
  const [portfolioPulse, setPortfolioPulse] = useState<{ tick: number } | null>(
    null,
  );

  const ctrlRef = useRef<AbortController | null>(null);
  const vibeRef = useRef<HTMLTextAreaElement | null>(null);

  const reduce = useReducedMotion();

  // Gate the per-character/word motion components (RotatingText, BlurText,
  // ShinyText) so the server render and first client render are identical
  // static text — motion swaps in after mount, avoiding hydration mismatches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => () => ctrlRef.current?.abort(), []);

  useEffect(() => {
    let timeout = 0;
    const syncPulse = () => {
      // Always replace the snapshot so statically rendered HTML is corrected
      // immediately after hydration, even when both sides share a time bucket.
      setPortfolioPulse({ tick: Math.floor(Date.now() / PORTFOLIO_PULSE_MS) });
      const untilNextGlobalTick = PORTFOLIO_PULSE_MS - (Date.now() % PORTFOLIO_PULSE_MS);
      timeout = window.setTimeout(syncPulse, untilNextGlobalTick + 20);
    };
    syncPulse();
    return () => window.clearTimeout(timeout);
  }, []);

  const trimmed = username.trim().replace(/^@/, "");
  const looksValid = USERNAME_RE.test(trimmed);
  const cleanVibe = vibe.trim();
  const canContinue = trimmed.length > 0 && looksValid && !submitting;
  const canGenerate = cleanVibe.length >= 10 && cleanVibe.length <= 100 && !submitting;

  const continueToVibe = async () => {
    const u = trimmed;
    if (!u || !USERNAME_RE.test(u)) {
      setFormError("Enter a valid GitHub username.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const probe = await fetch("/api/github/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: u }),
        cache: "no-store",
      });
      if (probe.status === 429) {
        setFormError("Too many checks. Give it a moment and try again.");
        return;
      }
      if (probe.status === 409) {
        window.location.assign("/dashboard");
        return;
      }
      if (!probe.ok) {
        setFormError("We couldn’t check that username. Try again.");
        return;
      }
      const { exists } = (await probe.json()) as { exists: boolean };
      if (!exists) {
        setFormError("We couldn’t find that GitHub user.");
        return;
      }
      setFormStep("vibe");
      window.setTimeout(() => vibeRef.current?.focus(), 80);
    } catch (err) {
      if (!(err instanceof Error) || err.name !== "AbortError") {
        setFormError("Network error. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const generate = async (vibeOverride?: string) => {
    const chosenVibe = (vibeOverride ?? vibe).trim();
    if (chosenVibe.length < 10 || chosenVibe.length > 100) {
      setFormError("Give us at least 10 characters so we can understand the direction.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    dispatch({ type: "START_STREAM" });
    try {
      await streamGeneration(trimmed, chosenVibe, dispatch, ctrlRef);
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
    setVibe("");
    setFormStep("github");
    setFormError(null);
  };

  return (
    <main className={styles.stage}>
      <PortfolioWall />
      <div className={styles.scrim} aria-hidden />
      <div className={styles.grain} aria-hidden />

      <motion.nav
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0 : 0.6, ease: HERO_EASE }}
        className={styles.nav}
      >
        <PorfiloWordmark
          size={22}
          textClassName="text-[0.95rem] font-semibold tracking-[-0.01em] text-white"
        />
        <div className={styles.navLinks}>
          <a href="#examples">Examples</a>
          <a href="#price">Pricing</a>
          <Link href="/sign-in">Sign in</Link>
        </div>
      </motion.nav>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0 : 0.75, delay: reduce ? 0 : 0.08, ease: HERO_EASE }}
        className={styles.hero}
      >
        <div className={styles.eyebrow}>
          <span className={styles.statusDot} />
          <span
            data-proof-pulse
            data-proof-pulse-tick={portfolioPulse?.tick ?? ""}
            data-proof-pulse-cadence={PORTFOLIO_PULSE_MS}
          >
            {portfolioPulse
              ? `${portfolioPulseAt(portfolioPulse.tick)} portfolios generated in the last hour`
              : "— portfolios generated in the last hour"}
          </span>
        </div>

        <h1>
          <span data-proof-headline-lead className={`${styles.headlineLead} ${styles.gradientText}`}>
            your work deserves a
          </span>
          <span data-proof-headline-swap className={styles.headlineSwapLine}>
            <span className={styles.flip}>
              {mounted ? (
                <RotatingText
                  texts={[...HERO_NOUNS]}
                  rotationInterval={2400}
                  staggerDuration={0.018}
                  splitBy="characters"
                  mainClassName={styles.rotatingText}
                  elementLevelClassName={styles.rotatingCharacter}
                />
              ) : (
                <b>{HERO_NOUNS[0]}</b>
              )}
            </span>
            <span data-proof-fixed-copy className={styles.gradientText}>this good.</span>
          </span>
        </h1>

        <p className={styles.subhead}>{HERO_SUBHEAD}</p>

        <div className={styles.panel} id="price">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (formStep === "github") {
                if (canContinue) void continueToVibe();
              } else if (canGenerate) {
                void generate();
              }
            }}
            noValidate
            className={formStep === "github" ? styles.field : styles.vibeForm}
          >
            <AnimatePresence mode="wait" initial={false}>
              {formStep === "github" ? (
                <motion.div
                  key="github"
                  data-proof-github-step
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className={styles.githubStep}
                >
                  <span className={styles.at}>@</span>
                  <input
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder="your-github"
                    spellCheck={false}
                    autoCapitalize="off"
                    autoCorrect="off"
                    autoComplete="off"
                    aria-label="GitHub username"
                    aria-invalid={!!formError}
                  />
                  <button type="submit" disabled={!canContinue} className={styles.generate}>
                    {submitting ? <><Spinner /> Checking</> : <>Continue <Arrow /></>}
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="vibe"
                  data-proof-vibe-step
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className={styles.vibeStep}
                >
                  <div className={styles.vibeHeader}>
                    <div>
                      <span>Creative direction</span>
                      <strong>How should it feel?</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormStep("github");
                        setFormError(null);
                      }}
                    >
                      @{trimmed} · edit
                    </button>
                  </div>
                  <div className={styles.vibeField}>
                    <textarea
                      ref={vibeRef}
                      value={vibe}
                      onChange={(e) => {
                        setVibe(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      maxLength={100}
                      rows={3}
                      aria-label="Portfolio vibe"
                      aria-describedby="vibe-help"
                      placeholder="e.g. Dark cinematic instrumentation, precise type, subtle red signals…"
                    />
                    <span>{cleanVibe.length}/100</span>
                  </div>
                  <div className={styles.vibeStarters} aria-label="Vibe starters">
                    {VIBE_STARTERS.map((starter) => (
                      <button
                        type="button"
                        key={starter.label}
                        onClick={() => {
                          setVibe(starter.value);
                          setFormError(null);
                          vibeRef.current?.focus();
                        }}
                      >
                        {starter.label}
                      </button>
                    ))}
                  </div>
                  <p id="vibe-help" className={styles.vibeHelp}>
                    Mood, era, interface, colour, energy — plain language is perfect.
                  </p>
                  <div className={styles.vibeActions}>
                    <button
                      type="button"
                      className={styles.surprise}
                      disabled={submitting}
                      onClick={() => {
                        setVibe(SURPRISE_VIBE);
                        void generate(SURPRISE_VIBE);
                      }}
                    >
                      Surprise me
                    </button>
                    <button type="submit" disabled={!canGenerate} className={styles.generate}>
                      {submitting ? <><Spinner /> Building</> : <>Build my portfolio <Arrow /></>}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
          {formError && (
            <p role="alert" className={styles.error}>
              {formError}
            </p>
          )}
        </div>
      </motion.section>

      {state.view !== "idle" && (
        <GenerationOverlay state={state} username={trimmed} vibe={cleanVibe || SURPRISE_VIBE} onReset={reset} />
      )}
    </main>
  );
}

const WALL_DURATIONS = [58, 72, 64, 78, 60] as const;
const WALL_COLUMN_STRIDE = 2;
const WALL_ITEMS_PER_COLUMN = 5;

function PortfolioWall() {
  return (
    <div className={styles.wall} id="examples" aria-label="Real generated portfolio examples">
      {WALL_DURATIONS.map((duration, columnIndex) => {
        const items = Array.from({ length: WALL_ITEMS_PER_COLUMN }, (_, itemIndex) =>
          EXAMPLES[(columnIndex * WALL_COLUMN_STRIDE + itemIndex) % EXAMPLES.length]!,
        );
        return (
          <div data-proof-column={columnIndex} className={styles.column} key={duration}>
            <div data-proof-track className={styles.track} style={{ "--duration": `${duration}s` } as React.CSSProperties}>
              {[...items, ...items].map((example, index) => (
                <figure
                  data-proof-card
                  data-proof-world={example.world}
                  className={styles.card}
                  key={`${example.handle}-${index}`}
                >
                  <Image
                    data-proof-thumb
                    src={example.thumb}
                    alt={`${example.name}'s ${example.world} portfolio example`}
                    width={example.w}
                    height={example.h}
                    loading="lazy"
                    unoptimized
                  />
                </figure>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Generation overlay (build log → claim / dashboard)
// ───────────────────────────────────────────────────────────────────────────

function GenerationOverlay({
  state,
  username,
  vibe,
  onReset,
}: {
  state: State;
  username: string;
  vibe: string;
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
      className={styles.generationOverlay}
    >
      <div className={styles.generationGrid} aria-hidden />
      <div className={styles.generationGlow} aria-hidden />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: HERO_EASE }}
        className={styles.generationStage}
      >
        {state.view === "error" ? (
          <ErrorCard error={state.error} onReset={onReset} />
        ) : (
          <BuildLog state={state} username={username} vibe={vibe} onReset={onReset} />
        )}
      </motion.div>
    </motion.div>
  );
}

function BuildLog({
  state,
  username,
  vibe,
  onReset,
}: {
  state: State;
  username: string;
  vibe: string;
  onReset: () => void;
}) {
  const activeStep = useMemo(() => {
    if (state.view === "done") return TERMINAL_STEPS.length;
    if (!state.stage) return 0;
    return STAGE_TO_STEP[state.stage] ?? 0;
  }, [state.stage, state.view]);

  const stalled = useStalledFlag(state.lastEventAt, state.view);
  const progress = state.view === "done"
    ? 100
    : Math.min(94, Math.round(((activeStep + 0.42) / TERMINAL_STEPS.length) * 100));
  const latestLog = state.log[state.log.length - 1]?.text;

  return (
    <div data-proof-build-screen className={styles.buildPanel}>
      <header className={styles.buildHeader}>
        <div><span className={styles.buildLiveDot} />Porfilo build room</div>
        <button onClick={onReset}>Cancel</button>
      </header>

      <div className={styles.buildBody}>
        <section className={styles.buildStatement}>
          <span className={styles.buildIndex}>{String(Math.min(activeStep + 1, 5)).padStart(2, "0")}</span>
          <p>{state.view === "done" ? "Your portfolio is ready." : "Building evidence, not a template."}</p>
          <dl>
            <div><dt>Profile</dt><dd>@{username}</dd></div>
            <div><dt>Direction</dt><dd>{vibe}</dd></div>
          </dl>
        </section>

        <section className={styles.buildSequence} aria-live="polite">
          <div className={styles.buildSequenceHead}>
            <span>Build sequence</span>
            <b>{progress}%</b>
          </div>
          <div className={styles.buildProgress} aria-hidden>
            <i style={{ width: `${progress}%` }} />
          </div>
          <ol>
            {TERMINAL_STEPS.map((step, idx) => {
              const done = state.view === "done" || idx < activeStep;
              const active = !done && idx === activeStep;
              return (
                <li key={step} data-status={done ? "done" : active ? "active" : "waiting"}>
                  <span>{String(idx + 1).padStart(2, "0")}</span>
                  <p>{step}</p>
                  <i>{done ? "Done" : active ? "In progress" : "Waiting"}</i>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <footer className={styles.buildFooter}>
        <span>{latestLog ?? "Preparing the build room…"}</span>
        <span>
          {state.view === "done"
            ? state.ownerless ? "Ready to claim" : "Opening dashboard"
            : stalled ? "Still working — large repos take longer" : "Keep this tab open"}
        </span>
      </footer>
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
      className={styles.buildError}
    >
      <span>Build interrupted</span>
      <h2>We couldn&apos;t finish this one.</h2>
      <p>{error ?? "Something went wrong."}</p>
      <div>
        <button onClick={onReset}>Try again</button>
        <Link href="/">Return home</Link>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// SSE consumer
// ───────────────────────────────────────────────────────────────────────────

async function streamGeneration(
  username: string,
  vibe: string,
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
    body: JSON.stringify({ username, vibe }),
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
