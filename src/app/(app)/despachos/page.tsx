import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Despachos" };

export default function Page() {
  return <EnConstruccion titulo="Despachos" descripcion="Remitos, hoja de ruta y vehículos" permiso="despachos.ver" />;
}
