import { Suspense } from "react";
import type { Metadata } from "next";
import { RemitosView } from "@/components/modulos/remitos/remitos-view";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Remitos" };

export default function Page() {
  return (
    <RequierePermiso permiso="remitos.ver">
      <Suspense>
        <RemitosView />
      </Suspense>
    </RequierePermiso>
  );
}
