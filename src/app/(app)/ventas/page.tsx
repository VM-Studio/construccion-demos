import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Ventas" };

export default function Page() {
  return <EnConstruccion titulo="Ventas" descripcion="Pedidos, presupuestos, comprobantes y clientes" permiso="ventas.ver" />;
}
