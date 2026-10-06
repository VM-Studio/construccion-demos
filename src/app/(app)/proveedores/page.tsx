import { Suspense } from "react";
import type { Metadata } from "next";
import { ProveedoresView } from "@/components/modulos/proveedores/proveedores-view";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Proveedores" };

export default function Page() {
  return (
    <RequierePermiso permiso="proveedores.ver">
      <Suspense>
        <ProveedoresView />
      </Suspense>
    </RequierePermiso>
  );
}
