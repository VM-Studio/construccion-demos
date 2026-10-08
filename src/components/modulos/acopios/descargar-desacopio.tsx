"use client";
import * as React from "react";
import { toast } from "sonner";
import { ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";
import { useStore } from "@/store";
import { documentoAcopio, type DocDesacopio } from "@/lib/desacopio/datos";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { obtenerDb } from "@/lib/datos/almacen";

/**
 * Botón "Descargar" con menú PDF / Excel. La generación ocurre recién al elegir una opción
 * (jsPDF / exceljs se cargan con import dinámico).
 */
export function DescargarDocumento({ armar, entidad, entidadId, size, variant = "secondary" }: { armar: () => DocDesacopio; entidad: string; entidadId: string; size?: "sm" | "md"; variant?: "primary" | "secondary" | "ghost" }) {
  const [cargando, setCargando] = React.useState(false);
  const descargar = async (formato: "PDF" | "Excel") => {
    setCargando(true);
    const t = toast.loading(`Descargando ${entidad === "AcopioProveedor" ? "detalle de acopio con proveedor" : "estado de acopio"}…`);
    try {
      const doc = armar();
      const { saveAs } = await import("file-saver");
      if (formato === "PDF") {
        const { generarPdfDesacopio } = await import("@/lib/desacopio/pdf");
        saveAs(generarPdfDesacopio(doc), `${doc.archivo}.pdf`);
      } else {
        const { generarExcelDesacopio } = await import("@/lib/desacopio/excel");
        saveAs(await generarExcelDesacopio(doc), `${doc.archivo}.xlsx`);
      }
      useStore.getState().registrarEvento(`Descargó ${entidad === "AcopioProveedor" ? "detalle de acopio con proveedor" : "estado de desacopio"} ${doc.numero} (${formato})`, entidad, entidadId, `${doc.archivo}.${formato === "PDF" ? "pdf" : "xlsx"}`);
      toast.success(`${formato} descargado`, { id: t, description: `${doc.archivo}.${formato === "PDF" ? "pdf" : "xlsx"}` });
    } catch (e) {
      console.warn(e);
      toast.error("No se pudo generar el archivo", { id: t });
    } finally {
      setCargando(false);
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} loading={cargando} data-tour="descargar">
          <Download /> Descargar <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={() => void descargar("PDF")}>
          <FileText /> PDF
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void descargar("Excel")}>
          <FileSpreadsheet /> Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Descargar el estado de desacopio de un acopio de cliente. */
export function DescargarDesacopio({ acopioId, size, variant }: { acopioId: string; size?: "sm" | "md"; variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <DescargarDocumento
      size={size}
      variant={variant}
      entidad="Acopio"
      entidadId={acopioId}
      armar={() => documentoAcopio(obtenerDb(), acopioId)}
    />
  );
}
