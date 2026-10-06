import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Comprobantes de venta" };

export default function Page() {
  return <EnConstruccion titulo="Comprobantes de venta" descripcion="Facturas F1 / F2 y notas de crédito" permiso="ventas.ver" />;
}
