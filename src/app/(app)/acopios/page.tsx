import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Acopios" };

export default function Page() {
  return <EnConstruccion titulo="Acopios" descripcion="Contratos de acopio y deuda de mercadería" permiso="acopios.ver" />;
}
