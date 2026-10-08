import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
