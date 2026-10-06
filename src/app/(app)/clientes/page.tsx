import { Suspense } from "react";
import type { Metadata } from "next";
import { ClientesView } from "@/components/modulos/clientes/clientes-view";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Clientes" };

export default function Page() {
  return (
    <RequierePermiso permiso="clientes.ver">
      <Suspense>
        <ClientesView />
      </Suspense>
    </RequierePermiso>
  );
}
