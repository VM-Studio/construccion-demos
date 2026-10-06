import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Comprobantes de compra" };

export default function Page() {
  return <EnConstruccion titulo="Comprobantes de compra" descripcion="Facturas y notas de crédito de proveedores" permiso="compras.editar" />;
}
