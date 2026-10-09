import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

/** CSP: solo el propio origen, más Vercel Blob para las subidas directas desde el navegador. */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://vercel.com https://*.vercel-storage.com",
  "frame-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const HEADERS_SEGURIDAD = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: HEADERS_SEGURIDAD }];
  },
  // Importaciones CSV grandes viajan en una server action.
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  // El adapter de Neon usa WebSocket nativo de Node (ws) en el servidor.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-neon", "@neondatabase/serverless", "ws"],
  async redirects() {
    return [
      { source: "/ventas", destination: "/ventas/notas-pedido", permanent: false },
      { source: "/ventas/pedidos/:id", destination: "/ventas/notas-pedido/:id", permanent: false },
      { source: "/ventas/presupuestos/:id", destination: "/ventas/cotizaciones", permanent: false },
      { source: "/compras", destination: "/compras/ordenes", permanent: false },
      { source: "/cuentas-corrientes", destination: "/cuentas-corrientes/clientes", permanent: false },
    ];
  },
};

export default nextConfig;
