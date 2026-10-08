"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { useStore } from "@/store";
import { useDb } from "@/store/selectors";
import type { MedioCobro, MedioPago } from "@/domain/types";
import { imputarAutomaticamente, diasAtraso } from "@/domain/cuentasCorrientes";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, NumberInput } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { PrintPreview } from "@/components/shared/print-layout";
import { formatDate, formatMoney } from "@/lib/format";
import { diaLocal } from "@/lib/periodos";
import { cn, newId } from "@/lib/utils";
import { OrdenPagoDocumento } from "./documentos";
import { Impacto, ImpactoCampo, medir } from "@/capacitacion";

type Fila = MedioCobro & { _id: string };
const deInput = (v: string) => {
  const [y, m, d] = v.split("-").map(Number);
  const n = new Date();
  return new Date(y, m - 1, d, n.getHours(), n.getMinutes()).toISOString();
};

/**
 * Registrar pago a proveedor (orden de pago): medios —incluido endoso de
 * cheques de terceros en cartera— e imputación a facturas de compra.
 */
export function PagoDialog({ open, onOpenChange, proveedorId }: { open: boolean; onOpenChange: (v: boolean) => void; proveedorId: string }) {
  const db = useDb();
  const [fecha, setFecha] = React.useState(diaLocal(new Date()));
  const [circuito, setCircuito] = React.useState<1 | 2>(1);
  const [medios, setMedios] = React.useState<Fila[]>([]);
  const [imput, setImput] = React.useState<Record<string, number>>({});
  const [op, setOp] = React.useState<string | null>(null);
  const prov = db.proveedores.find((p) => p.id === proveedorId);
  const pendientes = React.useMemo(() => db.comprobantes.filter((c) => c.proveedorId === proveedorId && c.circuito === circuito && c.saldoPendiente > 0.009 && c.estado !== "ANULADO").sort((a, b) => a.fecha.localeCompare(b.fecha)), [db.comprobantes, proveedorId, circuito]);
  const enCartera = db.cheques.filter((c) => c.estado === "EN_CARTERA");

  React.useEffect(() => {
    if (!open) return;
    setFecha(diaLocal(new Date()));
    setCircuito(prov?.circuitoHabitual ?? 1);
    const primera = pendientes[0];
    setMedios([{ _id: newId("m"), medio: "TRANSFERENCIA", importe: primera?.saldoPendiente ?? 0 }]);
    setImput(primera ? { [primera.id]: primera.saldoPendiente } : {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const total = Math.round(medios.reduce((a, m) => a + (m.importe || 0), 0) * 100) / 100;
  const imputado = Math.round(Object.values(imput).reduce((a, v) => a + (v || 0), 0) * 100) / 100;
  const up = (id: string, patch: Partial<Fila>) => setMedios((ms) => ms.map((m) => (m._id === id ? { ...m, ...patch } : m)));
  const usados = new Set(medios.map((m) => m.chequeId).filter(Boolean));

  const confirmar = async () => {
    const r = await medir("crearOrdenPago", { proveedorId }, () => useStore.getState().registrarPagoProveedor({
      proveedorId,
      circuito,
      fecha: deInput(fecha),
      medios: medios.map(({ _id, ...m }) => {
        void _id;
        return m;
      }),
      imputaciones: Object.entries(imput).map(([comprobanteId, importe]) => ({ comprobanteId, importe })),
    }));
    if (!r.ok) return toast.error(r.error);
    toast.success(`Orden de pago ${r.data.numero} registrada`, { description: `${formatMoney(total)} a ${prov?.razonSocial}` });
    onOpenChange(false);
    setOp(r.data.pagoId);
  };
  const pago = op ? db.pagosProveedores.find((p) => p.id === op) : undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          size="xl"
          title={`Registrar pago · ${prov?.razonSocial ?? ""}`}
          description="Podés combinar transferencia, eCheq propio y cheques de terceros en cartera."
          footer={
            <>
              <span className="mr-auto text-[13px] text-muted">Pagado <b className="text-ink tnum">{formatMoney(total)}</b> · imputado <b className={cn("tnum", Math.abs(imputado - total) > 0.01 ? "text-danger" : "text-ink")}>{formatMoney(imputado)}</b></span>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={confirmar} disabled={total <= 0 || Math.abs(imputado - total) > 0.01}>Confirmar pago</Button>
            </>
          }
        >
          <div className="space-y-5">
            <div className="flex flex-wrap gap-3">
              <FormField label="Fecha" htmlFor="op-f" className="max-w-[200px]"><Input id="op-f" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></FormField>
              <FormField label="Circuito" className="max-w-[200px]">
                <Select aria-label="Circuito" value={String(circuito)} onValueChange={(v) => { setCircuito(Number(v) as 1 | 2); setImput({}); }} options={[{ value: "1", label: "AC1 · Fiscal" }, { value: "2", label: "AC2 · Interno" }]} />
                <ImpactoCampo campo={`circuito.${circuito}`} />
              </FormField>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[13px] font-semibold">Medios de pago</h4>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setMedios([...medios, { _id: newId("m"), medio: "TRANSFERENCIA", importe: 0 }])}><Plus /> Medio</Button>
                  {enCartera.length > 0 && (
                    <Select
                      size="sm"
                      className="w-[240px]"
                      aria-label="Agregar cheque de cartera"
                      value=""
                      placeholder="+ Cheque de cartera"
                      onValueChange={(id) => {
                        const ch = enCartera.find((c) => c.id === id);
                        if (ch) setMedios([...medios, { _id: newId("m"), medio: ch.tipo, importe: ch.importe, chequeId: ch.id, banco: ch.banco, numeroCheque: ch.numero, fechaCobro: ch.fechaCobro, referencia: "Cheque de terceros endosado" }]);
                      }}
                      options={enCartera.filter((c) => !usados.has(c.id)).map((c) => ({ value: c.id, label: `${c.banco} Nº ${c.numero} · ${formatMoney(c.importe, { compact: true })} · ${formatDate(c.fechaCobro)}` }))}
                    />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                {medios.map((m) => (
                  <div key={m._id} className="grid gap-2 rounded-control border border-border p-2 sm:grid-cols-[160px_150px_1fr_auto]">
                    {m.chequeId ? (
                      <div className="flex h-8 items-center rounded-control bg-accent-soft px-2 text-[12px] font-medium text-accent">Cheque de cartera</div>
                    ) : (
                      <Select size="sm" aria-label="Medio" value={m.medio} onValueChange={(v) => up(m._id, { medio: v as MedioPago })} options={[{ value: "TRANSFERENCIA", label: "Transferencia" }, { value: "ECHEQ", label: "eCheq propio" }, { value: "CHEQUE", label: "Cheque propio" }, { value: "EFECTIVO", label: "Efectivo" }]} />
                    )}
                    <NumberInput aria-label="Importe" disabled={!!m.chequeId} value={m.importe} min={0} className="h-8" onValueChange={(v) => up(m._id, { importe: v })} />
                    <Input className="h-8 text-[13px]" aria-label="Referencia" disabled={!!m.chequeId} value={m.chequeId ? `${m.banco} Nº ${m.numeroCheque} · cobro ${formatDate(m.fechaCobro)}` : m.referencia ?? ""} onChange={(e) => up(m._id, { referencia: e.target.value })} placeholder={m.medio === "TRANSFERENCIA" ? "Número de operación" : "Banco / número"} />
                    <Button size="icon-sm" variant="ghost" aria-label="Quitar" disabled={medios.length === 1} onClick={() => setMedios(medios.filter((x) => x._id !== m._id))}><Trash2 className="text-muted" /></Button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[13px] font-semibold">Facturas a cancelar</h4>
                <Button size="sm" variant="secondary" disabled={!pendientes.length || total <= 0} onClick={() => setImput(Object.fromEntries(imputarAutomaticamente(total, pendientes).imputaciones.map((i) => [i.comprobanteId, i.importe])))}><Wand2 /> Imputar automáticamente</Button>
              </div>
              {pendientes.length === 0 ? (
                <p className="rounded-control border border-dashed border-border py-6 text-center text-[13px] text-muted">No hay facturas pendientes con este proveedor en este circuito. Si ya se le debía de antes, cargalo con «Cargar saldo inicial» en su cuenta corriente.</p>
              ) : (
                <div className="overflow-x-auto rounded-card border border-border">
                  <table className="w-full min-w-[600px] text-table">
                    <thead className="bg-[#FAFAF8]">
                      <tr className="text-[12px] text-muted">
                        <th className="h-9 px-3 text-left font-medium">Factura</th>
                        <th className="h-9 px-3 text-left font-medium">Fecha</th>
                        <th className="h-9 px-3 text-left font-medium">Vencimiento</th>
                        <th className="h-9 px-3 text-right font-medium">Saldo</th>
                        <th className="h-9 w-[150px] px-3 text-right font-medium">A pagar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendientes.map((c) => (
                        <tr key={c.id} className="border-t border-border">
                          <td className="px-3 py-1.5 font-mono text-[12px]">{c.numero}</td>
                          <td className="px-3 py-1.5 text-muted">{formatDate(c.fecha)}</td>
                          <td className={cn("px-3 py-1.5", diasAtraso(c, new Date()) > 0 ? "font-medium text-danger" : "text-muted")}>{formatDate(c.vencimiento)}</td>
                          <td className="px-3 py-1.5 text-right tnum">{formatMoney(c.saldoPendiente)}</td>
                          <td className="px-3 py-1.5"><NumberInput aria-label={`Pagar ${c.numero}`} value={imput[c.id] ?? 0} min={0} className="h-8" onValueChange={(v) => setImput((x) => ({ ...x, [c.id]: Math.min(v, c.saldoPendiente) }))} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {Math.abs(imputado - total) > 0.01 && <p className="mt-2 text-[12px] text-danger">En pagos a proveedores lo imputado tiene que ser igual al total pagado.</p>}
            </div>
            <Impacto accion="crearOrdenPago" />
          </div>
        </DialogContent>
      </Dialog>
      {pago && (
        <PrintPreview open={!!op} onOpenChange={(v) => !v && setOp(null)} titulo={`Orden de pago ${pago.numero}`}>
          <OrdenPagoDocumento pago={pago} />
        </PrintPreview>
      )}
    </>
  );
}
