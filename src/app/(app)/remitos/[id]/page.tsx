import { Suspense } from "react";
import type { Metadata } from "next";
import { RemitoDetalle } from "@/components/modulos/remitos/remito-detalle";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Remito" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequierePermiso permiso="remitos.ver">
      <Suspense>
        <RemitoDetalle key={id} id={id} />
      </Suspense>
    </RequierePermiso>
  );
}
