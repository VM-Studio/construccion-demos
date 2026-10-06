import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Acopio" };

export default function Page() {
  return <EnConstruccion titulo="Acopio" descripcion="Detalle del acopio" permiso="acopios.ver" actualizacion />;
}
