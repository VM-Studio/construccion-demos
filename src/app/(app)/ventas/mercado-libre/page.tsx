import { Suspense } from "react";
import type { Metadata } from "next";
import { MercadoLibreView } from "@/components/modulos/ventas/mercado-libre";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Mercado Libre" };

export default function Page() {
  return (
    <RequierePermiso permiso="ventas.ver">
      <Suspense>
        <MercadoLibreView />
      </Suspense>
    </RequierePermiso>
  );
}
