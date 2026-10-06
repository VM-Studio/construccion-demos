import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Depósito en vivo" };

export default function Page() {
  return <EnConstruccion titulo="Depósito en vivo" descripcion="Espera, preparación y finalizados del día" permiso="despachos.ver" />;
}
