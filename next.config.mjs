/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone-сборка: .next/standalone/server.js + минимум node_modules —
  // на этом строится Docker-образ (см. Dockerfile)
  output: "standalone",
};

export default nextConfig;
