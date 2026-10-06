import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Ventas" };

export default function Page() {
  return <EnConstruccion titulo="Ventas" descripcion="Notas de pedido, cotizaciones y comprobantes" permiso="ventas.ver" actualizacion />;
}
