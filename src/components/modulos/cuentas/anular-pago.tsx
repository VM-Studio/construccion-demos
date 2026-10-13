"use client";
import * as React from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/store";
import { usePuede } from "@/store/selectors";
import type { Cobranza, PagoProveedor } from "@/domain/types";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { Impacto, medir } from "@/capacitacion";
import { formatMoney } from "@/lib/format";

/** Botón "Anular" de un recibo o una orden de pago: pide el motivo y devuelve el saldo a las facturas. */
export function BotonAnularPago({ tipo, doc, onAnulado }: { tipo: "recibo"; doc: Cobranza; onAnulado?: () => void } | { tipo: "orden"; doc: PagoProveedor; onAnulado?: () => void }) {
  const puede = usePuede(tipo === "recibo" ? "ctacte.cobrar" : "ctacte.pagar");
  const [open, setOpen] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  if (!puede || doc.anulado) return null;
  const nombre = tipo === "recibo" ? "recibo" : "orden de pago";
  const accion = tipo === "recibo" ? "anularRecibo" : "anularOrdenPago";
  return (
    <>
      <Button variant="ghost" className="mr-auto text-danger" onClick={() => setOpen(true)}>
        <Ban /> Anular {nombre}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setMotivo("");
        }}
        titulo={`Anular ${nombre} ${doc.numero}`}
        descripcion={`${formatMoney(doc.total)} · las facturas que cancelaba vuelven a quedar con saldo en la cuenta corriente.`}
        confirmLabel="Anular"
        variant="danger"
        onConfirm={async () => {
          if (!motivo.trim()) {
            toast.error("Indicá el motivo de la anulación.");
            return false;
          }
          const r = await medir(accion, tipo === "recibo" ? { clienteId: doc.clienteId } : { proveedorId: doc.proveedorId }, () =>
            tipo === "recibo" ? useStore.getState().anularCobranza(doc.id, motivo.trim()) : useStore.getState().anularPagoProveedor(doc.id, motivo.trim()),
          );
          if (!r.ok) {
            toast.error(r.error);
            return false;
          }
          toast.success(`${tipo === "recibo" ? "Recibo" : "Orden de pago"} ${doc.numero} anulado`);
          onAnulado?.();
          return true;
        }}
      >
        <div className="space-y-3">
          <FormField label="Motivo" required htmlFor="anular-motivo">
            <Textarea id="anular-motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: cobro cargado por error" autoFocus />
          </FormField>
          <p className="text-[13px] text-muted">Queda visible como anulado y registrado en la auditoría.</p>
          <Impacto accion={accion} />
        </div>
      </ConfirmDialog>
    </>
  );
}

/** Franja arriba del documento anulado (no se imprime fuera del diálogo). */
export function AvisoAnulado({ motivo }: { motivo?: string }) {
  return (
    <div className="border-b border-border bg-subtle px-4 py-2 text-[12px] text-muted">
      <b className="text-ink">Anulado</b>
      {motivo ? ` · ${motivo}` : ""}
    </div>
  );
}
