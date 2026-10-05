import { Suspense } from "react";
import type { Metadata } from "next";
import { ProductosView } from "@/components/modulos/productos/productos-view";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Productos" };

export default function Page() {
  return (
    <RequierePermiso permiso="productos.ver">
      <Suspense>
        <ProductosView />
      </Suspense>
    </RequierePermiso>
  );
}
