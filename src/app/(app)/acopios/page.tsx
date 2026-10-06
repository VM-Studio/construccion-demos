import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Acopios de clientes" };

export default function Page() {
  return <EnConstruccion titulo="Acopios de clientes" descripcion="Acopios por monto con precios congelados" permiso="acopios.ver" actualizacion />;
}
