"use client";

import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { PosicionTab } from "./posicion-tab";
import { MovimientosTab } from "./movimientos-tab";
import { TransferenciasTab } from "./transferencias-tab";
import { AjustesTab } from "./ajustes-tab";

const TITULOS = {
  posicion: ["Listado de stock", "Físico, pendiente de entrega, reservado y disponible por depósito."],
  movimientos: ["Movimientos de stock", "Kardex con la trazabilidad completa de cada movimiento."],
  transferencias: ["Transferencias", "Movimientos de mercadería entre depósitos."],
  ajustes: ["Ajustes e inventarios", "Roturas, faltantes, sobrantes y conteos."],
} as const;

export function StockView({ tab }: { tab: keyof typeof TITULOS }) {
  const params = useSearchParams();
  const [titulo, descripcion] = TITULOS[tab];
  return (
    <>
      <PageHeader titulo={titulo} descripcion={descripcion} />
      {tab === "posicion" && <PosicionTab filtroInicial={params.get("filtro")} />}
      {tab === "movimientos" && <MovimientosTab />}
      {tab === "transferencias" && <TransferenciasTab abrirId={params.get("id")} nuevo={params.get("nuevo") === "1"} productoInicial={params.get("producto")} />}
      {tab === "ajustes" && <AjustesTab abrirId={params.get("id")} nuevo={params.get("nuevo") === "1"} productoInicial={params.get("producto")} motivoInicial={params.get("motivo")} />}
    </>
  );
}
