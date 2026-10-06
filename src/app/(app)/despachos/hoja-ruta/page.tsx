import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Hoja de ruta" };

export default function Page() {
  return <EnConstruccion titulo="Hoja de ruta" descripcion="Envíos del día por vehículo" permiso="despachos.ver" />;
}
