import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Configuración" };

export default function Page() {
  return <EnConstruccion titulo="Configuración" descripcion="Empresa, usuarios, parámetros y datos del demo" permiso="config.ver" />;
}
