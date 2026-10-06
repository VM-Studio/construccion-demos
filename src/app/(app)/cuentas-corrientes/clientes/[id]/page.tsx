import type { Metadata } from "next";
import { EstadoCuenta } from "@/components/modulos/cuentas/estado-cuenta";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Estado de cuenta" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequierePermiso permiso="ctacte.ver">
      <EstadoCuenta key={id} tipo="cliente" id={id} />
    </RequierePermiso>
  );
}
