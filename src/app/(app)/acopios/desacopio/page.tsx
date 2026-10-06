import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Estado de desacopio" };

export default function Page() {
  return <EnConstruccion titulo="Estado de desacopio" descripcion="Detalle del acopio con descarga en PDF y Excel" permiso="acopios.ver" />;
}
