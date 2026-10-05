import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Productos" };

export default function Page() {
  return <EnConstruccion titulo="Productos" descripcion="Catálogo y listas de precios" permiso="productos.ver" />;
}
