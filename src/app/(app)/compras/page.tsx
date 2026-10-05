import { Suspense } from "react";
import type { Metadata } from "next";
import { ComprasView } from "@/components/modulos/compras/compras-view";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Compras" };

export default function Page() {
  return (
    <RequierePermiso permiso="compras.ver">
      <Suspense>
        <ComprasView />
      </Suspense>
    </RequierePermiso>
  );
}
