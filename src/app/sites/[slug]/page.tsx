import { notFound } from "next/navigation";
import { db } from "~/server/db";

// Always read the latest generated code; portfolios are user-specific.
export const dynamic = "force-dynamic";

export default async function SitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // MVP: render any existing slug — do NOT gate on isPublic (avoids 404-on-preview).
  const portfolio = await db.portfolio.findUnique({ where: { slug } });
  if (!portfolio) notFound();

  // The generated page is untrusted → sandbox it. allow-scripts (its animations
  // need JS) but NOT allow-same-origin, so it can't reach the app or its storage.
  return (
    <iframe
      title="portfolio"
      srcDoc={portfolio.code}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      className="fixed inset-0 h-screen w-screen border-0"
    />
  );
}
