import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Clientes" };

export default function Page() {
  return <EnConstruccion titulo="Clientes" descripcion="Centro de operación comercial: acopiar, vender, cobrar y entregar" permiso="clientes.ver" />;
}
