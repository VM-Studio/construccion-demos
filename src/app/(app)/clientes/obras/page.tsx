import { Suspense } from "react";
import type { Metadata } from "next";
import { ObrasView } from "@/components/modulos/ventas/ventas-listados";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Obras" };

export default function Page() {
  return (
    <RequierePermiso permiso="clientes.ver">
      <Suspense>
        <ObrasView />
      </Suspense>
    </RequierePermiso>
  );
}
