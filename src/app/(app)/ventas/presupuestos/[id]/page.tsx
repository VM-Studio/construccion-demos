import type { Metadata } from "next";
import { VentaEditor } from "@/components/modulos/ventas/venta-editor";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Presupuesto" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequierePermiso permiso="ventas.ver">
      <VentaEditor key={id} tipo="presupuesto" id={id} />
    </RequierePermiso>
  );
}
