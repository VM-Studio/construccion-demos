import { Suspense } from "react";
import type { Metadata } from "next";
import { PendientesRetirarView } from "@/components/modulos/proveedores/acopios-proveedor";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Pendientes de retirar" };

export default function Page() {
  return (
    <RequierePermiso permiso="proveedores.ver">
      <Suspense>
        <PendientesRetirarView />
      </Suspense>
    </RequierePermiso>
  );
}
