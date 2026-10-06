import { Suspense } from "react";
import type { Metadata } from "next";
import { AlertasView } from "@/components/modulos/inicio/alertas-view";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Alertas" };

export default function Page() {
  return (
    <RequierePermiso permiso="tablero.ver">
      <Suspense>
        <AlertasView />
      </Suspense>
    </RequierePermiso>
  );
}
