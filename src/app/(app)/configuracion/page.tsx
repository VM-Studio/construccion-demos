import { Suspense } from "react";
import type { Metadata } from "next";
import { ConfigView } from "@/components/modulos/config/config-view";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Configuración" };

export default function Page() {
  return (
    <RequierePermiso permiso="config.ver">
      <Suspense>
        <ConfigView />
      </Suspense>
    </RequierePermiso>
  );
}
