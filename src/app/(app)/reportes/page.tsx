import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Reportes" };

export default function Page() {
  return <EnConstruccion titulo="Reportes" descripcion="Ventas, rentabilidad, valorización y más" permiso="reportes.ver" />;
}
