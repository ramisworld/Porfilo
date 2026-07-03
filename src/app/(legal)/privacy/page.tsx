import Link from "next/link";
import { PorfiloWordmark } from "~/app/_components/porfilo-logo";
import { AuroraBackground } from "~/app/_components/aurora-background";

export const dynamic = "force-static";

export const metadata = {
  title: "Privacy — Porfilo",
  description: "How Porfilo handles your data.",
};

export default function PrivacyPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg text-fg antialiased [font-feature-settings:'ss01','cv11']">
      <AuroraBackground />

      <nav className="relative z-10 mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link href="/" className="transition hover:opacity-90">
          <PorfiloWordmark />
        </Link>
        <Link
          href="/"
          className="text-sm text-muted transition hover:text-fg"
        >
          ← Home
        </Link>
      </nav>

      <section className="relative z-10 mx-auto max-w-2xl px-6 pb-32">
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
          Privacy
        </h1>
        <p className="mt-2 text-sm text-faint">Last updated: July 2026</p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-muted">
          <Section title="What we collect">
            When you generate a portfolio, Porfilo reads your public GitHub
            profile and repositories via the GitHub API. We store the curated
            result (selected projects, derived copy, language stats) so your
            portfolio keeps rendering. If you create an account, we store your
            email address and a hashed session token — never a password.
          </Section>
          <Section title="How we use it">
            Your GitHub data powers your portfolio and nothing else. We don&apos;t
            train models on your code. Account email is used only for sign-in
            links and essential service notices.
          </Section>
          <Section title="What you keep">
            The portfolio we generate is yours. You can edit it, connect a custom
            domain, or export and host it anywhere. Deleting your account
            removes your data from Porfilo.
          </Section>
          <Section title="Contact">
            Questions about your data? Email{" "}
            <a
              className="text-fg underline decoration-white/20 underline-offset-4 transition hover:decoration-white/60"
              href="mailto:privacy@porfilo.com"
            >
              privacy@porfilo.com
            </a>
            .
          </Section>
        </div>
      </section>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-2 text-base font-medium text-fg">{title}</h2>
      <p>{children}</p>
    </div>
  );
}
