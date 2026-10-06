import { Suspense } from "react";
import type { Metadata } from "next";
import { InicioView } from "@/components/modulos/inicio/inicio-view";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Inicio" };

export default function Page() {
  return (
    <RequierePermiso permiso="tablero.ver">
      <Suspense>
        <InicioView />
      </Suspense>
    </RequierePermiso>
  );
}
