import { Suspense } from "react";
import type { Metadata } from "next";
import { AcopiosView } from "@/components/modulos/acopios/acopios-view";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Acopios de clientes" };

export default function Page() {
  return (
    <RequierePermiso permiso="acopios.ver">
      <Suspense>
        <AcopiosView />
      </Suspense>
    </RequierePermiso>
  );
}
