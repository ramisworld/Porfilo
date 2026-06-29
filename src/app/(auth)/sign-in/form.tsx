"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "~/lib/auth-client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Providers = { google: boolean; github: boolean; email: boolean };

const DEFAULT_CALLBACK_URL = "/generate";
const ALLOWED_CALLBACK_PATHS = new Set([DEFAULT_CALLBACK_URL]);

function safeCallbackURL(raw: string | null) {
  if (!raw) return DEFAULT_CALLBACK_URL;
  if (!raw.startsWith("/") || raw.startsWith("//")) return DEFAULT_CALLBACK_URL;

  try {
    const url = new URL(raw, "http://porfilo.local");
    if (!ALLOWED_CALLBACK_PATHS.has(url.pathname)) return DEFAULT_CALLBACK_URL;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_CALLBACK_URL;
  }
}

export function SignInForm({ providers }: { providers: Providers }) {
  const router = useRouter();
  const params = useSearchParams();
  const callbackURL = safeCallbackURL(params.get("next"));

  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [oauthPending, setOauthPending] = useState<"google" | "github" | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const cardRef = useRef<HTMLDivElement>(null);

  // Cursor-tracked sheen, same effect as the landing page so it feels continuous.
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

  const sendMagicLink = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setError("Enter a valid email.");
      return;
    }
    startTransition(async () => {
      const res = await signIn.magicLink({ email: value, callbackURL });
      if (res.error) {
        setError(res.error.message ?? "Couldn't send the link. Try again.");
        return;
      }
      setSentTo(value);
      // Move to a dedicated "check your email" view.
      router.push(`/check-email?email=${encodeURIComponent(value)}`);
    });
  };

  const oauth = async (provider: "google" | "github") => {
    setError(null);
    setOauthPending(provider);
    try {
      // BetterAuth returns the provider URL. We navigate explicitly so the
      // handoff is predictable and only happens after we inspect the target.
      const res = await signIn.social({
        provider,
        callbackURL,
        disableRedirect: true,
      });
      if (res?.error) {
        setError(res.error.message ?? `Couldn't start ${provider} sign-in.`);
        setOauthPending(null);
        return;
      }
      const target = res?.data?.url;
      if (!target) {
        setError(
          `Couldn't start ${provider} sign-in. Check that ${provider} OAuth env vars are set.`,
        );
        setOauthPending(null);
        return;
      }
      // Defensive: OAuth should leave our origin. If it doesn't, don't treat
      // the same-origin callback as a successful provider handoff.
      try {
        const u = new URL(target, window.location.origin);
        if (u.origin === window.location.origin) {
          setError(
            "Couldn't start provider sign-in. Please refresh and try again.",
          );
          setOauthPending(null);
          return;
        }
      } catch {
        // Non-URL target — fall through to the navigation; the browser will surface any failure.
      }
      // Hard nav — leaves the SPA and hands the tab off to the OAuth provider.
      window.location.href = target;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : `Couldn't start ${provider} sign-in.`;
      setError(message);
      setOauthPending(null);
    }
  };

  const anyOauth = providers.google || providers.github;

  return (
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
      {/* Cursor-following aura */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 rounded-[28px] opacity-80 blur-2xl"
        style={{
          background:
            "radial-gradient(420px circle at var(--mx) var(--my), rgba(140,150,255,0.22), transparent 60%)",
        }}
      />

      <div
        className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 backdrop-blur-xl"
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
              "radial-gradient(280px circle at var(--mx) var(--my), rgba(255,255,255,0.07), transparent 60%)",
          }}
        />

        {/* OAuth providers */}
        {anyOauth && (
          <div className="relative space-y-2">
            {providers.github && (
              <OAuthButton
                provider="github"
                label="Continue with GitHub"
                onClick={() => oauth("github")}
                pending={oauthPending === "github"}
                disabled={oauthPending !== null || isPending}
              />
            )}
            {providers.google && (
              <OAuthButton
                provider="google"
                label="Continue with Google"
                onClick={() => oauth("google")}
                pending={oauthPending === "google"}
                disabled={oauthPending !== null || isPending}
              />
            )}
          </div>
        )}

        {anyOauth && (
          <div className="relative my-5 flex items-center gap-3 text-[10.5px] tracking-[0.18em] text-white/30 uppercase">
            <div className="h-px flex-1 bg-white/10" />
            or
            <div className="h-px flex-1 bg-white/10" />
          </div>
        )}

        {/* Email magic link */}
        <form onSubmit={sendMagicLink} noValidate className="relative">
          <label htmlFor="email" className="mb-2 block text-[12px] text-white/55">
            Email
          </label>
          <div className="flex items-center gap-1 rounded-xl bg-black/35 p-1 ring-1 ring-white/[0.04]">
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder="you@domain.com"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              aria-invalid={!!error}
              disabled={isPending || oauthPending !== null}
              className="h-10 flex-1 bg-transparent px-3 text-[15px] tracking-tight outline-none placeholder:text-white/25 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isPending || oauthPending !== null || sentTo === email}
              aria-busy={isPending}
              className="porfilo-btn porfilo-btn-primary group disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>
                  <Spinner />
                  Sending
                </>
              ) : (
                <>
                  Send link
                  <Arrow />
                </>
              )}
            </button>
          </div>
          <p
            role={error ? "alert" : undefined}
            className={`mt-2.5 px-1 text-[11.5px] transition-colors ${
              error ? "text-red-300/80" : "text-white/35"
            }`}
          >
            {error ?? "We'll email you a one-tap sign-in link. No password."}
          </p>
        </form>
      </div>
    </div>
  );
}

function OAuthButton({
  provider,
  label,
  onClick,
  pending,
  disabled,
}: {
  provider: "google" | "github";
  label: string;
  onClick: () => void;
  pending: boolean;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={pending}
      className="relative flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[14px] font-medium text-white/90 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <Spinner /> : <ProviderIcon provider={provider} />}
      {label}
    </button>
  );
}

function ProviderIcon({ provider }: { provider: "google" | "github" }) {
  if (provider === "github") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.92.57.1.78-.25.78-.55v-2.06c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.27-5.24-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.17a11.05 11.05 0 0 1 5.79 0c2.2-1.48 3.17-1.17 3.17-1.17.63 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.64.41.36.78 1.06.78 2.14v3.17c0 .31.21.66.79.55A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 11v3.2h4.5c-.2 1.2-1.5 3.5-4.5 3.5-2.7 0-4.9-2.2-4.9-5s2.2-5 4.9-5c1.5 0 2.6.6 3.2 1.2L17.5 7C16 5.7 14.2 5 12 5 7.6 5 4 8.6 4 13s3.6 8 8 8c4.6 0 7.7-3.2 7.7-7.8 0-.5-.1-.9-.1-1.2H12Z"
      />
    </svg>
  );
}

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
