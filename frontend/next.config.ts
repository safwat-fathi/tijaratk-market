import type { NextConfig } from "next";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
const apiImageHost = apiBaseUrl ? new URL(apiBaseUrl).hostname : null;

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "tijaratk.com",
      },
      {
        protocol: "https",
        hostname: "cdn.mafrservices.com",
      },
      {
        protocol: "https",
        hostname: "cdn.chefaa.com",
      },
      {
        protocol: "https",
        hostname: "talabat.dhmedia.io",
        pathname: "/image/**",
      },
      {
        protocol: "https",
        hostname: "images.deliveryhero.io",
        pathname: "/image/**",
      },
      ...(apiImageHost
        ? [
            {
              protocol: "https" as const,
              hostname: apiImageHost,
            },
          ]
        : []),
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
      },
    ],
  },
};

export default nextConfig;
