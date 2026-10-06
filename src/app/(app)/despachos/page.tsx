import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Despachos" };

export default function Page() {
  return <EnConstruccion titulo="Despachos" descripcion="Espera, preparación y entregas" permiso="despachos.ver" actualizacion />;
}
