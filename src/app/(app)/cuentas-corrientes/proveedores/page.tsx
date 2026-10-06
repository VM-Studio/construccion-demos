import { Suspense } from "react";
import type { Metadata } from "next";
import { CuentasView } from "@/components/modulos/cuentas/cuentas-view";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Cuentas corrientes de proveedores" };

export default function Page() {
  return (
    <RequierePermiso permiso="ctacte.pagar">
      <Suspense>
        <CuentasView tab="proveedores" />
      </Suspense>
    </RequierePermiso>
  );
}
