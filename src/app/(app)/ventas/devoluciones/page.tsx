import { Suspense } from "react";
import type { Metadata } from "next";
import { DevolucionesView } from "@/components/modulos/ventas/ventas-listados";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Devoluciones" };

export default function Page() {
  return (
    <RequierePermiso permiso="ventas.ver">
      <Suspense>
        <DevolucionesView />
      </Suspense>
    </RequierePermiso>
  );
}
