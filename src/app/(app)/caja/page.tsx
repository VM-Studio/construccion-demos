import { Suspense } from "react";
import type { Metadata } from "next";
import { CajaView } from "@/components/modulos/caja/caja-view";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Caja chica" };

export default function Page() {
  return (
    <RequierePermiso permiso="caja.ver">
      <Suspense>
        <CajaView />
      </Suspense>
    </RequierePermiso>
  );
}
