import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "../generated/prisma/index.js";

for (const file of [".env", ".env.local"]) {
  try {
    loadEnvFile(file);
  } catch {
    // Optional local overrides.
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to verify migrations.");
}

const schema = `porfilo_migration_test_${randomBytes(6).toString("hex")}`;
const baseUrl = new URL(process.env.DATABASE_URL);
baseUrl.searchParams.delete("schema");
const testUrl = new URL(baseUrl);
testUrl.searchParams.set("schema", schema);
const admin = new PrismaClient({ datasourceUrl: baseUrl.toString() });

function prisma(args) {
  const result = spawnSync("pnpm", ["prisma", ...args], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
  });
  if (result.status !== 0) {
    throw new Error(`prisma ${args.join(" ")} failed with ${result.status}`);
  }
}

try {
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  prisma(["migrate", "deploy"]);
  prisma(["migrate", "status"]);
  console.log(`Fresh migration verification passed in schema ${schema}.`);
} finally {
  await admin
    .$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
    .catch(() => undefined);
  await admin.$disconnect();
}
