import { Suspense } from "react";
import type { Metadata } from "next";
import { NotaPedidoEditor } from "@/components/modulos/ventas/nota-pedido-editor";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Nueva nota de pedido" };

export default function Page() {
  return (
    <RequierePermiso permiso="ventas.editar">
      <Suspense>
        <NotaPedidoEditor />
      </Suspense>
    </RequierePermiso>
  );
}
