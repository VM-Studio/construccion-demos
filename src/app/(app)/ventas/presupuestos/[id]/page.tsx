import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Cotización" };

export default function Page() {
  return <EnConstruccion titulo="Cotización" descripcion="Detalle de la cotización" permiso="ventas.ver" actualizacion />;
}
