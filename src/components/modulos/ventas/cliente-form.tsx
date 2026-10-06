"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePuede, useSaldosClientes, useAcopiosConSaldo } from "@/store/selectors";
import type { Cliente, CondicionIVA, CondicionPago, TipoCliente } from "@/domain/types";
import { validarCUIT, formatearCUIT } from "@/domain/cuit";
import { antiguedadDeuda } from "@/domain/cuentasCorrientes";
import { pedidosVendidos, rankingProductos } from "@/domain/metricas";
import { CONDICION_IVA_LABEL, CONDICION_PAGO_LABEL, TIPO_CLIENTE_LABEL, opciones } from "@/domain/estados";
import { EntitySheet } from "@/components/shared/entity-sheet";
import { StatusBadge } from "@/components/shared/status-badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NumberInput, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/ui/form-field";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

type Form = Omit<Cliente, "id" | "creadoEn" | "actualizadoEn">;

function vacio(sucursalId: string, vendedorId?: string): Form {
  return {
    razonSocial: "",
    nombreFantasia: "",
    tipo: "PARTICULAR",
    cuit: "",
    condicionIVA: "CF",
    email: "",
    telefono: "",
    direccion: "",
    localidad: "",
    listaPreciosId: "lst_pub",
    condicionPago: "CONTADO",
    limiteCredito: 0,
    vendedorId,
    sucursalPreferidaId: sucursalId,
    activo: true,
    notas: "",
  };
}

/** Formulario de cliente con validación de CUIT. */
export function ClienteForm({ cliente, onSaved, compacto }: { cliente?: Cliente; onSaved: (id: string) => void; compacto?: boolean }) {
  const db = useDb();
  const guardar = useStore((s) => s.guardarCliente);
  const usuarioId = useStore((s) => s.ui.usuarioId);
  const usuario = db.usuarios.find((u) => u.id === usuarioId);
  const puede = usePuede("clientes.editar");
  const [f, setF] = React.useState<Form>(() => (cliente ? { ...cliente } : vacio(usuario?.sucursalId ?? "suc_norte", usuario?.rol === "VENTAS" ? usuario.id : undefined)));
  const [err, setErr] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    if (cliente) setF({ ...cliente });
  }, [cliente]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!f.razonSocial.trim()) er.razonSocial = "Ingresá la razón social o el nombre.";
    if (f.condicionIVA !== "CF" || f.cuit.trim()) {
      const c = validarCUIT(f.cuit);
      if (c) er.cuit = c;
    }
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) er.email = "Email inválido.";
    if (f.condicionPago.startsWith("CTA_CTE") && f.limiteCredito <= 0) er.limiteCredito = "Para cuenta corriente definí un límite de crédito.";
    setErr(er);
    if (Object.keys(er).length) return;
    const r = guardar({ ...f, cuit: f.cuit ? formatearCUIT(f.cuit) : "", nombreFantasia: f.nombreFantasia || undefined }, cliente?.id);
    if (r.ok) {
      toast.success(cliente ? "Cliente actualizado" : `Cliente ${f.razonSocial} creado`);
      onSaved(r.data);
    } else toast.error(r.error);
  };
  const ro = !puede;
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Razón social / nombre" required error={err.razonSocial} htmlFor="cl-rs" className="sm:col-span-2">
          <Input id="cl-rs" disabled={ro} value={f.razonSocial} onChange={(e) => set("razonSocial", e.target.value)} autoFocus={!cliente} />
        </FormField>
        <FormField label="Nombre de fantasía" htmlFor="cl-nf">
          <Input id="cl-nf" disabled={ro} value={f.nombreFantasia ?? ""} onChange={(e) => set("nombreFantasia", e.target.value)} />
        </FormField>
        <FormField label="Tipo">
          <Select
            disabled={ro}
            value={f.tipo}
            onValueChange={(v) => {
              const t = v as TipoCliente;
              set("tipo", t);
              if (!cliente) set("listaPreciosId", t === "CONSTRUCTORA" ? "lst_may" : t === "PARTICULAR" ? "lst_pub" : "lst_cor");
            }}
            options={opciones(TIPO_CLIENTE_LABEL)}
          />
        </FormField>
        <FormField label="CUIT / CUIL" error={err.cuit} required={f.condicionIVA !== "CF"} hint="Se valida el dígito verificador" htmlFor="cl-cuit">
          <Input id="cl-cuit" disabled={ro} value={f.cuit} onChange={(e) => set("cuit", e.target.value)} onBlur={() => f.cuit && set("cuit", formatearCUIT(f.cuit))} aria-invalid={!!err.cuit} placeholder="20-12345678-9" />
        </FormField>
        <FormField label="Condición IVA">
          <Select disabled={ro} value={f.condicionIVA} onValueChange={(v) => set("condicionIVA", v as CondicionIVA)} options={opciones(CONDICION_IVA_LABEL)} />
        </FormField>
        <FormField label="Teléfono" htmlFor="cl-tel">
          <Input id="cl-tel" disabled={ro} value={f.telefono} onChange={(e) => set("telefono", e.target.value)} />
        </FormField>
        <FormField label="Email" error={err.email} htmlFor="cl-email">
          <Input id="cl-email" disabled={ro} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
        </FormField>
        <FormField label="Dirección" htmlFor="cl-dir">
          <Input id="cl-dir" disabled={ro} value={f.direccion} onChange={(e) => set("direccion", e.target.value)} />
        </FormField>
        <FormField label="Localidad" htmlFor="cl-loc">
          <Input id="cl-loc" disabled={ro} value={f.localidad} onChange={(e) => set("localidad", e.target.value)} />
        </FormField>
        <FormField label="Lista de precios">
          <Select disabled={ro} value={f.listaPreciosId} onValueChange={(v) => set("listaPreciosId", v)} options={db.listasPrecios.map((l) => ({ value: l.id, label: l.nombre }))} />
        </FormField>
        <FormField label="Condición de pago">
          <Select disabled={ro} value={f.condicionPago} onValueChange={(v) => set("condicionPago", v as CondicionPago)} options={opciones(CONDICION_PAGO_LABEL)} />
        </FormField>
        <FormField label="Límite de crédito" error={err.limiteCredito} htmlFor="cl-lim">
          <NumberInput id="cl-lim" disabled={ro} value={f.limiteCredito} min={0} onValueChange={(v) => set("limiteCredito", v)} />
        </FormField>
        <FormField label="Sucursal preferida">
          <Select disabled={ro} value={f.sucursalPreferidaId} onValueChange={(v) => set("sucursalPreferidaId", v)} options={db.sucursales.map((s) => ({ value: s.id, label: s.nombre }))} />
        </FormField>
        <FormField label="Vendedor">
          <Select disabled={ro} value={f.vendedorId ?? ""} onValueChange={(v) => set("vendedorId", v || undefined)} options={[{ value: "", label: "Sin asignar" }, ...db.usuarios.filter((u) => u.rol === "VENTAS").map((u) => ({ value: u.id, label: u.nombre }))]} />
        </FormField>
      </div>
      {!compacto && (
        <FormField label="Notas" htmlFor="cl-notas">
          <Textarea id="cl-notas" disabled={ro} value={f.notas ?? ""} onChange={(e) => set("notas", e.target.value)} rows={2} />
        </FormField>
      )}
      {!compacto && (
        <label className="flex items-center gap-3 text-[13px]">
          <Switch disabled={ro} checked={f.activo} onCheckedChange={(v) => set("activo", v)} /> Cliente activo
        </label>
      )}
      {!ro && (
        <div className="flex justify-end border-t border-border pt-4">
          <Button type="submit"><Save /> {cliente ? "Guardar cambios" : "Crear cliente"}</Button>
        </div>
      )}
    </form>
  );
}

/** Alta rápida de cliente desde cualquier buscador. */
export function NuevoClienteDialog({ open, onOpenChange, onCreado }: { open: boolean; onOpenChange: (v: boolean) => void; onCreado: (id: string) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" title="Nuevo cliente" description="Alta rápida: completá lo esencial, el resto se edita después desde la ficha.">
        {open && (
          <ClienteForm
            compacto
            onSaved={(id) => {
              onCreado(id);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Ficha de cliente con pedidos, acopios, cuenta corriente, rentabilidad y notas. */
export function ClienteSheet({ id, nuevo, onClose }: { id?: string | null; nuevo?: boolean; onClose: () => void }) {
  const db = useDb();
  const verMargen = usePuede("margenes.ver");
  const c = id ? db.clientes.find((x) => x.id === id) : undefined;
  if (!c && !nuevo) return null;
  return (
    <EntitySheet
      open
      onOpenChange={(v) => !v && onClose()}
      titulo={c ? c.nombreFantasia ?? c.razonSocial : "Nuevo cliente"}
      subtitulo={c ? `${c.razonSocial} · CUIT ${c.cuit || "—"} · ${c.localidad}` : "Completá los datos del cliente"}
      estado={c ? <Badge>{TIPO_CLIENTE_LABEL[c.tipo]}</Badge> : undefined}
      tabs={
        c
          ? [
              { value: "datos", label: "Datos", content: <ClienteForm cliente={c} onSaved={() => {}} /> },
              { value: "pedidos", label: "Pedidos", content: <PedidosCliente id={c.id} /> },
              { value: "acopios", label: "Acopios", content: <AcopiosCliente id={c.id} /> },
              { value: "ctacte", label: "Cuenta corriente", content: <CtaCteCliente id={c.id} /> },
              ...(verMargen ? [{ value: "rent", label: "Rentabilidad", content: <RentabilidadCliente id={c.id} /> }] : []),
              { value: "notas", label: "Notas", content: <NotasCliente id={c.id} /> },
            ]
          : [{ value: "datos", label: "Datos", content: <ClienteForm onSaved={onClose} /> }]
      }
    />
  );
}

function PedidosCliente({ id }: { id: string }) {
  const db = useDb();
  const ps = db.pedidos.filter((p) => p.clienteId === id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  if (!ps.length) return <p className="py-8 text-center text-[13px] text-muted">Sin pedidos.</p>;
  return (
    <ul className="divide-y divide-border rounded-card border border-border">
      {ps.map((p) => (
        <li key={p.id}>
          <Link href={`/ventas/pedidos/${p.id}`} className="flex items-center gap-3 px-3 py-2.5 text-[13px] hover:bg-subtle">
            <span className="font-mono text-[12px]">{p.numero}</span>
            <span className="flex-1 text-muted">{formatDate(p.fecha)}</span>
            <span className="tnum">{formatMoney(p.total, { decimals: false })}</span>
            <StatusBadge tipo="PEDIDO" estado={p.estado} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function AcopiosCliente({ id }: { id: string }) {
  const acopios = useAcopiosConSaldo().filter((a) => a.acopio.clienteId === id);
  if (!acopios.length) return <p className="py-8 text-center text-[13px] text-muted">Sin acopios.</p>;
  return (
    <ul className="divide-y divide-border rounded-card border border-border">
      {acopios.map((a) => (
        <li key={a.acopio.id}>
          <Link href={`/acopios/${a.acopio.id}`} className="flex items-center gap-3 px-3 py-2.5 text-[13px] hover:bg-subtle">
            <span className="font-mono text-[12px]">{a.acopio.numero}</span>
            <span className="flex-1 text-muted">vence {formatDate(a.acopio.fechaVencimiento)}</span>
            <span className="text-right">
              <span className="block tnum">{formatMoney(a.deuda.aPrecioPactado, { decimals: false })}</span>
              <span className="block text-[11px] text-muted">saldo pendiente</span>
            </span>
            <StatusBadge tipo="ACOPIO" estado={a.estado} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CtaCteCliente({ id }: { id: string }) {
  const db = useDb();
  const saldos = useSaldosClientes();
  const c = db.clientes.find((x) => x.id === id)!;
  const s = saldos.get(id) ?? { saldo: 0, vencido: 0, aVencer: 0, comprobantesPendientes: 0 };
  const ant = antiguedadDeuda(db.comprobantes.filter((x) => x.clienteId === id), new Date());
  const uso = c.limiteCredito ? s.saldo / c.limiteCredito : 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Saldo", s.saldo, ""],
          ["Vencido", s.vencido, s.vencido > 0 ? "text-danger" : ""],
          ["A vencer", s.aVencer, ""],
        ].map(([l, v, cls]) => (
          <div key={l as string} className="rounded-card border border-border p-3">
            <div className="text-[12px] text-muted">{l}</div>
            <div className={cn("text-[17px] font-semibold tnum", cls as string)}>{formatMoney(v as number, { decimals: false })}</div>
          </div>
        ))}
      </div>
      {c.limiteCredito > 0 && (
        <div>
          <div className="mb-1 flex justify-between text-[12px] text-muted">
            <span>Uso del límite de crédito ({formatMoney(c.limiteCredito, { decimals: false })})</span>
            <span className={cn("tnum", uso > 1 && "font-medium text-danger")}>{formatPercent(uso, { decimals: 0 })}</span>
          </div>
          <Progress value={uso} tone={uso > 1 ? "danger" : uso > 0.8 ? "accent" : "ink"} />
        </div>
      )}
      <div>
        <h4 className="mb-2 text-[13px] font-semibold">Antigüedad de la deuda</h4>
        <div className="grid grid-cols-4 gap-2">
          {(Object.entries(ant) as [string, number][]).map(([k, v]) => (
            <div key={k} className={cn("rounded-control border border-border p-2 text-center", k === "+90" && v > 0 && "border-danger/30 bg-danger-soft")}>
              <div className="text-[11px] text-muted">{k} días</div>
              <div className={cn("text-[13px] font-semibold tnum", k === "+90" && v > 0 && "text-danger")}>{formatMoney(v, { compact: true })}</div>
            </div>
          ))}
        </div>
      </div>
      <Link href={`/cuentas-corrientes/clientes/${id}`} className="inline-flex text-[13px] font-medium underline-offset-4 hover:underline">
        Ver estado de cuenta y registrar cobro →
      </Link>
    </div>
  );
}

function RentabilidadCliente({ id }: { id: string }) {
  const db = useDb();
  const r = { desde: new Date(Date.now() - 365 * 86_400_000).toISOString(), hasta: new Date().toISOString() };
  const ps = pedidosVendidos(db, r, null).filter((x) => x.pedido.clienteId === id);
  const ingreso = ps.reduce((a, p) => a + p.ingreso, 0);
  const margen = ps.reduce((a, p) => a + p.margen, 0);
  const dbCliente = { ...db, pedidos: db.pedidos.filter((p) => p.clienteId === id) };
  const top = rankingProductos(dbCliente, r, null).sort((a, b) => b.margen - a.margen).slice(0, 8);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-card border border-border p-3">
          <div className="text-[12px] text-muted">Facturado neto (12 meses)</div>
          <div className="text-[17px] font-semibold tnum">{formatMoney(ingreso, { decimals: false })}</div>
        </div>
        <div className="rounded-card border border-t-2 border-border border-t-accent p-3">
          <div className="text-[12px] text-muted">Margen bruto</div>
          <div className="text-[17px] font-semibold tnum">{formatMoney(margen, { decimals: false })}</div>
        </div>
        <div className="rounded-card border border-border p-3">
          <div className="text-[12px] text-muted">Margen %</div>
          <div className="text-[17px] font-semibold tnum">{formatPercent(ingreso ? margen / ingreso : 0)}</div>
        </div>
      </div>
      <h4 className="text-[13px] font-semibold">Productos que más margen dejaron</h4>
      {top.length ? (
        <table className="w-full text-table">
          <thead>
            <tr className="border-b border-border text-[12px] text-muted">
              <th className="py-2 text-left font-medium">Producto</th>
              <th className="py-2 text-right font-medium">Facturado</th>
              <th className="py-2 text-right font-medium">Margen</th>
              <th className="py-2 text-right font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {top.map((t) => (
              <tr key={t.productoId} className="border-b border-border">
                <td className="py-2">{db.productos.find((p) => p.id === t.productoId)?.nombre}</td>
                <td className="py-2 text-right tnum">{formatMoney(t.facturado, { decimals: false })}</td>
                <td className="py-2 text-right tnum">{formatMoney(t.margen, { decimals: false })}</td>
                <td className="py-2 text-right text-muted tnum">{formatPercent(t.margenPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="py-6 text-center text-[13px] text-muted">Sin ventas en los últimos 12 meses.</p>
      )}
    </div>
  );
}

function NotasCliente({ id }: { id: string }) {
  const db = useDb();
  const guardar = useStore((s) => s.guardarCliente);
  const puede = usePuede("clientes.editar");
  const c = db.clientes.find((x) => x.id === id)!;
  const [notas, setNotas] = React.useState(c.notas ?? "");
  return (
    <div className="space-y-3">
      <Textarea aria-label="Notas del cliente" disabled={!puede} rows={8} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Preferencias de entrega, contactos de obra, acuerdos comerciales…" />
      {puede && (
        <Button
          onClick={() => {
            const { id: _i, creadoEn: _c, actualizadoEn: _a, ...resto } = c;
            void _i;
            void _c;
            void _a;
            const r = guardar({ ...resto, notas }, c.id);
            if (r.ok) toast.success("Notas guardadas");
            else toast.error(r.error);
          }}
        >
          <Save /> Guardar notas
        </Button>
      )}
    </div>
  );
}
