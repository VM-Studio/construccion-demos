import { Suspense } from "react";
import type { Metadata } from "next";
import { DesacopioView } from "@/components/modulos/acopios/desacopio-view";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Estado de desacopio" };

export default function Page() {
  return (
    <RequierePermiso permiso="acopios.ver">
      <Suspense>
        <DesacopioView />
      </Suspense>
    </RequierePermiso>
  );
}
