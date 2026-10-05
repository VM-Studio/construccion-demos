import type { Metadata } from "next";
import { TableroView } from "@/components/modulos/tablero/tablero-view";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Tablero" };

export default function Page() {
  return (
    <RequierePermiso permiso="tablero.ver">
      <TableroView />
    </RequierePermiso>
  );
}
