"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle, History, Plus, Printer, Trash2, Wand2 } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePuede, useVeCircuito2 } from "@/store/selectors";
import { prerequisitos } from "@/domain/prerequisitos";
import type { Circuito, MedioCobro, MedioPago } from "@/domain/types";
import { CIRCUITO_LABEL } from "@/domain/estados";
import { imputarAutomaticamente, diasAtraso } from "@/domain/cuentasCorrientes";
import { MEDIO_PAGO_LABEL, TIPO_COMPROBANTE_LABEL, opciones } from "@/domain/estados";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, NumberInput } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { SelectorCliente } from "@/components/shared/alta-rapida";
import { AvisoFaltantes } from "@/components/shared/aviso-faltantes";
import { SaldoInicialDialog } from "./saldo-inicial-dialog";
import { PrintPreview } from "@/components/shared/print-layout";
import { formatDate, formatMoney } from "@/lib/format";
import { diaLocal } from "@/lib/periodos";
import { cn, newId } from "@/lib/utils";
import { Impacto, ImpactoCampo, medir } from "@/capacitacion";
import { ReciboDocumento } from "./documentos";
import { obtenerDb } from "@/lib/datos/almacen";

type FilaMedio = MedioCobro & { _id: string };

const hoy = () => diaLocal(new Date());
const deInput = (v: string) => {
  const [y, m, d] = v.split("-").map(Number);
  const n = new Date();
  return new Date(y, m - 1, d, n.getHours(), n.getMinutes()).toISOString();
};

/**
 * Registrar cobro: medios de pago (con datos de cheque/transferencia), imputación
 * a comprobantes pendientes (manual o automática, más antiguo primero) y saldo a favor.
 */
export function CobranzaDialog({
  open,
  onOpenChange,
  clienteId: clienteInicial,
  comprobanteId,
  importeSugerido,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clienteId?: string;
  comprobanteId?: string;
  importeSugerido?: number;
  onDone?: (cobranzaId: string) => void;
}) {
  const db = useDb();
  const registrar = useStore((s) => s.registrarCobranza);
  const [clienteId, setClienteId] = React.useState(clienteInicial ?? "");
  const [fecha, setFecha] = React.useState(hoy());
  const [circuito, setCircuito] = React.useState<Circuito>(1);
  const [medios, setMedios] = React.useState<FilaMedio[]>([]);
  const [imput, setImput] = React.useState<Record<string, number>>({});
  const [obs, setObs] = React.useState("");
  const [recibo, setRecibo] = React.useState<string | null>(null);
  const [saldoInicial, setSaldoInicial] = React.useState(false);
  const veC2 = useVeCircuito2();
  const puedeCobrar = usePuede("ctacte.cobrar");
  const faltan = prerequisitos("recibos", db);

  const pendientes = React.useMemo(
    () => db.comprobantes.filter((c) => c.clienteId === clienteId && c.circuito === circuito && c.saldoPendiente > 0.009 && c.estado !== "ANULADO" && (c.tipo === "FACTURA" || c.tipo === "NOTA_DEBITO" || c.tipo === "SALDO_INICIAL")).sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [db.comprobantes, clienteId, circuito],
  );

  React.useEffect(() => {
    if (!open) return;
    const cli = clienteInicial ?? "";
    setClienteId(cli);
    setFecha(hoy());
    setObs("");
    const c = comprobanteId ? db.comprobantes.find((x) => x.id === comprobanteId) : undefined;
    setCircuito(c?.circuito ?? db.clientes.find((x) => x.id === cli)?.circuitoHabitual ?? 1);
    const imp = importeSugerido ?? c?.saldoPendiente ?? 0;
    setMedios([{ _id: newId("m"), medio: "TRANSFERENCIA", importe: Math.round(imp * 100) / 100 }]);
    setImput(c ? { [c.id]: Math.round(Math.min(imp, c.saldoPendiente) * 100) / 100 } : {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const total = Math.round(medios.reduce((a, m) => a + (m.importe || 0), 0) * 100) / 100;
  const imputado = Math.round(Object.values(imput).reduce((a, v) => a + (v || 0), 0) * 100) / 100;
  const aFavor = Math.round((total - imputado) * 100) / 100;
  const excedeSaldo = pendientes.some((c) => (imput[c.id] ?? 0) > c.saldoPendiente + 0.01);
  const upMedio = (id: string, patch: Partial<FilaMedio>) => setMedios((ms) => ms.map((m) => (m._id === id ? { ...m, ...patch } : m)));
  const cliente = db.clientes.find((c) => c.id === clienteId);

  const auto = () => {
    const r = imputarAutomaticamente(total, pendientes);
    setImput(Object.fromEntries(r.imputaciones.map((i) => [i.comprobanteId, i.importe])));
  };

  const confirmar = async () => {
    const r = await medir("registrarCobro", { clienteId }, () => registrar({
      clienteId,
      circuito,
      fecha: deInput(fecha),
      medios: medios.map(({ _id, ...m }) => {
        void _id;
        return m;
      }),
      imputaciones: Object.entries(imput).map(([comprobanteId, importe]) => ({ comprobanteId, importe })),
      observaciones: obs || undefined,
    }));
    if (!r.ok) return toast.error(r.error);
    toast.success(`Recibo ${r.data.numero} registrado`, { description: `${formatMoney(total)} de ${cliente?.razonSocial}` });
    onOpenChange(false);
    onDone?.(r.data.cobranzaId);
    setRecibo(r.data.cobranzaId);
  };

  const cobranzaRecibo = recibo ? db.cobranzas.find((c) => c.id === recibo) : undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          size="xl"
          title="Registrar cobro"
          description="Cargá los medios de pago e imputá a los comprobantes pendientes."
          footer={
            <>
              <span className="mr-auto text-[13px] text-muted">
                Recibido <b className="text-ink tnum">{formatMoney(total)}</b> · imputado <b className="text-ink tnum">{formatMoney(imputado)}</b>
              </span>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={confirmar} disabled={!clienteId || total <= 0 || imputado > total + 0.01 || excedeSaldo}>Confirmar cobro</Button>
            </>
          }
        >
          <div className="space-y-5">
            {faltan.length > 0 && <AvisoFaltantes faltan={[]} titulo="Todavía no hay clientes" texto="Para registrar un cobro necesitás un cliente. Crealo desde el buscador de abajo sin salir de acá." />}
            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <FormField label="Cliente" required>
                <SelectorCliente
                  value={clienteId}
                  disabled={!!clienteInicial}
                  onChange={(v) => {
                    setClienteId(v);
                    setImput({});
                    // Del store en el momento: un cliente recién creado con el alta rápida todavía no está en `db`.
                    const c = obtenerDb().clientes.find((x) => x.id === v);
                    if (c) setCircuito(c.circuitoHabitual === 2 && !veC2 ? 1 : c.circuitoHabitual);
                  }}
                  placeholder="Buscar cliente…"
                />
              </FormField>
              <FormField label="Fecha" htmlFor="cob-fecha">
                <Input id="cob-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </FormField>
              <FormField label="Circuito">
                <Select
                  aria-label="Circuito"
                  value={String(circuito)}
                  onValueChange={(v) => {
                    setCircuito(Number(v) as Circuito);
                    setImput({});
                  }}
                  options={[1, 2].map((c) => ({ value: String(c), label: CIRCUITO_LABEL[c as Circuito] }))}
                />
                <ImpactoCampo campo={`circuito.${circuito}`} />
              </FormField>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[13px] font-semibold">Medios de pago</h4>
                <Button size="sm" variant="ghost" onClick={() => setMedios([...medios, { _id: newId("m"), medio: "EFECTIVO", importe: 0 }])}>
                  <Plus /> Agregar medio
                </Button>
              </div>
              <div className="space-y-2">
                {medios.map((m) => {
                  const esCheque = m.medio === "CHEQUE" || m.medio === "ECHEQ";
                  return (
                    <div key={m._id}>
                    <div className="grid gap-2 rounded-control border border-border p-2 sm:grid-cols-[160px_150px_1fr_auto]">
                      <Select size="sm" aria-label="Medio" value={m.medio} onValueChange={(v) => upMedio(m._id, { medio: v as MedioPago })} options={opciones(MEDIO_PAGO_LABEL)} />
                      <NumberInput aria-label="Importe" value={m.importe} min={0} className="h-8" onValueChange={(v) => upMedio(m._id, { importe: v })} />
                      {esCheque ? (
                        <div className="grid grid-cols-3 gap-2">
                          <Input className="h-8 text-[13px]" aria-label="Banco" placeholder="Banco" value={m.banco ?? ""} onChange={(e) => upMedio(m._id, { banco: e.target.value })} />
                          <Input className="h-8 text-[13px]" aria-label="Número de cheque" placeholder="Número" value={m.numeroCheque ?? ""} onChange={(e) => upMedio(m._id, { numeroCheque: e.target.value })} />
                          <Input className="h-8 text-[13px]" aria-label="Fecha de cobro" type="date" value={m.fechaCobro ? diaLocal(m.fechaCobro) : ""} onChange={(e) => upMedio(m._id, { fechaCobro: e.target.value ? deInput(e.target.value) : undefined })} />
                        </div>
                      ) : (
                        <Input
                          className="h-8 text-[13px]"
                          aria-label="Referencia"
                          placeholder={m.medio === "TRANSFERENCIA" ? "CBU / alias / número de operación" : m.medio === "TARJETA" ? "Tarjeta y cupón" : "Referencia (opcional)"}
                          value={m.referencia ?? ""}
                          onChange={(e) => upMedio(m._id, { referencia: e.target.value })}
                        />
                      )}
                      <Button size="icon-sm" variant="ghost" aria-label="Quitar medio" disabled={medios.length === 1} onClick={() => setMedios(medios.filter((x) => x._id !== m._id))}>
                        <Trash2 className="text-muted" />
                      </Button>
                    </div>
                    {esCheque && <ImpactoCampo campo="cobro.medio.CHEQUE" />}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[13px] font-semibold">Imputación</h4>
                <Button size="sm" variant="secondary" onClick={auto} disabled={!pendientes.length || total <= 0}>
                  <Wand2 /> Imputar automáticamente
                </Button>
              </div>
              {!clienteId ? (
                <p className="rounded-control border border-dashed border-border py-6 text-center text-[13px] text-muted">Elegí un cliente para ver sus comprobantes pendientes.</p>
              ) : !pendientes.length ? (
                <div className="flex flex-col items-center gap-2 rounded-control border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted">
                  <span>El cliente no tiene comprobantes pendientes en {CIRCUITO_LABEL[circuito]}. Lo cobrado queda como saldo a favor.</span>
                  {puedeCobrar && (
                    <Button size="sm" variant="ghost" onClick={() => setSaldoInicial(true)}>
                      <History /> ¿Ya debía de antes? Cargar saldo inicial
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-card border border-border">
                  <table className="w-full min-w-[640px] text-table">
                    <thead className="bg-[#FAFAF8]">
                      <tr className="text-[12px] text-muted">
                        <th className="h-9 px-3 text-left font-medium">Comprobante</th>
                        <th className="h-9 px-3 text-left font-medium">Fecha</th>
                        <th className="h-9 px-3 text-left font-medium">Vencimiento</th>
                        <th className="h-9 px-3 text-right font-medium">Total</th>
                        <th className="h-9 px-3 text-right font-medium">Saldo</th>
                        <th className="h-9 w-[150px] px-3 text-right font-medium">A imputar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendientes.map((c) => {
                        const atraso = diasAtraso(c, new Date());
                        return (
                          <tr key={c.id} className="border-t border-border">
                            <td className="px-3 py-1.5">
                              <span className="text-muted">{c.acopioId ? `Acopio ${db.acopios.find((a) => a.id === c.acopioId)?.numero ?? ""} ·` : TIPO_COMPROBANTE_LABEL[c.tipo]}</span> <span className="font-mono text-[12px]">{c.numero}</span>
                            </td>
                            <td className="px-3 py-1.5 text-muted">{formatDate(c.fecha)}</td>
                            <td className={cn("px-3 py-1.5", atraso > 0 ? "font-medium text-danger" : "text-muted")}>
                              {formatDate(c.vencimiento)}
                              {atraso > 0 && <span className="ml-1 text-[11px]">({atraso} d)</span>}
                            </td>
                            <td className="px-3 py-1.5 text-right tnum">{formatMoney(c.total)}</td>
                            <td className="px-3 py-1.5 text-right font-medium tnum">{formatMoney(c.saldoPendiente)}</td>
                            <td className="px-3 py-1.5">
                              <NumberInput aria-label={`Imputar a ${c.numero}`} value={imput[c.id] ?? 0} min={0} className={cn("h-8", (imput[c.id] ?? 0) > c.saldoPendiente + 0.01 && "border-danger")} onValueChange={(v) => setImput((x) => ({ ...x, [c.id]: v }))} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {imputado > total + 0.01 && <p className="mt-2 text-[12px] text-danger">Lo imputado supera el total recibido.</p>}
              {excedeSaldo && <p className="mt-2 text-[12px] text-danger">Hay imputaciones mayores al saldo del comprobante.</p>}
              {aFavor > 0.01 && clienteId && (
                <p className="mt-2 flex items-center gap-2 rounded-control border border-warning/30 bg-warning-soft px-3 py-2 text-[12px] text-warning">
                  <AlertTriangle className="size-4 shrink-0" /> Quedan {formatMoney(aFavor)} sin imputar: se registran como saldo a favor del cliente.
                </p>
              )}
            </div>
            <FormField label="Observaciones" htmlFor="cob-obs">
              <Input id="cob-obs" value={obs} onChange={(e) => setObs(e.target.value)} />
            </FormField>
            <Impacto accion="registrarCobro" />
          </div>
        </DialogContent>
      </Dialog>
      {clienteId && <SaldoInicialDialog tipo="cliente" open={saldoInicial} onOpenChange={setSaldoInicial} entidadId={clienteId} />}
      {cobranzaRecibo && (
        <PrintPreview open={!!recibo} onOpenChange={(v) => !v && setRecibo(null)} titulo={`Recibo ${cobranzaRecibo.numero}`}>
          <ReciboDocumento cobranza={cobranzaRecibo} />
        </PrintPreview>
      )}
    </>
  );
}

export function BotonImprimirRecibo({ cobranzaId }: { cobranzaId: string }) {
  const db = useDb();
  const [open, setOpen] = React.useState(false);
  const c = db.cobranzas.find((x) => x.id === cobranzaId);
  if (!c) return null;
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Printer /> Recibo
      </Button>
      <PrintPreview open={open} onOpenChange={setOpen} titulo={`Recibo ${c.numero}`}>
        <ReciboDocumento cobranza={c} />
      </PrintPreview>
    </>
  );
}
