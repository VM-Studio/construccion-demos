import { Suspense } from "react";
import type { Metadata } from "next";
import { RecibosView } from "@/components/modulos/ventas/ventas-listados";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Recibos" };

export default function Page() {
  return (
    <RequierePermiso permiso="ctacte.ver">
      <Suspense>
        <RecibosView />
      </Suspense>
    </RequierePermiso>
  );
}
