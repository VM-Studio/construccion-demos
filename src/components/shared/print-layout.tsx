"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import { Printer } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEmpresa } from "@/store/selectors";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Documento imprimible A4: encabezado con la empresa (logo textual y datos),
 * título y número, cuerpo y pie. Se usa para remitos, OC, presupuestos, recibos…
 */
export function PrintLayout({
  titulo,
  numero,
  fecha,
  subtitulo,
  leyenda,
  children,
  pie,
  className,
}: {
  titulo: string;
  numero?: string;
  fecha?: string;
  subtitulo?: React.ReactNode;
  /** Leyenda destacada, p. ej. "Comprobante no fiscal · Demo". */
  leyenda?: string;
  children: React.ReactNode;
  pie?: React.ReactNode;
  className?: string;
}) {
  const e = useEmpresa();
  return (
    <div className={cn("print-area mx-auto w-full max-w-[210mm] bg-white p-8 text-[12px] leading-snug text-ink", className)}>
      <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-4">
        <div>
          <div className="text-[20px] font-bold tracking-tight">{e.empresa}</div>
          <div className="mt-1 text-[11px] text-muted">
            {e.razonSocial} · CUIT {e.cuit}
            <br />
            {e.direccion}
            <br />
            {e.telefono} · {e.email}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[16px] font-semibold uppercase tracking-wide">{titulo}</div>
          {numero && <div className="mt-0.5 text-[14px] font-semibold tnum">{numero}</div>}
          {fecha && <div className="mt-0.5 text-[11px] text-muted">Fecha: {fecha}</div>}
          {leyenda && <div className="mt-1.5 inline-block rounded-[4px] border border-ink px-1.5 py-0.5 text-[10px] font-semibold uppercase">{leyenda}</div>}
        </div>
      </header>
      {subtitulo && <div className="border-b border-border py-3">{subtitulo}</div>}
      <div className="py-4">{children}</div>
      <footer className="mt-6 flex items-end justify-between border-t border-border pt-3 text-[10px] text-muted">
        <div>{pie}</div>
        <div>Emitido {formatDateTime(new Date())}</div>
      </footer>
    </div>
  );
}

/** Tabla limpia para documentos impresos. */
export function PrintTable({ head, rows, foot, className }: { head: React.ReactNode[]; rows: React.ReactNode[][]; foot?: React.ReactNode[]; className?: string }) {
  return (
    <table className={cn("w-full border-collapse text-[11px]", className)}>
      <thead>
        <tr className="border-b border-ink">
          {head.map((h, i) => (
            <th key={i} className="py-1.5 pr-2 text-left font-semibold last:pr-0 [&.r]:text-right">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-border">
            {r.map((c, j) => (
              <td key={j} className="py-1.5 pr-2 align-top last:pr-0">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {foot && (
        <tfoot>
          <tr className="border-t border-ink font-semibold">
            {foot.map((c, i) => (
              <td key={i} className="py-1.5 pr-2 last:pr-0">
                {c}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  );
}

/**
 * Vista previa + impresión: muestra el documento en un diálogo y lo imprime
 * desde un portal propio (el resto de la app se oculta con @media print).
 */
export function PrintPreview({
  open,
  onOpenChange,
  titulo,
  children,
  onPrint,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  titulo: string;
  children: React.ReactNode;
  onPrint?: () => void;
}) {
  const [montado, setMontado] = React.useState(false);
  React.useEffect(() => setMontado(true), []);
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          size="xl"
          title={titulo}
          description="Vista previa de impresión (A4)"
          footer={
            <>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
              <Button
                onClick={() => {
                  onPrint?.();
                  window.print();
                }}
              >
                <Printer />
                Imprimir / PDF
              </Button>
            </>
          }
        >
          <div className="rounded-card bg-subtle p-3 sm:p-6">
            <div className="mx-auto max-w-[210mm] border border-border bg-white shadow-pop">{children}</div>
          </div>
        </DialogContent>
      </Dialog>
      {montado && open && createPortal(<div className="print-portal">{children}</div>, document.body)}
    </>
  );
}

/** Hook de conveniencia para manejar el estado de una vista imprimible. */
export function usePrint() {
  const [open, setOpen] = React.useState(false);
  return { open, setOpen, abrir: () => setOpen(true) };
}
