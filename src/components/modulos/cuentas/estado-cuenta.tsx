"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, Printer, Wallet } from "lucide-react";
import { useDb, usePuede, useSaldosClientes, useSaldosProveedores } from "@/store/selectors";
import type { EstadoInicial } from "@/domain/types";
import { antiguedadDeuda, diasAtraso } from "@/domain/cuentasCorrientes";
import { MEDIO_PAGO_LABEL, TIPO_COMPROBANTE_LABEL, CONDICION_PAGO_LABEL } from "@/domain/estados";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { EmailDialog } from "@/components/shared/email-dialog";
import { PrintLayout, PrintPreview, PrintTable } from "@/components/shared/print-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CobranzaDialog } from "./cobranza-dialog";
import { PagoDialog } from "./pago-dialog";

export interface MovimientoCuenta {
  id: string;
  fecha: string;
  concepto: string;
  numero: string;
  href?: string;
  debe: number;
  haber: number;
  saldo: number;
  pendiente?: number;
  vencimiento?: string;
  atraso?: number;
}

/** Extracto cronológico: debe (facturas), haber (cobros/pagos y notas de crédito) y saldo acumulado. */
export function extracto(db: EstadoInicial, tipo: "cliente" | "proveedor", id: string): MovimientoCuenta[] {
  const out: Omit<MovimientoCuenta, "saldo">[] = [];
  const hoy = new Date();
  for (const c of db.comprobantes) {
    if (tipo === "cliente" ? c.clienteId !== id : c.proveedorId !== id) continue;
    if (c.tipo === "SALDO_A_FAVOR") continue;
    // NC de devoluciones de acopio: vuelven al saldo del acopio, no a la cuenta corriente.
    if (c.tipo === "NOTA_CREDITO" && c.acopioId && !c.aplicadoA?.length && Math.abs(c.saldoPendiente) < 0.01) continue;
    const esDebe = c.tipo !== "NOTA_CREDITO";
    const ref = c.notaPedidoId ? db.notasPedido.find((p) => p.id === c.notaPedidoId)?.numero : c.acopioId ? db.acopios.find((a) => a.id === c.acopioId)?.numero : c.recepcionId ? db.ordenesCompra.find((o) => o.id === db.recepciones.find((r) => r.id === c.recepcionId)?.ordenCompraId)?.numero : undefined;
    out.push({
      id: c.id,
      fecha: c.fecha,
      concepto: `${TIPO_COMPROBANTE_LABEL[c.tipo]}${ref ? ` · ${ref}` : ""}${c.estado === "ANULADO" ? " (anulada)" : ""}`,
      numero: c.numero,
      href: c.notaPedidoId ? `/ventas/notas-pedido/${c.notaPedidoId}` : c.acopioId ? `/acopios/${c.acopioId}` : c.recepcionId ? `/compras/recepciones?id=${c.recepcionId}` : undefined,
      debe: esDebe ? c.total : 0,
      haber: esDebe ? 0 : c.total,
      pendiente: esDebe && c.estado !== "ANULADO" && c.saldoPendiente > 0.009 ? c.saldoPendiente : undefined,
      vencimiento: c.vencimiento,
      atraso: esDebe && c.saldoPendiente > 0.009 ? diasAtraso(c, hoy) : undefined,
    });
  }
  if (tipo === "cliente")
    for (const cob of db.cobranzas.filter((x) => x.clienteId === id))
      out.push({ id: cob.id, fecha: cob.fecha, concepto: `Recibo · ${cob.medios.map((m) => MEDIO_PAGO_LABEL[m.medio]).join(", ")}`, numero: cob.numero, debe: 0, haber: cob.total });
  else
    for (const op of db.pagosProveedores.filter((x) => x.proveedorId === id))
      out.push({ id: op.id, fecha: op.fecha, concepto: `Orden de pago · ${op.medios.map((m) => (m.chequeId ? "Cheque de terceros" : MEDIO_PAGO_LABEL[m.medio])).join(", ")}`, numero: op.numero, debe: 0, haber: op.total });
  // Las facturas anuladas: la NC espejo las compensa, se muestran ambas.
  out.sort((a, b) => a.fecha.localeCompare(b.fecha) || b.debe - a.debe);
  let saldo = 0;
  return out.map((m) => ({ ...m, saldo: (saldo += m.debe - m.haber) }));
}

export function EstadoCuenta({ tipo, id, embebido }: { tipo: "cliente" | "proveedor"; id: string; embebido?: boolean }) {
  const db = useDb();
  const router = useRouter();
  const saldosC = useSaldosClientes();
  const saldosP = useSaldosProveedores();
  const puedeCobrar = usePuede("ctacte.cobrar");
  const puedePagar = usePuede("ctacte.pagar");
  const [accion, setAccion] = React.useState(false);
  const [imprimir, setImprimir] = React.useState(false);
  const [email, setEmail] = React.useState(false);
  const entidad = tipo === "cliente" ? db.clientes.find((c) => c.id === id) : db.proveedores.find((p) => p.id === id);
  const movs = React.useMemo(() => extracto(db, tipo, id), [db, tipo, id]);
  if (!entidad)
    return (
      <div className="rounded-card border border-border bg-surface">
        <EmptyState titulo="No existe la cuenta" accion={<Button onClick={() => router.push("/cuentas-corrientes")}>Volver</Button>} />
      </div>
    );
  const s = (tipo === "cliente" ? saldosC : saldosP).get(id) ?? { saldo: 0, vencido: 0, aVencer: 0, comprobantesPendientes: 0 };
  const ant = antiguedadDeuda(db.comprobantes.filter((c) => (tipo === "cliente" ? c.clienteId === id : c.proveedorId === id)), new Date());
  const limite = tipo === "cliente" ? (entidad as EstadoInicial["clientes"][number]).limiteCredito : 0;
  const doc = <ResumenCuentaDocumento tipo={tipo} nombre={entidad.razonSocial} cuit={entidad.cuit} movs={movs} saldo={s.saldo} />;

  return (
    <div>
      {!embebido && (
        <Link href={tipo === "cliente" ? "/cuentas-corrientes/clientes" : "/cuentas-corrientes/proveedores"} className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Cuentas corrientes
        </Link>
      )}
      {embebido ? (
        <div className="mb-3 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setImprimir(true)}><Printer /> Imprimir resumen</Button>
            {tipo === "cliente" && <Button variant="secondary" onClick={() => setEmail(true)}><Mail /> Enviar por email</Button>}
            {tipo === "cliente" && puedeCobrar && <Button onClick={() => setAccion(true)}><Wallet /> Registrar cobro</Button>}
            {tipo === "proveedor" && puedePagar && <Button onClick={() => setAccion(true)}><Wallet /> Registrar pago</Button>}
        </div>
      ) : (
      <PageHeader
          titulo={`Estado de cuenta · ${tipo === "cliente" ? (entidad as EstadoInicial["clientes"][number]).nombreFantasia ?? entidad.razonSocial : entidad.razonSocial}`}
          descripcion={`${entidad.razonSocial} · CUIT ${entidad.cuit} · ${CONDICION_PAGO_LABEL[entidad.condicionPago]}`}
          acciones={
            <>
              <Button variant="secondary" onClick={() => setImprimir(true)}><Printer /> Imprimir resumen</Button>
              {tipo === "cliente" && <Button variant="secondary" onClick={() => setEmail(true)}><Mail /> Enviar por email</Button>}
              {tipo === "cliente" && puedeCobrar && <Button onClick={() => setAccion(true)}><Wallet /> Registrar cobro</Button>}
              {tipo === "proveedor" && puedePagar && <Button onClick={() => setAccion(true)}><Wallet /> Registrar pago</Button>}
            </>
          }
        />
      )}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Saldo" valor={formatMoney(s.saldo, { decimals: false })} acento subtexto={s.saldo < 0 ? "a favor" : `${s.comprobantesPendientes} comprobantes pendientes`} />
        <KpiCard label="Vencido" valor={<span className={s.vencido > 0 ? "text-danger" : ""}>{formatMoney(s.vencido, { decimals: false })}</span>} />
        <KpiCard label="A vencer" valor={formatMoney(s.aVencer, { decimals: false })} />
        {tipo === "cliente" ? (
          <KpiCard label="Límite de crédito" valor={limite ? formatMoney(limite, { decimals: false }) : "Contado"} subtexto={limite ? <span className={s.saldo > limite ? "font-medium text-danger" : ""}>uso {Math.round((s.saldo / limite) * 100)} %</span> : undefined} />
        ) : (
          <KpiCard label="Plazo de pago" valor={CONDICION_PAGO_LABEL[entidad.condicionPago]} />
        )}
      </div>
      <Card className="mb-4 p-4">
        <h3 className="mb-3 text-[14px] font-semibold">Antigüedad de la deuda</h3>
        <div className="grid grid-cols-4 gap-2">
          {(Object.entries(ant) as [string, number][]).map(([k, v]) => (
            <div key={k} className={cn("rounded-control border border-border p-3", k === "+90" && v > 0 && "border-danger/30 bg-danger-soft")}>
              <div className="text-[11px] text-muted">{k} días</div>
              <div className={cn("text-[15px] font-semibold tnum", k === "+90" && v > 0 && "text-danger")}>{formatMoney(v, { decimals: false })}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-table">
            <thead className="bg-[#FAFAF8]">
              <tr className="text-[12px] text-muted">
                <th className="h-9 px-3 text-left font-medium">Fecha</th>
                <th className="h-9 px-3 text-left font-medium">Comprobante</th>
                <th className="h-9 px-3 text-left font-medium">Concepto</th>
                <th className="h-9 px-3 text-right font-medium">Debe</th>
                <th className="h-9 px-3 text-right font-medium">Haber</th>
                <th className="h-9 px-3 text-right font-medium">Saldo</th>
                <th className="h-9 px-3 text-right font-medium">Pendiente / atraso</th>
              </tr>
            </thead>
            <tbody>
              {movs.map((m) => (
                <tr key={m.id} className={cn("h-10 border-t border-border", m.pendiente && (m.atraso ? "bg-danger-soft/50" : "bg-warning-soft/50"))}>
                  <td className="whitespace-nowrap px-3 text-muted">{formatDate(m.fecha)}</td>
                  <td className="whitespace-nowrap px-3 font-mono text-[12px]">{m.href ? <Link href={m.href} className="hover:underline">{m.numero}</Link> : m.numero}</td>
                  <td className="px-3">{m.concepto}</td>
                  <td className="px-3 text-right tnum">{m.debe ? formatMoney(m.debe) : ""}</td>
                  <td className="px-3 text-right text-success tnum">{m.haber ? formatMoney(m.haber) : ""}</td>
                  <td className="px-3 text-right font-medium tnum">{formatMoney(m.saldo)}</td>
                  <td className="px-3 text-right">
                    {m.pendiente ? (
                      <span className="whitespace-nowrap text-[12px]">
                        <span className="font-medium tnum">{formatMoney(m.pendiente)}</span>
                        {m.atraso ? <span className="ml-1 font-medium text-danger">· {m.atraso} d de atraso</span> : <span className="ml-1 text-muted">· vence {formatDate(m.vencimiento)}</span>}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="h-10 border-t border-border-strong bg-[#FAFAF8] font-semibold">
                <td className="px-3" colSpan={5}>Saldo actual</td>
                <td className="px-3 text-right text-accent tnum">{formatMoney(movs.at(-1)?.saldo ?? 0)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
          {!movs.length && <EmptyState titulo="Sin movimientos en la cuenta" />}
        </div>
      </Card>
      {tipo === "cliente" ? <CobranzaDialog open={accion} onOpenChange={setAccion} clienteId={id} /> : <PagoDialog open={accion} onOpenChange={setAccion} proveedorId={id} />}
      <PrintPreview open={imprimir} onOpenChange={setImprimir} titulo="Resumen de cuenta">{doc}</PrintPreview>
      <EmailDialog open={email} onOpenChange={setEmail} para={entidad.email} asunto={`Resumen de cuenta · ${db.config.empresa.empresa}`} mensaje={`Hola,\n\nTe enviamos el resumen de tu cuenta corriente al ${formatDate(new Date())}. Saldo: ${formatMoney(s.saldo)}${s.vencido > 0 ? ` (vencido ${formatMoney(s.vencido)})` : ""}.\n\nSaludos,\nAdministración · ${db.config.empresa.empresa}`} adjunto="resumen-de-cuenta.pdf" documento={doc} />
    </div>
  );
}

export function ResumenCuentaDocumento({ tipo, nombre, cuit, movs, saldo }: { tipo: "cliente" | "proveedor"; nombre: string; cuit: string; movs: MovimientoCuenta[]; saldo: number }) {
  return (
    <PrintLayout titulo="Resumen de cuenta" fecha={formatDate(new Date())} subtitulo={<div><b>{tipo === "cliente" ? "Cliente" : "Proveedor"}:</b> {nombre} · CUIT {cuit}</div>} pie="Ante cualquier diferencia, comunicarse con Administración.">
      <PrintTable head={["Fecha", "Comprobante", "Concepto", "Debe", "Haber", "Saldo"]} rows={movs.map((m) => [formatDate(m.fecha), m.numero, m.concepto, m.debe ? formatMoney(m.debe) : "", m.haber ? formatMoney(m.haber) : "", formatMoney(m.saldo)])} foot={["", "", "Saldo actual", "", "", formatMoney(saldo)]} />
    </PrintLayout>
  );
}
