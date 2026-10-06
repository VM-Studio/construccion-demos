import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Nueva nota de pedido" };

export default function Page() {
  return <EnConstruccion titulo="Nueva nota de pedido" descripcion="Venta con origen, forma de pago y entrega" permiso="ventas.editar" />;
}
