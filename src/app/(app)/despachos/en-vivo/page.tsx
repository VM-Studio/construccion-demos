import { Suspense } from "react";
import type { Metadata } from "next";
import { DepositoEnVivo } from "@/components/modulos/despachos/en-vivo";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Depósito en vivo" };

export default function Page() {
  return (
    <RequierePermiso permiso="despachos.ver">
      <Suspense>
        <DepositoEnVivo />
      </Suspense>
    </RequierePermiso>
  );
}
