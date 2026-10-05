import type { Metadata } from "next";
import { OCEditor } from "@/components/modulos/compras/oc-editor";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Orden de compra" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequierePermiso permiso="compras.ver">
      <OCEditor key={id} id={id} />
    </RequierePermiso>
  );
}
