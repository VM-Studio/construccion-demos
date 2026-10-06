import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Pendientes de entrega" };

export default function Page() {
  return <EnConstruccion titulo="Pendientes de entrega" descripcion="Todo lo vendido o retirado de acopio que todavía no se entregó" permiso="ventas.ver" />;
}
