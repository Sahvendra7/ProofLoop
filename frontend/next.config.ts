import type { NextConfig } from "next";

// A hosted build must call the hosted API: without this the client falls back to localhost:8000.
if (process.env.VERCEL) {
  const api = process.env.NEXT_PUBLIC_API_URL ?? "";
  if (!/^https:\/\//.test(api) || /localhost|127\.0\.0\.1/.test(api)) {
    throw new Error("NEXT_PUBLIC_API_URL must be set to the hosted HTTPS API origin for Vercel builds.");
  }
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // The camera is only requested on the scan page, and only after the user asks for it.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Lets the E2E suite build into its own directory without touching the dev or prod build.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
