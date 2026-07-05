"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "~/lib/auth-client";
import { Arrow, Spinner } from "~/app/_components/icons";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Providers = { google: boolean; github: boolean; email: boolean };

const DEFAULT_CALLBACK_URL = "/dashboard";
const ALLOWED_CALLBACK_PATHS = new Set([DEFAULT_CALLBACK_URL, "/claim"]);

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
      router.push(`/check-email?email=${encodeURIComponent(value)}`);
    });
  };

  const oauth = async (provider: "google" | "github") => {
    setError(null);
    setOauthPending(provider);
    try {
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
      style={{ "--mx": "50%", "--my": "0%" } as React.CSSProperties}
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

      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6 backdrop-blur-xl shadow-glass sm:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
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
          <div className="relative space-y-2.5">
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
          <div className="relative my-5 flex items-center gap-3 text-[10px] tracking-[0.18em] text-white/30 uppercase">
            <div className="h-px flex-1 bg-white/10" />
            or with email
            <div className="h-px flex-1 bg-white/10" />
          </div>
        )}

        {/* Email magic link */}
        <form onSubmit={sendMagicLink} noValidate className="relative">
          <label
            htmlFor="email"
            className="mb-2 block text-[12px] text-muted-2"
          >
            Email
          </label>
          <div className="flex items-center gap-1 rounded-xl bg-well p-1 ring-1 ring-border-faint transition focus-within:ring-white/20">
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
              disabled={isPending || oauthPending !== null}
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
              error ? "text-red-300/80" : "text-faint"
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
      className="group relative flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-white/[0.10] bg-white/[0.04] text-[14px] font-medium text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-white/[0.18] hover:bg-white/[0.07] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <Spinner tone="onDark" /> : <ProviderIcon provider={provider} />}
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
  // Official multi-colour Google "G".
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.79-.07-1.55-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.87z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1-.38-2.28c0-.79.14-1.56.38-2.28V6.63H1.27a12 12 0 0 0 0 10.74l4-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.27 6.63l4 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}
