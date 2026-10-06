import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Remitos" };

export default function Page() {
  return <EnConstruccion titulo="Remitos" descripcion="Buscador global de remitos" permiso="remitos.ver" />;
}
