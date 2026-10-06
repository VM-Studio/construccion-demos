import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Devoluciones" };

export default function Page() {
  return <EnConstruccion titulo="Devoluciones" descripcion="Devoluciones de notas de pedido (DP)" permiso="ventas.ver" />;
}
