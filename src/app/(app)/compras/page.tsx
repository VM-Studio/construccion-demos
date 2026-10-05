import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Compras" };

export default function Page() {
  return <EnConstruccion titulo="Compras" descripcion="Órdenes de compra, recepciones y proveedores" permiso="compras.ver" />;
}
