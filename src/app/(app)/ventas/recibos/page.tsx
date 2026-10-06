import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Recibos" };

export default function Page() {
  return <EnConstruccion titulo="Recibos" descripcion="Entrada de fondos con imputación a comprobantes y acopios" permiso="ctacte.ver" />;
}
