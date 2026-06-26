"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

// Same regex as the server-side Zod check.
const USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

const VIBE_EXAMPLES = [
  "dark hacker terminal, neon green, minimal",
  "warm editorial magazine, serif, lots of whitespace",
  "brutalist black & white with huge type",
  "glassy futuristic, soft gradients, floating cards",
  "retro 8-bit arcade with a starfield background",
];

const PIPELINE = [
  { id: "fetching", label: "Reading your GitHub" },
  { id: "curating", label: "Curating your best work" },
  { id: "writing", label: "Writing your story" },
  { id: "designing", label: "Designing your site" },
  { id: "saving", label: "Publishing" },
] as const;
type StageId = (typeof PIPELINE)[number]["id"];

// Three top-level views:
//  - "form":    inputs visible, no request in flight
//  - "stream":  SSE running; show the build log
//  - "done":    redirecting to the published portfolio
type View = "form" | "stream" | "done";

interface State {
  view: View;
  stage: StageId | null;
  log: { id: number; text: string }[];
  slug: string | null;
  // Form-level inline error (rendered next to the inputs).
  formError: string | null;
  // Mid-stream error (rendered inside the build-log view).
  streamError: string | null;
  lastEventAt: number;
}

type Action =
  | { type: "START_STREAM" }
  | { type: "STAGE"; stage: StageId; message?: string }
  | { type: "LOG"; message: string }
  | { type: "DONE"; slug: string }
  | { type: "FORM_ERROR"; error: string }
  | { type: "STREAM_ERROR"; error: string }
  | { type: "RESET_TO_FORM" }
  | { type: "PING" };

let LOG_ID = 0;

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "START_STREAM":
      return {
        view: "stream",
        stage: null,
        log: [],
        slug: null,
        formError: null,
        streamError: null,
        lastEventAt: Date.now(),
      };
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
      return { ...state, view: "done", slug: action.slug, lastEventAt: Date.now() };
    case "FORM_ERROR":
      return { ...state, view: "form", formError: action.error };
    case "STREAM_ERROR":
      return { ...state, view: "stream", streamError: action.error };
    case "RESET_TO_FORM":
      return { ...state, view: "form", streamError: null };
    case "PING":
      return { ...state, lastEventAt: Date.now() };
  }
}

const INITIAL: State = {
  view: "form",
  stage: null,
  log: [],
  slug: null,
  formError: null,
  streamError: null,
  lastEventAt: 0,
};

function isStageId(s: string): s is StageId {
  return PIPELINE.some((p) => p.id === s);
}

// ───────────────────────────────────────────────────────────────────────────
// Root client
// ───────────────────────────────────────────────────────────────────────────

export function GenerateClient() {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [username, setUsername] = useState("");
  const [vibe, setVibe] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Abort handle for in-flight requests when the user navigates away.
  const ctrlRef = useRef<AbortController | null>(null);
  useEffect(() => () => ctrlRef.current?.abort(), []);

  // Fire the build pipeline. Pre-flight validates the GitHub username so we
  // don't even open the SSE stream on a typo.
  const start = async (uRaw: string, vRaw: string) => {
    const u = uRaw.trim().replace(/^@/, "");
    const v = vRaw.trim();

    if (!u || !USERNAME_RE.test(u)) {
      dispatch({
        type: "FORM_ERROR",
        error: "Enter a valid GitHub username (letters, numbers, dashes).",
      });
      return;
    }
    if (v.length < 3) {
      dispatch({ type: "FORM_ERROR", error: "Describe the vibe in a few words." });
      return;
    }

    setSubmitting(true);

    try {
      // ── Pre-flight: does this GitHub user exist? ────────────────────────
      const probe = await fetch("/api/github/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: u }),
        cache: "no-store",
      });
      if (probe.status === 429) {
        dispatch({
          type: "FORM_ERROR",
          error: "Too many checks. Wait a moment and try again.",
        });
        setSubmitting(false);
        return;
      }
      // 409 → user already owns a portfolio. The server is authoritative;
      // refresh so the page swaps to the BetaCap view.
      if (probe.status === 409) {
        window.location.reload();
        return;
      }
      if (!probe.ok) {
        const data = (await probe.json().catch(() => null)) as {
          error?: string;
        } | null;
        dispatch({
          type: "FORM_ERROR",
          error: data?.error ?? "We couldn't check that username. Try again.",
        });
        setSubmitting(false);
        return;
      }
      const { exists } = (await probe.json()) as { exists: boolean };
      if (!exists) {
        dispatch({
          type: "FORM_ERROR",
          error: "We couldn't find that GitHub user. Check spelling and try again.",
        });
        setSubmitting(false);
        return;
      }

      // ── Pre-flight OK → open the build-log view and start SSE ───────────
      dispatch({ type: "START_STREAM" });
      await streamGeneration(u, v, dispatch, ctrlRef);
    } catch (err) {
      const message =
        err instanceof Error && err.name !== "AbortError"
          ? err.message
          : "Network error. Please try again.";
      if (!(err instanceof Error) || err.name !== "AbortError") {
        dispatch({ type: "FORM_ERROR", error: message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (state.view === "form") {
    return (
      <GenerateForm
        username={username}
        vibe={vibe}
        onUsername={setUsername}
        onVibe={setVibe}
        error={state.formError}
        submitting={submitting}
        onSubmit={() => void start(username, vibe)}
      />
    );
  }

  return (
    <BuildLog
      state={state}
      username={username}
      onRetry={() => {
        ctrlRef.current?.abort();
        dispatch({ type: "RESET_TO_FORM" });
      }}
    />
  );
}

// ───────────────────────────────────────────────────────────────────────────
// SSE consumer (kept close to the previous Phase-1 behavior)
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
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    dispatch({
      type: "STREAM_ERROR",
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
      const trimmed = block.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith(":")) {
        dispatch({ type: "PING" });
        continue;
      }
      if (!trimmed.startsWith("data:")) continue;

      let ev: {
        stage: string;
        message?: string;
        slug?: string;
        error?: string;
        code?: string;
      };
      try {
        ev = JSON.parse(trimmed.slice(5).trim()) as typeof ev;
      } catch {
        continue;
      }

      if (ev.stage === "open") continue;

      if (ev.stage === "error") {
        finished = true;
        if (ev.code === "github_not_found") {
          // Typed not-found → put the user back on the form with the inline
          // error (matches the pre-flight UX).
          dispatch({
            type: "FORM_ERROR",
            error:
              "We couldn't find that GitHub user. Check spelling and try again.",
          });
        } else if (ev.code === "quota_reached") {
          // Server-side beta cap (race-loser). Refresh to the BetaCap view.
          window.location.reload();
        } else {
          dispatch({
            type: "STREAM_ERROR",
            error: ev.error ?? "Generation failed.",
          });
        }
        ctrl.abort();
        return;
      }

      if (ev.stage === "done" && ev.slug) {
        finished = true;
        dispatch({ type: "DONE", slug: ev.slug });
        const target = `${window.location.protocol}//${ev.slug}.${ROOT_DOMAIN}`;
        // Brief paint of the "redirecting" state before we leave.
        window.setTimeout(() => {
          window.location.href = target;
        }, 300);
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
      type: "STREAM_ERROR",
      error: "The build ended unexpectedly. Please try again.",
    });
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Form view
// ───────────────────────────────────────────────────────────────────────────

function useTypewriter(phrases: string[]) {
  const [text, setText] = useState("");
  const i = useRef(0);
  const j = useRef(0);
  const deleting = useRef(false);

  useEffect(() => {
    const tick = () => {
      const phrase = phrases[i.current % phrases.length]!;
      if (!deleting.current) {
        j.current++;
        setText(phrase.slice(0, j.current));
        if (j.current === phrase.length) {
          deleting.current = true;
          return 1600;
        }
        return 45;
      } else {
        j.current--;
        setText(phrase.slice(0, j.current));
        if (j.current === 0) {
          deleting.current = false;
          i.current++;
          return 250;
        }
        return 25;
      }
    };
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      const delay = tick();
      timer = setTimeout(loop, delay);
    };
    timer = setTimeout(loop, 400);
    return () => clearTimeout(timer);
  }, [phrases]);

  return text;
}

function GenerateForm({
  username,
  vibe,
  onUsername,
  onVibe,
  error,
  submitting,
  onSubmit,
}: {
  username: string;
  vibe: string;
  onUsername: (v: string) => void;
  onVibe: (v: string) => void;
  error: string | null;
  submitting: boolean;
  onSubmit: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const placeholder = useTypewriter(VIBE_EXAMPLES);

  // Same cursor-tracked sheen as landing + sign-in for visual continuity.
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

  const trimmedU = username.trim().replace(/^@/, "");
  const trimmedV = vibe.trim();
  const canSubmit =
    trimmedU.length > 0 &&
    trimmedV.length > 2 &&
    USERNAME_RE.test(trimmedU) &&
    !submitting;

  return (
    <div className="w-full">
      <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1 text-[10.5px] font-medium tracking-[0.18em] text-white/55 uppercase backdrop-blur-md">
        <span className="h-1 w-1 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
        Step 2 of 2 · Build inputs
      </div>

      <h1 className="text-balance text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl">
        Tell us who you are
        <br />
        <span className="bg-gradient-to-b from-white to-white/55 bg-clip-text text-transparent">
          and the world you want.
        </span>
      </h1>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/55">
        Your GitHub powers the content. The vibe shapes the world.
      </p>

      <div
        ref={cardRef}
        className="relative mt-10 w-full"
        style={
          {
            "--mx": "50%",
            "--my": "0%",
          } as React.CSSProperties
        }
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-6 rounded-[28px] opacity-80 blur-2xl"
          style={{
            background:
              "radial-gradient(420px circle at var(--mx) var(--my), rgba(54,212,134,0.18), transparent 60%)",
          }}
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!submitting) onSubmit();
          }}
          noValidate
          className="relative space-y-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 backdrop-blur-xl"
          style={{
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 0 0 1px rgba(255,255,255,0.02), 0 30px 60px -20px rgba(0,0,0,0.65)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{
              background:
                "radial-gradient(280px circle at var(--mx) var(--my), rgba(255,255,255,0.06), transparent 60%)",
            }}
          />

          {/* GitHub username ────────────────────────────────────────────── */}
          <label className="relative block">
            <span className="mb-1.5 flex items-center gap-2 text-[11px] font-medium tracking-[0.14em] text-white/55 uppercase">
              <span className="font-mono text-emerald-400/80">$</span>
              github_user
            </span>
            <div className="flex items-center gap-1 rounded-xl bg-black/35 p-1 ring-1 ring-white/[0.04]">
              <span className="flex h-10 w-9 items-center justify-center font-mono text-[15px] text-white/35 select-none">
                @
              </span>
              <input
                value={username}
                onChange={(e) => onUsername(e.target.value)}
                placeholder="your-github"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                disabled={submitting}
                aria-invalid={!!error}
                className="h-10 flex-1 bg-transparent font-mono text-[15px] tracking-tight outline-none placeholder:text-white/25 disabled:opacity-60"
              />
            </div>
          </label>

          {/* Vibe ────────────────────────────────────────────────────────── */}
          <label className="relative block">
            <span className="mb-1.5 flex items-center justify-between text-[11px] font-medium tracking-[0.14em] text-white/55 uppercase">
              <span className="flex items-center gap-2">
                <span className="font-mono text-emerald-400/80">$</span>
                vibe
              </span>
              <span
                className={`font-mono normal-case tracking-normal ${
                  vibe.length >= 100 ? "text-amber-300/80" : "text-white/30"
                }`}
                aria-live="polite"
              >
                {vibe.length}/100
              </span>
            </span>
            <div className="rounded-xl bg-black/35 p-1 ring-1 ring-white/[0.04]">
              <textarea
                value={vibe}
                onChange={(e) => onVibe(e.target.value.slice(0, 100))}
                placeholder={placeholder + "▍"}
                rows={3}
                maxLength={100}
                disabled={submitting}
                className="w-full resize-none rounded-lg bg-transparent px-3 py-2 text-[14.5px] leading-relaxed outline-none placeholder:text-white/25 disabled:opacity-60"
              />
            </div>
          </label>

          {/* Action row ──────────────────────────────────────────────────── */}
          <div className="relative flex items-center justify-between gap-3 pt-1">
            <p
              role={error ? "alert" : undefined}
              className={`text-[11.5px] transition-colors ${
                error ? "text-red-300/90" : "text-white/35"
              }`}
            >
              {error ?? "We'll fetch your work and build a TERMINAL_NEXUS portfolio."}
            </p>
            <button
              type="submit"
              disabled={!canSubmit}
              aria-busy={submitting}
              className="group inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-white px-4 text-[13.5px] font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Spinner />
                  Checking
                </>
              ) : (
                <>
                  Generate
                  <Arrow />
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <p className="mt-6 text-center text-[11px] tracking-wide text-white/30">
        Takes ~20 seconds · Free during beta
      </p>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Build-log / progress view
// ───────────────────────────────────────────────────────────────────────────

function BuildLog({
  state,
  username,
  onRetry,
}: {
  state: State;
  username: string;
  onRetry: () => void;
}) {
  const activeIdx = useMemo(() => {
    if (state.view === "done") return PIPELINE.length;
    if (!state.stage) return -1;
    return PIPELINE.findIndex((p) => p.id === state.stage);
  }, [state.stage, state.view]);

  const stalled = useStalledFlag(state.lastEventAt, state.view, state.streamError);

  if (state.streamError) {
    return (
      <div
        role="alert"
        className="w-full max-w-md rounded-2xl border border-red-500/25 bg-red-500/[0.04] p-5 backdrop-blur-xl"
      >
        <p className="font-medium text-red-300">Couldn&apos;t generate</p>
        <p className="mt-1 text-sm text-white/55">{state.streamError}</p>
        <div className="mt-5 flex gap-3 text-sm">
          <button
            onClick={onRetry}
            className="rounded-lg bg-white px-3.5 py-1.5 font-medium text-black transition hover:bg-white/90"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-white/10 px-3.5 py-1.5 text-white/70 transition hover:text-white"
          >
            Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <p className="text-[11px] font-medium tracking-[0.18em] text-white/45 uppercase">
        {state.view === "done"
          ? "Opening your portfolio"
          : `Building @${username}`}
      </p>

      <ol className="mt-6 space-y-2.5 font-mono text-[13.5px]" aria-live="polite">
        {PIPELINE.map((step, idx) => {
          const finishing = state.view === "done";
          const isDone = finishing || idx < activeIdx;
          const isActive = !isDone && idx === activeIdx;
          return (
            <li
              key={step.id}
              className={`flex items-center gap-2.5 transition-colors ${
                isDone
                  ? "text-white/80"
                  : isActive
                    ? "text-white"
                    : "text-white/30"
              }`}
            >
              <span className="inline-flex h-4 w-4 items-center justify-center">
                {isDone ? (
                  <span aria-hidden className="text-emerald-400">
                    ✓
                  </span>
                ) : isActive ? (
                  <span
                    aria-hidden
                    className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white/80"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full bg-white/15"
                  />
                )}
              </span>
              <span>{step.label}</span>
              {isActive && (
                <span
                  aria-hidden
                  className="ml-1 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"
                />
              )}
            </li>
          );
        })}
      </ol>

      {state.log.length > 0 && (
        <p className="mt-5 truncate font-mono text-[11.5px] text-white/40">
          › {state.log[state.log.length - 1]!.text}
        </p>
      )}

      {stalled && (
        <p className="mt-4 text-[11.5px] text-amber-300/70">
          Still working — large repos can take a moment.
        </p>
      )}

      {state.view === "done" && (
        <p className="mt-5 text-[12px] text-white/45">Redirecting…</p>
      )}
    </div>
  );
}

function useStalledFlag(
  lastEventAt: number,
  view: View,
  streamError: string | null,
) {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (view !== "stream") return;
    const id = window.setInterval(() => force(), 3000);
    return () => window.clearInterval(id);
  }, [view]);
  if (view !== "stream" || streamError) return false;
  if (!lastEventAt) return false;
  return Date.now() - lastEventAt > 18_000;
}

// ───────────────────────────────────────────────────────────────────────────
// Tiny shared icons
// ───────────────────────────────────────────────────────────────────────────

function Arrow() {
  return (
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
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/25 border-t-current"
    />
  );
}
