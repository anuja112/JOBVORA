import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  devIndicators: false,

  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  turbopack: {
    root: path.join(__dirname),
  },

  serverExternalPackages: [
    "playwright",
    "playwright-core",
    "@browserbasehq/stagehand",
    "@browserbasehq/sdk",
  ],

  outputFileTracingIncludes: {
    "/api/inngest": [
      "./node_modules/playwright-core/browsers.json",
    ],
  },
};

export default nextConfig;