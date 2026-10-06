import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Órdenes de pago" };

export default function Page() {
  return <EnConstruccion titulo="Órdenes de pago" descripcion="Salida de fondos con imputación" permiso="ctacte.pagar" />;
}
