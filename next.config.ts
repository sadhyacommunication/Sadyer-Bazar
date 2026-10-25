import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const devApiPort = process.env.DEV_API_PORT || "8788";

const nextConfig: NextConfig = {
  ...(isProd ? { output: "export" } : {}),
  images: {
    unoptimized: true, // Required for Cloudflare Pages static/edge asset delivery
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
  ...(!isProd
    ? {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: `http://127.0.0.1:${devApiPort}/api/:path*`,
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;
