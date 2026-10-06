import { Suspense } from "react";
import type { Metadata } from "next";
import { DespachosView } from "@/components/modulos/despachos/despachos-view";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Despachos" };

export default function Page() {
  return (
    <RequierePermiso permiso="despachos.ver">
      <Suspense>
        <DespachosView />
      </Suspense>
    </RequierePermiso>
  );
}
