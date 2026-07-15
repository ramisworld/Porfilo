/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // World templates are intentionally filesystem-backed so design code stays
  // immutable and editable outside the application bundle. Include them in
  // standalone/serverless traces for runtime rendering.
  outputFileTracingIncludes: {
    "/*": ["./world-prompts/*.html"],
  },
};

export default config;
