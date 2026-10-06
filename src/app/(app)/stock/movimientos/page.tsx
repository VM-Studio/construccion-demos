import { Suspense } from "react";
import type { Metadata } from "next";
import { StockView } from "@/components/modulos/stock/stock-view";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Movimientos de stock" };

export default function Page() {
  return (
    <RequierePermiso permiso="stock.ver">
      <Suspense>
        <StockView tab="movimientos" />
      </Suspense>
    </RequierePermiso>
  );
}
