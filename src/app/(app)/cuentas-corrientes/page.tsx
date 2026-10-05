import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Cuentas corrientes" };

export default function Page() {
  return <EnConstruccion titulo="Cuentas corrientes" descripcion="Cobranzas, pagos y cartera de cheques" permiso="ctacte.ver" />;
}
