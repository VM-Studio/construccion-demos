import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
