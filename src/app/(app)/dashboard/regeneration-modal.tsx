"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import styles from "./regeneration-modal.module.css";

type GenerationStage =
  | "fetching"
  | "curating"
  | "writing"
  | "designing"
  | "saving";

const STAGES: Array<{ id: GenerationStage; label: string }> = [
  { id: "fetching", label: "Read GitHub" },
  { id: "curating", label: "Curate work" },
  { id: "writing", label: "Write story" },
  { id: "designing", label: "Choose world" },
  { id: "saving", label: "Publish in place" },
];

export function RegenerationModal({
  initialUsername,
  initialVibe,
  onClose,
  onDone,
}: {
  initialUsername: string;
  initialVibe: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [username, setUsername] = useState(initialUsername);
  const [vibe, setVibe] = useState(initialVibe);
  const [stage, setStage] = useState<GenerationStage | null>(null);
  const [message, setMessage] = useState("Ready for a new direction.");
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);
  runningRef.current = running;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !runningRef.current) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      abortRef.current?.abort();
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const cleanUsername = username.trim();
    const cleanVibe = vibe.trim();
    if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(cleanUsername)) {
      setError("Enter a valid GitHub username.");
      return;
    }
    if (cleanVibe.length < 10 || cleanVibe.length > 100) {
      setError("Describe the vibe in 10–100 characters.");
      return;
    }

    setError(null);
    setComplete(false);
    setRunning(true);
    setStage(null);
    setMessage("Opening a secure generation run…");
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: cleanUsername,
          vibe: cleanVibe,
          mode: "replace",
        }),
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `Request failed (${response.status}).`);
      }

      const result = await readGenerationStream(response.body, (event) => {
        if (isGenerationStage(event.stage)) {
          setStage(event.stage);
          setMessage(event.message ?? "Building your next portfolio…");
        }
      });

      if (!result.ok) throw new Error(result.error);
      setStage("saving");
      setMessage("New portfolio published. Your URL stayed exactly the same.");
      setComplete(true);
      onDone();
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(
        cause instanceof Error
          ? cause.message
          : "Regeneration failed. Your current portfolio was not changed.",
      );
    } finally {
      if (!controller.signal.aborted) setRunning(false);
    }
  };

  if (typeof document === "undefined") return null;

  const activeIndex = stage
    ? STAGES.findIndex((candidate) => candidate.id === stage)
    : -1;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="regeneration-title"
      className={styles.overlay}
    >
      <button
        type="button"
        aria-label="Close regeneration"
        onClick={running ? undefined : onClose}
        className={styles.scrim}
      />
      <section className={styles.panel}>
        <header className={styles.header}>
          <div className={styles.index} aria-hidden>
            RG/01
          </div>
          <div>
            <p>Premium operation · Replace in place</p>
            <h2 id="regeneration-title">Regenerate your portfolio.</h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={running}
            className={styles.close}
          >
            ×
          </button>
        </header>

        <form className={styles.body} onSubmit={submit}>
          <div className={styles.formColumn}>
            <div className={styles.notice}>
              <strong>Same address. Entirely new build.</strong>
              <p>
                This replaces the current design and generated content. Your
                Porfilo URL, connected custom domain, and account stay intact.
              </p>
            </div>

            <label className={styles.field}>
              <span>GitHub username</span>
              <div>
                <b aria-hidden>@</b>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  disabled={running}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <small>
                Use the same account or curate work from another one.
              </small>
            </label>

            <label className={styles.field}>
              <span>Creative direction</span>
              <textarea
                value={vibe}
                onChange={(event) => setVibe(event.target.value)}
                disabled={running}
                minLength={10}
                maxLength={100}
                rows={4}
              />
              <small>
                {vibe.trim().length}/100 · Describe the feeling, not a template
                name.
              </small>
            </label>
          </div>

          <div className={styles.runColumn}>
            <p className={styles.runLabel}>Generation sequence / 05</p>
            <ol className={styles.stages}>
              {STAGES.map((candidate, index) => (
                <li
                  key={candidate.id}
                  data-state={
                    complete || index < activeIndex
                      ? "done"
                      : index === activeIndex
                        ? "active"
                        : "waiting"
                  }
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <b>{candidate.label}</b>
                  <i aria-hidden />
                </li>
              ))}
            </ol>
            <div className={styles.status} aria-live="polite">
              <span>
                {running ? "RUNNING" : complete ? "COMPLETE" : "READY"}
              </span>
              <p>{message}</p>
            </div>
          </div>

          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}

          <footer className={styles.footer}>
            <p>$9 Premium · no charge for this regeneration</p>
            {complete ? (
              <button
                type="button"
                onClick={onClose}
                className={styles.primary}
              >
                View refreshed portfolio →
              </button>
            ) : (
              <button
                type="submit"
                disabled={running}
                className={styles.primary}
              >
                {running ? "Regenerating…" : "Regenerate portfolio →"}
              </button>
            )}
          </footer>
        </form>
      </section>
    </div>,
    document.body,
  );
}

type StreamEvent = {
  stage: string;
  message?: string;
  error?: string;
};

async function readGenerationStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: StreamEvent) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const line = block.trim();
      if (!line.startsWith("data:")) continue;
      let event: StreamEvent;
      try {
        event = JSON.parse(line.slice(5).trim()) as StreamEvent;
      } catch {
        continue;
      }
      if (event.stage === "error") {
        return {
          ok: false,
          error:
            event.error ??
            "Regeneration failed. Your current portfolio was not changed.",
        };
      }
      if (event.stage === "done") return { ok: true };
      onEvent(event);
    }
  }

  return {
    ok: false,
    error:
      "The build ended unexpectedly. Your current portfolio was not changed.",
  };
}

function isGenerationStage(stage: string): stage is GenerationStage {
  return STAGES.some((candidate) => candidate.id === stage);
}
