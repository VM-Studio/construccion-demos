import { Suspense } from "react";
import type { Metadata } from "next";
import { ClienteFicha } from "@/components/modulos/clientes/cliente-ficha";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Cliente" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequierePermiso permiso="clientes.ver">
      <Suspense>
        <ClienteFicha key={id} id={id} />
      </Suspense>
    </RequierePermiso>
  );
}
