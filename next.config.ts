import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        pathname: "/**",
      },
      {
        // Escudos de equipo y emblemas de competición de ESPN
        protocol: "https",
        hostname: "a.espncdn.com",
        pathname: "/**",
      },
      {
        // Proveedor anterior: se conserva para los eventos históricos cuyos
        // emblemas siguen apuntando aquí (ver LEGACY_COMPETITION_EMBLEM)
        protocol: "https",
        hostname: "crests.football-data.org",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
