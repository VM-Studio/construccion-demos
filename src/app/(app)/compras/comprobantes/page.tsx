import { Suspense } from "react";
import type { Metadata } from "next";
import { ComprobantesCompraView } from "@/components/modulos/compras/compras-listados";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Comprobantes de compra" };

export default function Page() {
  return (
    <RequierePermiso permiso="compras.editar">
      <Suspense>
        <ComprobantesCompraView />
      </Suspense>
    </RequierePermiso>
  );
}
