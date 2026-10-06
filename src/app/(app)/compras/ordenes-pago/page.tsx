import { Suspense } from "react";
import type { Metadata } from "next";
import { OrdenesPagoView } from "@/components/modulos/compras/compras-listados";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Órdenes de pago" };

export default function Page() {
  return (
    <RequierePermiso permiso="ctacte.pagar">
      <Suspense>
        <OrdenesPagoView />
      </Suspense>
    </RequierePermiso>
  );
}
