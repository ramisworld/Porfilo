/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

const rootDomain = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000")
  .toLowerCase()
  .replace(/\/$/, "");
const assetOrigin = rootDomain.startsWith("localhost")
  ? `http://${rootDomain}`
  : `https://${rootDomain}`;

/** @type {import("next").NextConfig} */
const config = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "frame-ancestors 'self'",
              "form-action 'self'",
              "object-src 'none'",
              `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${assetOrigin}`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https:",
              "frame-src 'self'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(self), usb=()",
          },
        ],
      },
    ];
  },
  // World templates are intentionally filesystem-backed so design code stays
  // immutable and editable outside the application bundle. Include them in
  // standalone/serverless traces for runtime rendering.
  outputFileTracingIncludes: {
    "/*": ["./world-prompts/*.html"],
  },
};

export default config;
