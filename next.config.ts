import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // libSQL trae binarios nativos: no debe empaquetarse en el bundle del servidor.
  serverExternalPackages: ["@libsql/client"],
};

export default nextConfig;
