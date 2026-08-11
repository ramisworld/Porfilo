import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type { Prisma } from "../../../../../generated/prisma";
import { appOrigin } from "~/lib/root-domain";
import { getSession } from "~/server/auth";
import { db } from "~/server/db";
import { profileDataSchema, type ProfileData } from "~/server/profile/model";
import { normalizeWorldId } from "~/server/worlds/catalog";
import { renderWorld } from "~/server/worlds/render";
import { limit } from "~/server/ratelimit";

const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const PDF = "application/pdf";
const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function safeFileName(input: string): string {
  const clean = input.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return clean.slice(0, 160) || "resume.pdf";
}

function detectMime(file: File, bytes: Buffer): string | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") && bytes.subarray(0, 5).toString() === "%PDF-") {
    return PDF;
  }
  if (
    name.endsWith(".docx") &&
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  ) {
    return DOCX;
  }
  return null;
}

export async function POST(request: Request) {
  const session = await getSession(await headers());
  if (!session?.user) return error("Sign in required.", 401);

  const uploadLimit = await limit(`portfolio:resume:${session.user.id}`, {
    window: "1m",
    max: 4,
  });
  if (!uploadLimit.ok)
    return error("Too many uploads. Try again shortly.", 429);

  const form = await request.formData();
  const entry = form.get("file");
  if (!(entry instanceof File)) return error("Choose a PDF or DOCX file.");
  if (entry.size <= 0 || entry.size > MAX_RESUME_BYTES) {
    return error("Résumé files must be between 1 byte and 5 MB.");
  }

  const bytes = Buffer.from(await entry.arrayBuffer());
  const mimeType = detectMime(entry, bytes);
  if (!mimeType) return error("The file must be a valid PDF or DOCX.");

  const existing = await db.portfolio.findUnique({
    where: { ownerId: session.user.id },
    select: {
      id: true,
      publicSubdomainSlug: true,
      profileData: true,
      template: true,
      githubUsername: true,
    },
  });
  if (!existing) return error("No portfolio found.", 404);

  const parsed = profileDataSchema.safeParse(existing.profileData);
  if (!parsed.success)
    return error("Your portfolio data needs repair first.", 409);

  const fileName = safeFileName(entry.name);
  const resume = {
    url: `${appOrigin()}/api/resume/${existing.publicSubdomainSlug}`,
    fileName,
    mimeType: mimeType as typeof PDF | typeof DOCX,
    sizeBytes: bytes.length,
    uploadedAt: new Date().toISOString(),
  };
  const profileData: ProfileData = { ...parsed.data, resume };
  const worldId = normalizeWorldId(existing.template);
  const code = worldId
    ? renderWorld(worldId, profileData, existing.githubUsername)
    : undefined;

  await db.portfolio.update({
    where: { id: existing.id },
    data: {
      profileData: JSON.parse(
        JSON.stringify(profileData),
      ) as Prisma.InputJsonValue,
      resumeBytes: bytes,
      resumeMimeType: mimeType,
      resumeFileName: fileName,
      resumeSizeBytes: bytes.length,
      resumeUpdatedAt: new Date(),
      ...(code ? { code } : {}),
      ogImage: null,
      ogImageFingerprint: null,
    },
  });

  return NextResponse.json({ ok: true, profileData });
}

export async function DELETE() {
  const session = await getSession(await headers());
  if (!session?.user) return error("Sign in required.", 401);

  const existing = await db.portfolio.findUnique({
    where: { ownerId: session.user.id },
    select: {
      id: true,
      profileData: true,
      template: true,
      githubUsername: true,
    },
  });
  if (!existing) return error("No portfolio found.", 404);

  const parsed = profileDataSchema.safeParse(existing.profileData);
  if (!parsed.success)
    return error("Your portfolio data needs repair first.", 409);
  const withoutResume: ProfileData = { ...parsed.data, resume: undefined };
  const worldId = normalizeWorldId(existing.template);
  const code = worldId
    ? renderWorld(worldId, withoutResume, existing.githubUsername)
    : undefined;

  await db.portfolio.update({
    where: { id: existing.id },
    data: {
      profileData: JSON.parse(
        JSON.stringify(withoutResume),
      ) as Prisma.InputJsonValue,
      resumeBytes: null,
      resumeMimeType: null,
      resumeFileName: null,
      resumeSizeBytes: null,
      resumeUpdatedAt: null,
      ...(code ? { code } : {}),
      ogImage: null,
      ogImageFingerprint: null,
    },
  });

  return NextResponse.json({ ok: true, profileData: withoutResume });
}
