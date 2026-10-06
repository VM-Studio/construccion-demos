import { Suspense } from "react";
import type { Metadata } from "next";
import { ListasPreciosView } from "@/components/modulos/config/config-view";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Listas de precios" };

export default function Page() {
  return (
    <RequierePermiso permiso="productos.ver">
      <Suspense>
        <ListasPreciosView />
      </Suspense>
    </RequierePermiso>
  );
}
