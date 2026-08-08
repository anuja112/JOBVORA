import type { NextConfig } from "next";
import path from "path/win32";

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {

    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  turbopack: {
    root:  path.join(__dirname),
  },
  serverExternalPackages: ["playwright", "@browserbasehq/stagehand", "@browserbasehq/sdk"],
};

export default nextConfig;
