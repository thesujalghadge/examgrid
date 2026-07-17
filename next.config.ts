import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  typedRoutes: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
