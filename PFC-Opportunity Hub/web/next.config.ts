import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / Node-only database drivers (Turso via Prisma driver adapter, ADR-005): load from
  // node_modules at runtime instead of bundling them with webpack.
  serverExternalPackages: ["@prisma/adapter-libsql", "@libsql/client", "libsql"],
};

export default nextConfig;
