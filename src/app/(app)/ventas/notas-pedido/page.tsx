import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Notas de pedido" };

export default function Page() {
  return <EnConstruccion titulo="Notas de pedido" descripcion="Ventas nuevas y retiros de acopio" permiso="ventas.ver" />;
}
