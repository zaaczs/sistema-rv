import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // Evita que o Turbopack resolva `.prisma/client` para wasm/edge-light (exige prisma://).
  // Mantém o cliente Node com engine binária e SQLite `file:`.
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
