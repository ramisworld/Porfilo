import { createHmac, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "../generated/prisma/index.js";

const AUTH_FILE = "e2e/.auth/user.json";
const FIXTURE_FILE = "e2e/.auth/fixture.json";

export default async function globalSetup(): Promise<void> {
  mkdirSync(dirname(AUTH_FILE), { recursive: true });

  const provided = process.env.E2E_STORAGE_STATE;
  if (provided && existsSync(provided)) {
    writeFileSync(AUTH_FILE, readFileSync(provided, "utf8"));
    writeFileSync(FIXTURE_FILE, JSON.stringify({ external: true }));
    return;
  }

  for (const file of [resolve(".env"), resolve(".env.local")]) {
    try {
      loadEnvFile(file);
    } catch {
      // Local overrides are optional.
    }
  }

  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("E2E requires BETTER_AUTH_SECRET");

  const db = new PrismaClient();
  try {
    const source = await db.portfolio.findFirst({
      where: { ownerId: { not: null } },
    });
    if (!source) throw new Error("E2E requires one source portfolio");

    const suffix = randomBytes(12).toString("hex");
    const user = await db.user.create({
      data: {
        name: "Porfilo E2E",
        email: `e2e-${suffix}@example.invalid`,
        emailVerified: true,
      },
    });
    await db.portfolio.create({
      data: {
        ownerId: user.id,
        githubUsername: source.githubUsername,
        slug: `e2e-${suffix}`,
        publicSubdomainSlug: `e2e-${suffix}`,
        vibe: source.vibe,
        profileData: source.profileData,
        designSpec: source.designSpec ?? undefined,
        engineVersion: source.engineVersion,
        template: source.template,
        code: source.code,
        isPublic: true,
      },
    });

    const token = `e2e-${randomBytes(24).toString("hex")}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await db.session.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
        userAgent: "Porfilo Playwright E2E",
      },
    });

    const signature = createHmac("sha256", secret)
      .update(token)
      .digest("base64");
    writeFileSync(
      AUTH_FILE,
      JSON.stringify({
        cookies: [
          {
            name: "better-auth.session_token",
            value: `${token}.${signature}`,
            domain: "localhost",
            path: "/",
            expires: Math.floor(expiresAt.getTime() / 1000),
            httpOnly: true,
            secure: false,
            sameSite: "Lax",
          },
        ],
        origins: [],
      }),
    );
    writeFileSync(FIXTURE_FILE, JSON.stringify({ userId: user.id }));
  } finally {
    await db.$disconnect();
  }
}
