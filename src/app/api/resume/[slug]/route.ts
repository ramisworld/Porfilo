import { db } from "~/server/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const portfolio = await db.portfolio.findFirst({
    where: {
      OR: [{ slug }, { publicSubdomainSlug: slug }],
      isPublic: true,
    },
    select: {
      resumeBytes: true,
      resumeMimeType: true,
      resumeFileName: true,
    },
  });

  if (!portfolio?.resumeBytes || !portfolio.resumeMimeType) {
    return new Response("Résumé not found", { status: 404 });
  }

  const fileName = (portfolio.resumeFileName ?? "resume.pdf").replace(
    /[^a-zA-Z0-9._-]+/g,
    "-",
  );
  return new Response(new Uint8Array(portfolio.resumeBytes), {
    headers: {
      "Content-Type": portfolio.resumeMimeType,
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
