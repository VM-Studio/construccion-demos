import { Suspense } from "react";
import type { Metadata } from "next";
import { NotasPedidoView } from "@/components/modulos/ventas/notas-pedido-view";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Notas de pedido" };

export default function Page() {
  return (
    <RequierePermiso permiso="ventas.ver">
      <Suspense>
        <NotasPedidoView />
      </Suspense>
    </RequierePermiso>
  );
}
