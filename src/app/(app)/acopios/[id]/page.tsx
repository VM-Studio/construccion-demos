import type { Metadata } from "next";
import { AcopioDetalle } from "@/components/modulos/acopios/acopio-detalle";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Acopio" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequierePermiso permiso="acopios.ver">
      <AcopioDetalle key={id} id={id} />
    </RequierePermiso>
  );
}
