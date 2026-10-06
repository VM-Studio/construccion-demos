import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Pendientes de retirar" };

export default function Page() {
  return <EnConstruccion titulo="Pendientes de retirar" descripcion="Todo lo que la empresa tiene derecho a retirar" permiso="proveedores.ver" />;
}
