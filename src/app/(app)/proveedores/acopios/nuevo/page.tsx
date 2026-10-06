import { Suspense } from "react";
import type { Metadata } from "next";
import { AcopioProveedorNuevo } from "@/components/modulos/proveedores/acopios-proveedor";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Nuevo acopio con proveedor" };

export default function Page() {
  return (
    <RequierePermiso permiso="acopiosProveedor.editar">
      <Suspense>
        <AcopioProveedorNuevo />
      </Suspense>
    </RequierePermiso>
  );
}
