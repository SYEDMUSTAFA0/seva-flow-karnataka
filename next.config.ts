import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@electric-sql/pglite",
    "pglite-prisma-adapter",
    "@prisma/client",
    "@prisma/adapter-pglite",
    "prisma",
  ],
  outputFileTracingExcludes: {
    "*": ["./.data/**"],
  },
  async headers() {
    return [
      {
        source: "/api/files/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
