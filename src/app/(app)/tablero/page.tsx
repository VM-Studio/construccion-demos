import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Tablero" };

export default function Page() {
  return <EnConstruccion titulo="Tablero" descripcion="Resumen del negocio" permiso="tablero.ver" />;
}
