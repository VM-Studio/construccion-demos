import { Suspense } from "react";
import type { Metadata } from "next";
import { ComprobantesView } from "@/components/modulos/ventas/ventas-listados";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Comprobantes de venta" };

export default function Page() {
  return (
    <RequierePermiso permiso="ventas.ver">
      <Suspense>
        <ComprobantesView />
      </Suspense>
    </RequierePermiso>
  );
}
