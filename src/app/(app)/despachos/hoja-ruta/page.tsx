import { Suspense } from "react";
import type { Metadata } from "next";
import { HojaRutaView } from "@/components/modulos/despachos/hoja-ruta";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Hoja de ruta" };

export default function Page() {
  return (
    <RequierePermiso permiso="despachos.ver">
      <Suspense>
        <HojaRutaView />
      </Suspense>
    </RequierePermiso>
  );
}
