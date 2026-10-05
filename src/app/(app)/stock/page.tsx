import type { Metadata } from "next";
import { EnConstruccion } from "@/components/modulos/en-construccion";

export const metadata: Metadata = { title: "Stock" };

export default function Page() {
  return <EnConstruccion titulo="Stock" descripcion="Posición por depósito, movimientos, transferencias y ajustes" permiso="stock.ver" />;
}
