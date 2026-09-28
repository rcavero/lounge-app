import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad de todas las respuestas (RCA-286, R5). Vercel ya pone HSTS.
 *
 * Lo que se deja fuera, a propósito:
 * - Una CSP de scripts. Next inyecta scripts en línea y exigiría nonces, lo que vuelve
 *   dinámicas todas las páginas. No compensa en una app sin HTML de terceros.
 * - `form-action`: el formulario de pago se envía a Redsys, otro dominio.
 * - `object-src`: los PDF (ticket e informe) se abren como blob, que hereda la CSP de
 *   la página, y el visor del navegador podría dejar de mostrarlos.
 *
 * `frame-ancestors 'none'` + `X-Frame-Options` (para navegadores viejos): nadie puede
 * incrustar la web en un iframe, así que no se puede engañar a nadie para que pulse un
 * botón del panel dentro de otra página (clickjacking). Redsys no la incrusta: el pago
 * es por redirección.
 */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
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
