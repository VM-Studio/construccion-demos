import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Acopios con proveedores" };

export default function Page() {
  return <EnConstruccion titulo="Acopios con proveedores" descripcion="Plata nuestra depositada y mercadería por retirar" permiso="proveedores.ver" />;
}
