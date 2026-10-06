import { Suspense } from "react";
import type { Metadata } from "next";
import { AcopioNuevo } from "@/components/modulos/acopios/acopio-nuevo";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Nuevo acopio" };

export default function Page() {
  return (
    <RequierePermiso permiso="acopios.editar">
      <Suspense>
        <AcopioNuevo />
      </Suspense>
    </RequierePermiso>
  );
}
