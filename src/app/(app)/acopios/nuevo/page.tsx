import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Nuevo acopio" };

export default function Page() {
  return <EnConstruccion titulo="Nuevo acopio" descripcion="Acopio por monto con precios congelados" permiso="acopios.editar" actualizacion />;
}
