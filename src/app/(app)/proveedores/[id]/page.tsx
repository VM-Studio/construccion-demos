import { Suspense } from "react";
import type { Metadata } from "next";
import { ProveedorFicha } from "@/components/modulos/proveedores/proveedores-view";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Proveedor" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequierePermiso permiso="proveedores.ver">
      <Suspense>
        <ProveedorFicha key={id} id={id} />
      </Suspense>
    </RequierePermiso>
  );
}
