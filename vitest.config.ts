import { defineConfig } from "vitest/config";
import path from "node:path";

// Vitest config kept intentionally small: pure-Node tests only, no jsdom,
// no Next.js loader. We test pure logic + mocked-fetch CF client.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Skip slow integration tests by default; allow opt-in via env later.
    exclude: ["**/node_modules/**", "**/generated/**"],
  },
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
      // `server-only` throws at import time outside an RSC context. In tests
      // we're exercising server logic in plain Node — alias it to a noop.
      "server-only": path.resolve(__dirname, "./test/server-only-shim.ts"),
    },
  },
});
