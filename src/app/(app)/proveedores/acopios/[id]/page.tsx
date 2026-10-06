import { Suspense } from "react";
import type { Metadata } from "next";
import { AcopioProveedorDetalle } from "@/components/modulos/proveedores/acopios-proveedor";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Acopio con proveedor" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequierePermiso permiso="proveedores.ver">
      <Suspense>
        <AcopioProveedorDetalle key={id} id={id} />
      </Suspense>
    </RequierePermiso>
  );
}
