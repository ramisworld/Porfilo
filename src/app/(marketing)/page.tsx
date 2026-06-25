"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const VIBE_EXAMPLES = [
  "dark hacker terminal, neon green, minimal",
  "warm editorial magazine, serif, lots of whitespace",
  "brutalist black & white with huge type",
  "glassy futuristic, soft gradients, floating cards",
  "retro 8-bit arcade with a starfield background",
];

// GitHub username spec — kept in sync with the server's zod regex so we can
// reject invalid input client-side without a round-trip.
const USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

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

export default function Landing() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [vibe, setVibe] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  // `pending` covers the navigation gap from clicking Generate to the
  // /generate page taking over. `useTransition` tracks router.push in Next 15
  // so the button can show a real spinner instead of looking frozen.
  const [isPending, startTransition] = useTransition();
  const placeholder = useTypewriter(VIBE_EXAMPLES);

  // Warm up the /generate route chunks on mount so the first navigation is
  // instant (in dev this compiles the route segment ahead of time).
  useEffect(() => {
    router.prefetch("/generate");
  }, [router]);

  const trimmedU = username.trim().replace(/^@/, "");
  const trimmedV = vibe.trim();
  const canSubmit =
    trimmedU.length > 0 && trimmedV.length > 0 && !isPending;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (!USERNAME_RE.test(trimmedU)) {
      setValidationError(
        "That doesn't look like a GitHub username. Letters, numbers, and dashes only.",
      );
      return;
    }
    setValidationError(null);
    const u = encodeURIComponent(trimmedU);
    const v = encodeURIComponent(trimmedV);
    // The transition holds `isPending = true` for the full duration of the
    // client navigation — including dev-mode route compile and chunk fetch —
    // so the button never appears unresponsive after the click.
    startTransition(() => {
      router.push(`/generate?u=${u}&v=${v}`);
    });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#08080c] px-6 text-white">
      <div className="w-full max-w-xl">
        <p className="mb-3 text-sm font-medium tracking-widest text-white/40 uppercase">
          PortHub
        </p>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Your GitHub, as a portfolio that{" "}
          <span className="text-indigo-400">looks like you.</span>
        </h1>
        <p className="mt-4 text-pretty text-white/55">
          Type your username, describe the vibe, and we generate a unique,
          interactive site from your real work.
        </p>

        <form onSubmit={onSubmit} className="mt-10 space-y-4" noValidate>
          <label className="block">
            <span className="mb-1.5 block text-sm text-white/50">
              GitHub username
            </span>
            <input
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="ramisworld"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={isPending}
              aria-invalid={!!validationError}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-indigo-400/60 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-white/50">
              Describe the style, colors & vibe
            </span>
            <textarea
              value={vibe}
              onChange={(e) => setVibe(e.target.value)}
              placeholder={placeholder + "▍"}
              rows={3}
              maxLength={300}
              disabled={isPending}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-indigo-400/60 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          {validationError ? (
            <p
              role="alert"
              className="text-sm text-red-300/90"
            >
              {validationError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            aria-busy={isPending}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-6 font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? (
              <>
                <span
                  aria-hidden
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black"
                />
                Launching the build…
              </>
            ) : (
              "Generate my portfolio"
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-white/30">
          No account needed · takes ~20 seconds
        </p>
      </div>
    </main>
  );
}
