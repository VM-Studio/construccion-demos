"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PosicionTab } from "./posicion-tab";
import { MovimientosTab } from "./movimientos-tab";
import { TransferenciasTab } from "./transferencias-tab";
import { AjustesTab } from "./ajustes-tab";

export function StockView() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("tab") ?? "posicion";
  return (
    <>
      <PageHeader titulo="Stock" descripcion="Físico, comprometido y disponible por depósito, con trazabilidad completa de cada movimiento." />
      <Tabs value={tab} onValueChange={(v) => router.replace(`/stock?tab=${v}`, { scroll: false })}>
        <TabsList className="mb-4">
          <TabsTrigger value="posicion">Posición de stock</TabsTrigger>
          <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
          <TabsTrigger value="transferencias">Transferencias</TabsTrigger>
          <TabsTrigger value="ajustes">Ajustes</TabsTrigger>
        </TabsList>
        <TabsContent value="posicion">
          <PosicionTab filtroInicial={params.get("filtro")} />
        </TabsContent>
        <TabsContent value="movimientos">
          <MovimientosTab />
        </TabsContent>
        <TabsContent value="transferencias">
          <TransferenciasTab abrirId={params.get("id")} nuevo={params.get("nuevo") === "1"} productoInicial={params.get("producto")} />
        </TabsContent>
        <TabsContent value="ajustes">
          <AjustesTab abrirId={params.get("id")} nuevo={params.get("nuevo") === "1"} productoInicial={params.get("producto")} />
        </TabsContent>
      </Tabs>
    </>
  );
}
