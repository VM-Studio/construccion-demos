import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Proveedores" };

export default function Page() {
  return <EnConstruccion titulo="Proveedores" descripcion="Lo que les debemos y lo que nos falta retirar" permiso="proveedores.ver" />;
}
