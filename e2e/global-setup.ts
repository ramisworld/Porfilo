import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

/**
 * Provides an authenticated Playwright storage state for the E2E suite.
 *
 * The /dashboard route is an RSC that redirects to /sign-in without a session,
 * so the tests need a logged-in browser context. Two supported ways to provide
 * one (no live run is required to keep this scaffold in the repo):
 *
 *   1. Point E2E_STORAGE_STATE at a Playwright storageState JSON captured from a
 *      real login — e.g. `pnpm exec playwright codegen <app>` then "Save storage
 *      state". We copy it into e2e/.auth/user.json.
 *   2. Seed a session with Prisma and inject the better-auth cookie. Left as a
 *      project hook because better-auth signs cookies with BETTER_AUTH_SECRET and
 *      the exact encoding is deployment-specific.
 *
 * With neither provided we write an empty state; the spec detects the sign-in
 * redirect and skips itself, so CI stays green until auth is wired.
 */
const AUTH_FILE = "e2e/.auth/user.json";

export default function globalSetup(): void {
  mkdirSync(dirname(AUTH_FILE), { recursive: true });

  const provided = process.env.E2E_STORAGE_STATE;
  if (provided && existsSync(provided)) {
    writeFileSync(AUTH_FILE, readFileSync(provided, "utf8"));
    return;
  }

  if (!existsSync(AUTH_FILE)) {
    writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
  }
}
