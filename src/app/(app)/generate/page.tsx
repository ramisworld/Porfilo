"use client";

import { Suspense, useEffect, useMemo, useReducer } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

// Mirror of the server's GenerateEvent shape — kept loose because the API can
// also forward a synthetic "open" event before the generator starts.
interface GenEvent {
  stage: string;
  message?: string;
  slug?: string;
  error?: string;
}

// Ordered pipeline stages — rendered as a checklist so the user can see what's
// happening even between server events. `open` is the initial connect event,
// `done` flips us out of the streaming state.
const PIPELINE = [
  { id: "fetching", label: "Reading your GitHub" },
  { id: "curating", label: "Curating your best work" },
  { id: "writing", label: "Writing your story" },
  { id: "designing", label: "Designing your site" },
  { id: "saving", label: "Publishing" },
] as const;
type StageId = (typeof PIPELINE)[number]["id"];

// ----- State machine -----------------------------------------------------
// idle        : initial render (mounted, not yet started)
// connecting  : POST in-flight, no bytes received yet
// streaming   : stream is open, events flowing
// redirecting : `done` received; transitioning to the subdomain
// error       : generation failed or validation failed
type Status =
  | "idle"
  | "connecting"
  | "streaming"
  | "redirecting"
  | "error";

interface State {
  status: Status;
  stage: StageId | null;
  log: { id: number; text: string }[];
  error: string | null;
  slug: string | null;
  // Wall-clock of the last server event (incl. heartbeat). Used to detect a
  // stalled stream and surface a "still working…" hint.
  lastEventAt: number;
}

type Action =
  | { type: "CONNECT" }
  | { type: "OPEN" }
  | { type: "STAGE"; stage: StageId; message?: string }
  | { type: "LOG"; message: string }
  | { type: "DONE"; slug: string }
  | { type: "ERROR"; error: string }
  | { type: "PING" };

let LOG_ID = 0;

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "CONNECT":
      return {
        status: "connecting",
        stage: null,
        log: [],
        error: null,
        slug: null,
        lastEventAt: Date.now(),
      };
    case "OPEN":
      return { ...state, status: "streaming", lastEventAt: Date.now() };
    case "STAGE": {
      const nextLog = action.message
        ? [...state.log, { id: ++LOG_ID, text: action.message }]
        : state.log;
      return {
        ...state,
        status: "streaming",
        stage: action.stage,
        log: nextLog,
        lastEventAt: Date.now(),
      };
    }
    case "LOG":
      return {
        ...state,
        log: [...state.log, { id: ++LOG_ID, text: action.message }],
        lastEventAt: Date.now(),
      };
    case "DONE":
      return {
        ...state,
        status: "redirecting",
        slug: action.slug,
        lastEventAt: Date.now(),
      };
    case "ERROR":
      return { ...state, status: "error", error: action.error };
    case "PING":
      return { ...state, lastEventAt: Date.now() };
  }
}

const INITIAL: State = {
  status: "idle",
  stage: null,
  log: [],
  error: null,
  slug: null,
  lastEventAt: 0,
};

function isStageId(s: string): s is StageId {
  return PIPELINE.some((p) => p.id === s);
}

function GenerateInner() {
  const params = useSearchParams();
  const username = params.get("u") ?? "";
  const vibe = params.get("v") ?? "";

  const [state, dispatch] = useReducer(reducer, INITIAL);

  useEffect(() => {
    if (!username || !vibe) {
      dispatch({ type: "ERROR", error: "Missing username or vibe." });
      return;
    }

    // No "already started" ref guard here on purpose. Under React StrictMode
    // (dev) the effect runs mount → cleanup → mount; a ref guard combined with
    // `ctrl.abort()` in cleanup would kill the first fetch and then skip the
    // second, leaving the UI permanently in "connecting". The canonical fix is
    // to let cleanup abort fetch #1 (it never reaches the network because the
    // signal is aborted in the same tick) and let mount #2 issue a fresh
    // fetch #2 that actually streams.
    const ctrl = new AbortController();
    let cancelled = false;
    // Local flag — `state.status` captured in this closure can be stale; we
    // need a deterministic signal that we've already emitted DONE so we don't
    // misreport "stream ended unexpectedly" right after a successful finish.
    let finished = false;
    let redirectTimer: number | undefined;

    // Transition out of `idle` *synchronously* on mount — the UI shows
    // "Opening secure channel…" the moment the page paints, never waiting on
    // the network round-trip.
    dispatch({ type: "CONNECT" });

    void (async () => {
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username, vibe }),
          // SSE must never be cached, and we don't want the request itself
          // to be deduped/cached by the Next router fetch wrapper either.
          cache: "no-store",
          signal: ctrl.signal,
        });

        if (cancelled) return;

        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
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

          // SSE frames are separated by a blank line. Comment lines (":...")
          // are ignored by spec; we use them for padding + heartbeat.
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";

          for (const block of blocks) {
            const trimmed = block.trim();
            if (!trimmed) continue;
            // Heartbeat comment — refresh the watchdog and move on.
            if (trimmed.startsWith(":")) {
              dispatch({ type: "PING" });
              continue;
            }
            if (!trimmed.startsWith("data:")) continue;

            let ev: GenEvent;
            try {
              ev = JSON.parse(trimmed.slice(5).trim()) as GenEvent;
            } catch {
              continue;
            }

            if (ev.stage === "open") {
              dispatch({ type: "OPEN" });
              continue;
            }
            if (ev.stage === "error") {
              finished = true;
              dispatch({
                type: "ERROR",
                error: ev.error ?? "Generation failed.",
              });
              ctrl.abort();
              return;
            }
            if (ev.stage === "done" && ev.slug) {
              finished = true;
              dispatch({ type: "DONE", slug: ev.slug });
              // Hard navigate to the subdomain — the portfolio lives on a
              // different origin so a client-side route can't reach it.
              const target = `${window.location.protocol}//${ev.slug}.${ROOT_DOMAIN}`;
              // Brief paint of the "redirecting" UI before we leave.
              redirectTimer = window.setTimeout(() => {
                window.location.href = target;
              }, 250);
              return;
            }
            if (ev.stage && isStageId(ev.stage)) {
              dispatch({
                type: "STAGE",
                stage: ev.stage,
                message: ev.message,
              });
            } else if (ev.message) {
              dispatch({ type: "LOG", message: ev.message });
            }
          }
        }

        // Stream ended without a `done` event — surface as an error rather
        // than leaving the UI spinning forever.
        if (!cancelled && !finished) {
          dispatch({
            type: "ERROR",
            error: "The build ended unexpectedly. Please try again.",
          });
        }
      } catch (e) {
        if (cancelled) return;
        const err = e as Error;
        if (err.name === "AbortError") return;
        dispatch({
          type: "ERROR",
          error: err.message || "Network error. Please try again.",
        });
      }
    })();

    return () => {
      cancelled = true;
      ctrl.abort();
      if (redirectTimer !== undefined) window.clearTimeout(redirectTimer);
    };
  }, [username, vibe]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#08080c] px-6 text-white">
      <div className="w-full max-w-md">
        {state.status === "error" ? (
          <ErrorView error={state.error ?? "Generation failed."} />
        ) : (
          <ProgressView state={state} username={username} />
        )}
      </div>
    </main>
  );
}

// ---------- views ---------------------------------------------------------

function ErrorView({ error }: { error: string }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-500/30 bg-red-500/5 p-5"
    >
      <p className="font-medium text-red-300">Couldn’t generate</p>
      <p className="mt-1 text-sm text-white/60">{error}</p>
      <Link
        href="/"
        className="mt-4 inline-block text-sm text-indigo-300 hover:underline"
      >
        ← Try again
      </Link>
    </div>
  );
}

function ProgressView({
  state,
  username,
}: {
  state: State;
  username: string;
}) {
  // The active stage's index in the pipeline — drives the checklist UI.
  const activeIdx = useMemo(() => {
    if (state.status === "redirecting") return PIPELINE.length;
    if (!state.stage) return -1;
    return PIPELINE.findIndex((p) => p.id === state.stage);
  }, [state.stage, state.status]);

  // "Still working…" hint if no event has been received for >18s. Heartbeats
  // refresh lastEventAt every 8s, so this only trips on a real stall.
  const stalled = useStalledFlag(state.lastEventAt, state.status);

  return (
    <div>
      <p className="text-sm tracking-widest text-white/40 uppercase">
        {state.status === "redirecting"
          ? "Opening your portfolio"
          : `Building ${username}`}
      </p>

      <ol className="mt-6 space-y-2 font-mono text-sm" aria-live="polite">
        {PIPELINE.map((step, idx) => {
          const redirecting = state.status === "redirecting";
          const isDone = redirecting || idx < activeIdx;
          const isActive = !isDone && idx === activeIdx;
          return (
            <li
              key={step.id}
              className={`flex items-center gap-2 ${
                isDone
                  ? "text-white/80"
                  : isActive
                    ? "text-white"
                    : "text-white/35"
              }`}
            >
              <span className="inline-flex h-4 w-4 items-center justify-center">
                {isDone ? (
                  <span aria-hidden className="text-green-400">
                    ✓
                  </span>
                ) : isActive ? (
                  <span
                    aria-hidden
                    className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white/80"
                  />
                ) : (
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white/15" />
                )}
              </span>
              <span>{step.label}</span>
            </li>
          );
        })}
      </ol>

      {/* Tail the most recent server message — gives a "this is real" signal
          to the user without dumping the whole stream into the UI. */}
      {state.log.length > 0 && (
        <p className="mt-4 truncate font-mono text-xs text-white/40">
          {state.log[state.log.length - 1]!.text}
        </p>
      )}

      {state.status === "connecting" && (
        <p className="mt-4 text-xs text-white/35">
          Opening a secure channel…
        </p>
      )}
      {stalled && (
        <p className="mt-4 text-xs text-amber-300/70">
          Still working — large repos can take a moment.
        </p>
      )}
    </div>
  );
}

// Watchdog: returns true if no server event has arrived for >18 s while
// streaming. Heartbeats hit every 8 s so a healthy stream never trips this.
function useStalledFlag(lastEventAt: number, status: Status) {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (status !== "streaming" && status !== "connecting") return;
    const id = window.setInterval(() => force(), 3000);
    return () => window.clearInterval(id);
  }, [status]);
  if (status !== "streaming" && status !== "connecting") return false;
  if (!lastEventAt) return false;
  return Date.now() - lastEventAt > 18_000;
}

export default function GeneratePage() {
  return (
    <Suspense>
      <GenerateInner />
    </Suspense>
  );
}
