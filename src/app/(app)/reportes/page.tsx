import type { Metadata } from "next";
import { ReportesIndex } from "@/components/modulos/reportes/reportes-index";
import { RequierePermiso } from "@/components/shared/requiere-permiso";

export const metadata: Metadata = { title: "Reportes" };

export default function Page() {
  return (
    <RequierePermiso permiso="reportes.ver">
      <ReportesIndex />
    </RequierePermiso>
  );
}
