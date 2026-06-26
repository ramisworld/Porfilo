import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "~/server/auth";
import { db } from "~/server/db";
import { env } from "~/env";
import { GenerateClient } from "./client";
import { SignOutButton } from "./sign-out-button";
import { BetaCap } from "./beta-cap";

export const dynamic = "force-dynamic";

export default async function GeneratePage() {
  // Belt and braces — the (app) layout already redirects unauth users.
  // Resolving the session here also lets us greet the user by name.
  const session = await getSession(await headers());
  if (!session?.user) redirect("/sign-in?next=/generate");

  const displayName =
    session.user.name?.split(" ")[0] ?? session.user.email?.split("@")[0] ?? null;

  // Beta cap: one portfolio per account. If they already have one, swap the
  // form for the cap view (which deliberately has NO functional Generate CTA).
  const existing = await db.portfolio.findFirst({
    where: { ownerId: session.user.id },
    select: { slug: true, githubUsername: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const rootDomain = env.NEXT_PUBLIC_ROOT_DOMAIN;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06060a] text-white antialiased [font-feature-settings:'ss01','cv11']">
      <BackgroundDecor />

      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-[11px] font-medium tracking-[0.18em] text-white/55 uppercase transition hover:text-white"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.7)]" />
          PortHub
        </Link>
        <div className="flex items-center gap-4 text-[12px] text-white/45">
          {displayName && (
            <span className="hidden sm:inline">
              Signed in as <span className="text-white/80">{displayName}</span>
            </span>
          )}
          <SignOutButton />
        </div>
      </nav>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-88px)] max-w-2xl flex-col items-center justify-center px-6 pb-24">
        {existing ? (
          <BetaCap
            slug={existing.slug}
            githubUsername={existing.githubUsername}
            createdAt={existing.createdAt.toISOString()}
            rootDomain={rootDomain}
          />
        ) : (
          <GenerateClient />
        )}
      </section>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/70 to-transparent"
      />
    </main>
  );
}

function BackgroundDecor() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(55% 45% at 50% 25%, rgba(54,212,134,0.10), transparent 70%),radial-gradient(50% 40% at 80% 80%, rgba(108,123,255,0.16), transparent 70%),radial-gradient(40% 30% at 15% 85%, rgba(154,108,255,0.12), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
    </>
  );
}
