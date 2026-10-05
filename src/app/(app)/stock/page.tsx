import { Suspense } from "react";
import type { Metadata } from "next";
import { StockView } from "@/components/modulos/stock/stock-view";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Stock" };

export default function Page() {
  return (
    <RequierePermiso permiso="stock.ver">
      <Suspense>
        <StockView />
      </Suspense>
    </RequierePermiso>
  );
}
