import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Obras" };

export default function Page() {
  return <EnConstruccion titulo="Obras" descripcion="Obras de cada cliente" permiso="clientes.ver" />;
}
