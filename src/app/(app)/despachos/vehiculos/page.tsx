import { Suspense } from "react";
import type { Metadata } from "next";
import { VehiculosView } from "@/components/modulos/config/config-view";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Vehículos y choferes" };

export default function Page() {
  return (
    <RequierePermiso permiso="despachos.ver">
      <Suspense>
        <VehiculosView />
      </Suspense>
    </RequierePermiso>
  );
}
