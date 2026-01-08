import type { NextConfig } from "next";

const CORE_API_URL = process.env.CORE_API_URL ?? "http://localhost:4000";

const config: NextConfig = {
  typedRoutes: true,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${CORE_API_URL}/api/:path*` }];
  },
};

export default config;
