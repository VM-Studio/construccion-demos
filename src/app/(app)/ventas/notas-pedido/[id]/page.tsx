import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Nota de pedido" };

export default function Page() {
  return <EnConstruccion titulo="Nota de pedido" descripcion="Detalle de la nota de pedido" permiso="ventas.ver" />;
}
