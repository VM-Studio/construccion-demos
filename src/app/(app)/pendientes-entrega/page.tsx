import { Suspense } from "react";
import type { Metadata } from "next";
import { PendientesEntregaView } from "@/components/modulos/ventas/pendientes-entrega-view";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Pendientes de entrega" };

export default function Page() {
  return (
    <RequierePermiso permiso="ventas.ver">
      <Suspense>
        <PendientesEntregaView />
      </Suspense>
    </RequierePermiso>
  );
}
