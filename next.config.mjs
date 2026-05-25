/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // Evita que o Turbopack resolva `.prisma/client` para wasm/edge-light (exige prisma://).
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
