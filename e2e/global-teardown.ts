import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "../generated/prisma/index.js";

const AUTH_FILE = "e2e/.auth/user.json";
const FIXTURE_FILE = "e2e/.auth/fixture.json";

export default async function globalTeardown(): Promise<void> {
  if (!existsSync(FIXTURE_FILE)) return;
  const fixture = JSON.parse(readFileSync(FIXTURE_FILE, "utf8")) as {
    external?: boolean;
    userId?: string;
  };

  if (fixture.userId) {
    for (const file of [resolve(".env"), resolve(".env.local")]) {
      try {
        loadEnvFile(file);
      } catch {
        // Local overrides are optional.
      }
    }
    const db = new PrismaClient();
    try {
      await db.user.delete({ where: { id: fixture.userId } }).catch(() => null);
    } finally {
      await db.$disconnect();
    }
  }

  rmSync(FIXTURE_FILE, { force: true });
  if (!fixture.external) rmSync(AUTH_FILE, { force: true });
}
