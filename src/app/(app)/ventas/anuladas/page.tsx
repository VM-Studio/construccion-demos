import { Suspense } from "react";
import type { Metadata } from "next";
import { VentasAnuladasView } from "@/components/modulos/ventas/cotizaciones";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Ventas anuladas" };

export default function Page() {
  return (
    <RequierePermiso permiso="ventas.ver">
      <Suspense>
        <VentasAnuladasView />
      </Suspense>
    </RequierePermiso>
  );
}
