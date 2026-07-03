import Link from "next/link";
import { PorfiloWordmark } from "~/app/_components/porfilo-logo";
import { AuroraBackground } from "~/app/_components/aurora-background";

export const dynamic = "force-static";

export const metadata = {
  title: "Terms — Porfilo",
  description: "The terms for using Porfilo.",
};

export default function TermsPage() {
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
          Terms
        </h1>
        <p className="mt-2 text-sm text-faint">Last updated: July 2026</p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-muted">
          <Section title="The service">
            Porfilo generates a personal portfolio website from your public
            GitHub profile. During beta, generation is free and limited to one
            portfolio per account.
          </Section>
          <Section title="Your content">
            You retain ownership of your GitHub data and any portfolio Porfilo
            generates from it. You grant Porfilo a limited license to read your
            public GitHub data and render your portfolio. You&apos;re
            responsible for the accuracy of what you publish.
          </Section>
          <Section title="Acceptable use">
            Don&apos;t use Porfilo to misrepresent your work, impersonate others,
            or generate content you don&apos;t have rights to. We may remove
            portfolios that violate these terms.
          </Section>
          <Section title="Contact">
            Questions? Email{" "}
            <a
              className="text-fg underline decoration-white/20 underline-offset-4 transition hover:decoration-white/60"
              href="mailto:legal@porfilo.com"
            >
              legal@porfilo.com
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
