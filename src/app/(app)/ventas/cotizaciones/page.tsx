import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Cotizaciones de venta" };

export default function Page() {
  return <EnConstruccion titulo="Cotizaciones de venta" descripcion="Cotizaciones con obra y circuito" permiso="ventas.ver" />;
}
