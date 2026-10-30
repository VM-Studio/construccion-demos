"use client";
/**
 * Facturas y pagos del cliente (como el reporte del sistema anterior): lo adeudado y los pagos que
 * todavía no se aplicaron, con filtro "Solo pendientes" / "Todo" y fechas; exporta PDF y Excel.
 * Un pago sin aplicar se aplica a las facturas con un clic y la factura deja de figurar adeudada.
 */
import * as React from "react";
import { toast } from "sonner";
import { FileDown, FileSpreadsheet, Link2 } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePuede } from "@/store/selectors";
import type { Comprobante, EstadoInicial } from "@/domain/types";
import { imputarAutomaticamente } from "@/domain/cuentasCorrientes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, NumberInput } from "@/components/ui/input";
import { Segmented } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatDate, formatMoney } from "@/lib/format";
import { diaLocal } from "@/lib/periodos";
import { aDolares, formatUSD } from "@/lib/tipo-cambio";
import { cn } from "@/lib/utils";

export interface FilaFactura {
  id: string;
  tipo: string;
  fecha: string;
  referencia: string;
  vencimiento?: string;
  total: number;
  totalME?: number;
  cobrado: number;
  pendiente: number;
  credito?: Comprobante;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

const tipoCorto = (c: Comprobante) =>
  c.tipo === "FACTURA" ? (c.circuito === 1 ? `FAC-${c.letra ?? "B"}` : "FAC-X") : c.tipo === "NOTA_CREDITO" ? "NC" : c.tipo === "NOTA_DEBITO" ? "ND" : c.tipo === "SALDO_INICIAL" ? "SI" : "REC";

/** Filas del reporte: facturas (pendiente = saldo) y créditos sin aplicar (pendiente negativo). */
export function filasFacturas(db: EstadoInicial, clienteId: string, o: { soloPendientes: boolean; desde?: string; hasta?: string }): FilaFactura[] {
  const out: FilaFactura[] = [];
  for (const c of db.comprobantes) {
    if (c.clienteId !== clienteId || c.estado === "ANULADO") continue;
    const dia = c.fecha.slice(0, 10);
    if ((o.desde && dia < o.desde) || (o.hasta && dia > o.hasta)) continue;
    const deuda = c.tipo === "FACTURA" || c.tipo === "NOTA_DEBITO" || c.tipo === "SALDO_INICIAL";
    if (deuda) {
      if (o.soloPendientes && c.saldoPendiente <= 0.009) continue;
      const np = c.notaPedidoId ? db.notasPedido.find((n) => n.id === c.notaPedidoId) : undefined;
      out.push({ id: c.id, tipo: tipoCorto(c), fecha: c.fecha, referencia: c.numero, vencimiento: c.vencimiento, total: c.total, totalME: np?.moneda === "USD" && np.tipoCambioAplicado ? aDolares(c.total, np.tipoCambioAplicado) : undefined, cobrado: r2(c.total - c.saldoPendiente), pendiente: c.saldoPendiente });
    } else if (c.saldoPendiente < -0.009) {
      // Pago a cuenta / nota de crédito con saldo todavía sin aplicar.
      out.push({ id: c.id, tipo: tipoCorto(c), fecha: c.fecha, referencia: c.numero.replace(/ \(a favor.*\)$/, ""), total: 0, cobrado: -c.saldoPendiente, pendiente: c.saldoPendiente, credito: c });
    }
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function FacturasCliente({ clienteId }: { clienteId: string }) {
  const db = useDb();
  const puedeCobrar = usePuede("ctacte.cobrar");
  const [solo, setSolo] = React.useState<"P" | "T">("P");
  const [desde, setDesde] = React.useState("");
  const [hasta, setHasta] = React.useState("");
  const [aplicar, setAplicar] = React.useState<Comprobante | null>(null);
  const cli = db.clientes.find((c) => c.id === clienteId);
  const filas = React.useMemo(() => filasFacturas(db, clienteId, { soloPendientes: solo === "P", desde: desde || undefined, hasta: hasta || undefined }), [db, clienteId, solo, desde, hasta]);
  const tot = filas.reduce((a, f) => ({ total: a.total + f.total, cobrado: a.cobrado + f.cobrado, pendiente: a.pendiente + f.pendiente }), { total: 0, cobrado: 0, pendiente: 0 });
  const titulo = `Facturas ${solo === "P" ? "pendientes" : "emitidas"}${desde ? ` desde el ${formatDate(desde)}` : ""}${hasta ? ` hasta el ${formatDate(hasta)}` : ` hasta el ${formatDate(new Date())}`}`;
  const columnas = ["Tipo", "Fecha", "Referencia", "Vencimiento", "Total", "Total ME", "Cobrado", "Pendiente"];
  const pdf = async () => {
    const { generarPdfDocumento, descargarBlob } = await import("@/lib/pdf/documento");
    descargarBlob(
      generarPdfDocumento({
        empresa: db.config.empresa,
        titulo: "Facturas de clientes",
        fecha: formatDate(new Date()),
        extras: [titulo],
        destinatario: { titulo: "Cliente", lineas: [cli?.nombreFantasia ?? cli?.razonSocial ?? "", `Razón social: ${cli?.razonSocial ?? ""}${cli?.cuit ? ` · CUIT ${cli.cuit}` : ""}`] },
        columnas: [{ titulo: "Tipo", ancho: 16 }, { titulo: "Fecha", ancho: 20 }, { titulo: "Referencia" }, { titulo: "Vencimiento", ancho: 22 }, { titulo: "Total", ancho: 26, derecha: true }, { titulo: "Total ME", ancho: 20, derecha: true }, { titulo: "Cobrado", ancho: 26, derecha: true }, { titulo: "Pendiente", ancho: 26, derecha: true }],
        filas: filas.map((f) => [f.tipo, formatDate(f.fecha), f.referencia, f.vencimiento ? formatDate(f.vencimiento) : "", f.total ? formatMoney(f.total) : "0,00", f.totalME ? formatUSD(f.totalME) : "", formatMoney(f.cobrado), formatMoney(f.pendiente)]),
        totales: [{ etiqueta: "Total facturado", valor: formatMoney(tot.total) }, { etiqueta: "Cobrado", valor: formatMoney(tot.cobrado) }, { etiqueta: "PENDIENTE", valor: formatMoney(tot.pendiente), destacado: true }],
        pie: "Ante cualquier diferencia, comunicarse con Administración.",
        apaisado: false,
      }),
      `Cuenta ${cli?.razonSocial ?? ""} ${diaLocal(new Date())}.pdf`,
    );
  };
  const excel = async () => {
    const { generarExcel } = await import("@/lib/pdf/excel");
    const { descargarBlob } = await import("@/lib/pdf/documento");
    descargarBlob(
      await generarExcel({
        hoja: "Facturas",
        titulo: [`${db.config.empresa.razonSocial} · Facturas de clientes`, `${cli?.razonSocial ?? ""}${cli?.cuit ? ` · CUIT ${cli.cuit}` : ""}`, titulo],
        columnas: [{ titulo: "Tipo", ancho: 10 }, { titulo: "Fecha", ancho: 12 }, { titulo: "Referencia", ancho: 26 }, { titulo: "Vencimiento", ancho: 12 }, { titulo: "Total", dinero: true }, { titulo: "Total ME (USD)" }, { titulo: "Cobrado", dinero: true }, { titulo: "Pendiente", dinero: true }],
        filas: filas.map((f) => [f.tipo, formatDate(f.fecha), f.referencia, f.vencimiento ? formatDate(f.vencimiento) : "", f.total, f.totalME ?? null, f.cobrado, f.pendiente]),
        totales: ["Totales del cliente", "", "", "", r2(tot.total), null, r2(tot.cobrado), r2(tot.pendiente)],
      }),
      `Cuenta ${cli?.razonSocial ?? ""} ${diaLocal(new Date())}.xlsx`,
    );
  };
  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="mr-2 text-[14px] font-semibold">Facturas y pagos</h3>
          <Segmented value={solo} onChange={setSolo} options={[{ value: "P", label: "Solo pendientes" }, { value: "T", label: "Todo" }]} />
          <label className="flex items-center gap-1 text-[12px] text-muted">Desde<Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-8 w-[140px]" /></label>
          <label className="flex items-center gap-1 text-[12px] text-muted">Hasta<Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-8 w-[140px]" /></label>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={pdf} disabled={!filas.length}><FileDown /> PDF</Button>
          <Button size="sm" variant="secondary" onClick={excel} disabled={!filas.length}><FileSpreadsheet /> Excel</Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-table">
          <thead className="bg-[#FAFAF8] text-[12px] text-muted">
            <tr>
              {columnas.map((c, i) => <th key={c} className={cn("h-9 px-3 font-medium", i >= 4 ? "text-right" : "text-left")}>{c}</th>)}
              <th className="h-9 w-24 px-3" />
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id} className="h-9 border-t border-border">
                <td className="px-3 font-medium">{f.tipo}</td>
                <td className="px-3 text-muted">{formatDate(f.fecha)}</td>
                <td className="px-3 font-mono text-[12px]">{f.referencia}</td>
                <td className="px-3 text-muted">{f.vencimiento ? formatDate(f.vencimiento) : ""}</td>
                <td className="px-3 text-right tnum">{formatMoney(f.total)}</td>
                <td className="px-3 text-right text-muted tnum">{f.totalME ? formatUSD(f.totalME) : ""}</td>
                <td className="px-3 text-right tnum">{formatMoney(f.cobrado)}</td>
                <td className={cn("px-3 text-right font-medium tnum", f.pendiente < 0 && "text-success")}>{formatMoney(f.pendiente)}</td>
                <td className="px-3 text-right">
                  {f.credito && puedeCobrar && filas.some((x) => x.pendiente > 0.009) && (
                    <Button size="sm" variant="ghost" onClick={() => setAplicar(f.credito!)}><Link2 /> Aplicar</Button>
                  )}
                </td>
              </tr>
            ))}
            {!filas.length && (
              <tr><td colSpan={9} className="py-8 text-center text-[13px] text-muted">{solo === "P" ? "No debe nada ni tiene pagos sin aplicar." : "Sin movimientos en el período."}</td></tr>
            )}
          </tbody>
          {filas.length > 0 && (
            <tfoot>
              <tr className="h-10 border-t border-border-strong bg-[#FAFAF8] font-semibold">
                <td className="px-3" colSpan={4}>Totales del cliente</td>
                <td className="px-3 text-right tnum">{formatMoney(tot.total)}</td>
                <td />
                <td className="px-3 text-right tnum">{formatMoney(tot.cobrado)}</td>
                <td className="px-3 text-right tnum">{formatMoney(tot.pendiente)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {aplicar && <AplicarCreditoDialog credito={aplicar} onClose={() => setAplicar(null)} />}
    </Card>
  );
}

/** Aplica un pago a cuenta (o nota de crédito) a facturas pendientes del cliente. */
export function AplicarCreditoDialog({ credito, onClose }: { credito: Comprobante; onClose: () => void }) {
  const db = useDb();
  const disponible = -credito.saldoPendiente;
  const pendientes = db.comprobantes
    .filter((c) => c.clienteId === credito.clienteId && c.estado !== "ANULADO" && c.saldoPendiente > 0.009 && (c.tipo === "FACTURA" || c.tipo === "NOTA_DEBITO" || c.tipo === "SALDO_INICIAL"))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const [imp, setImp] = React.useState<Record<string, number>>(() => Object.fromEntries(imputarAutomaticamente(disponible, pendientes).imputaciones.map((i) => [i.comprobanteId, i.importe])));
  const total = r2(Object.values(imp).reduce((a, v) => a + (v || 0), 0));
  const [cargando, setCargando] = React.useState(false);
  const confirmar = async () => {
    setCargando(true);
    const r = await useStore.getState().aplicarSaldoAFavor(credito.id, Object.entries(imp).filter(([, v]) => v > 0).map(([comprobanteId, importe]) => ({ comprobanteId, importe })));
    setCargando(false);
    if (!r.ok) return toast.error(r.error);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        size="md"
        title={`Aplicar ${credito.numero.replace(/ \(a favor.*\)$/, "")}`}
        description={`Disponible para aplicar: ${formatMoney(disponible)}`}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button loading={cargando} disabled={total <= 0 || total > disponible + 0.01} onClick={confirmar}>Aplicar {formatMoney(total)}</Button>
          </>
        }
      >
        <table className="w-full text-table">
          <thead className="text-[12px] text-muted">
            <tr><th className="h-8 text-left font-medium">Factura</th><th className="h-8 text-right font-medium">Saldo</th><th className="h-8 w-[140px] text-right font-medium">Aplicar</th></tr>
          </thead>
          <tbody>
            {pendientes.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="py-1.5"><span className="font-mono text-[12px]">{c.numero}</span> <span className="text-[12px] text-muted">{formatDate(c.fecha)}</span></td>
                <td className="py-1.5 text-right tnum">{formatMoney(c.saldoPendiente)}</td>
                <td className="py-1.5 pl-2"><NumberInput aria-label={`Aplicar a ${c.numero}`} value={imp[c.id] ?? 0} min={0} max={c.saldoPendiente} onValueChange={(v) => setImp({ ...imp, [c.id]: Math.min(v, c.saldoPendiente) })} className="h-8" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {total > disponible + 0.01 && <p className="mt-2 text-[12px] text-danger">Supera lo disponible.</p>}
      </DialogContent>
    </Dialog>
  );
}
