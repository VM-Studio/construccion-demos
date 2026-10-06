import { Suspense } from "react";
import type { Metadata } from "next";
import { VentasView } from "@/components/modulos/ventas/ventas-view";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Ventas" };

export default function Page() {
  return (
    <RequierePermiso permiso="ventas.ver">
      <Suspense>
        <VentasView />
      </Suspense>
    </RequierePermiso>
  );
}
