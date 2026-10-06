import { Suspense } from "react";
import type { Metadata } from "next";
import { CuentasView } from "@/components/modulos/cuentas/cuentas-view";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Cartera de cheques" };

export default function Page() {
  return (
    <RequierePermiso permiso="ctacte.ver">
      <Suspense>
        <CuentasView tab="cheques" />
      </Suspense>
    </RequierePermiso>
  );
}
