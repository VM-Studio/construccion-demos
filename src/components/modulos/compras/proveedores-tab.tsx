"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Plus, Save } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePuede, useSaldosProveedores } from "@/store/selectors";
import type { CondicionIVA, CondicionPago, Proveedor } from "@/domain/types";
import { validarCUIT, formatearCUIT } from "@/domain/cuit";
import { CONDICION_IVA_LABEL, CONDICION_PAGO_LABEL, opciones } from "@/domain/estados";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EntitySheet } from "@/components/shared/entity-sheet";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NumberInput, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/ui/form-field";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ProveedoresTab({ abrirId }: { abrirId?: string | null }) {
  const db = useDb();
  const router = useRouter();
  const saldos = useSaldosProveedores();
  const puede = usePuede("proveedores.editar");
  const verCtaCte = usePuede("ctacte.ver");
  const [nuevo, setNuevo] = React.useState(false);
  const ocAbiertas = (id: string) => db.ordenesCompra.filter((o) => o.proveedorId === id && ["ENVIADA", "CONFIRMADA", "RECIBIDA_PARCIAL"].includes(o.estado)).length;

  const columnas: Column<Proveedor>[] = [
    { key: "razon", header: "Razón social", sortable: true, sortValue: (p) => p.razonSocial, cell: (p) => <span className={cn("block min-w-[180px] font-medium", !p.activo && "text-muted line-through")}>{p.razonSocial}</span> },
    { key: "cuit", header: "CUIT", cell: (p) => <span className="whitespace-nowrap tnum">{p.cuit}</span> },
    { key: "iva", header: "Cond. IVA", hideOnMobile: true, cell: (p) => <span className="whitespace-nowrap text-muted">{p.condicionIVA}</span> },
    { key: "contacto", header: "Contacto", hideOnMobile: true, cell: (p) => <span className="whitespace-nowrap text-muted">{p.contacto}</span> },
    { key: "tel", header: "Teléfono", hideOnMobile: true, cell: (p) => <span className="whitespace-nowrap text-muted">{p.telefono}</span> },
    { key: "plazo", header: "Plazo", align: "right", sortable: true, sortValue: (p) => p.plazoEntregaDias, cell: (p) => <span className="tnum">{p.plazoEntregaDias} días</span> },
    { key: "cond", header: "Cond. pago", hideOnMobile: true, cell: (p) => <span className="whitespace-nowrap text-muted">{CONDICION_PAGO_LABEL[p.condicionPago]}</span> },
    ...(verCtaCte
      ? [{
          key: "saldo",
          header: "Saldo cta. cte.",
          align: "right" as const,
          sortable: true,
          sortValue: (p: Proveedor) => saldos.get(p.id)?.saldo ?? 0,
          cell: (p: Proveedor) => {
            const s = saldos.get(p.id);
            return <span className={cn("tnum", (s?.vencido ?? 0) > 0 && "font-medium text-danger")}>{formatMoney(s?.saldo ?? 0, { decimals: false })}</span>;
          },
        }]
      : []),
    { key: "oc", header: "OC abiertas", align: "right", cell: (p) => <span className="tnum">{ocAbiertas(p.id) || "—"}</span> },
    { key: "activo", header: "Estado", hideOnMobile: true, cell: (p) => (p.activo ? <Badge variant="success">Activo</Badge> : <Badge>Inactivo</Badge>) },
  ];

  return (
    <>
      <DataTable
        rows={db.proveedores}
        columns={columnas}
        getRowId={(p) => p.id}
        searchText={(p) => `${p.razonSocial} ${p.cuit} ${p.contacto} ${p.notas ?? ""}`}
        searchPlaceholder="Razón social, CUIT o contacto"
        onRowClick={(p) => router.replace(`/compras?tab=proveedores&proveedor=${p.id}`, { scroll: false })}
        initialSort={{ key: "razon", dir: "asc" }}
        empty={{ icono: Building2, titulo: "Sin proveedores" }}
        actions={puede && <Button size="sm" onClick={() => setNuevo(true)}><Plus /> Nuevo proveedor</Button>}
      />
      <ProveedorSheet
        id={abrirId}
        nuevo={nuevo}
        onClose={() => {
          setNuevo(false);
          router.replace("/compras?tab=proveedores", { scroll: false });
        }}
      />
    </>
  );
}

type Form = Omit<Proveedor, "id" | "creadoEn" | "actualizadoEn">;
const VACIO: Form = { razonSocial: "", cuit: "", condicionIVA: "RI", email: "", telefono: "", direccion: "", contacto: "", plazoEntregaDias: 5, condicionPago: "CTA_CTE_30", activo: true, notas: "" };

function ProveedorSheet({ id, nuevo, onClose }: { id?: string | null; nuevo: boolean; onClose: () => void }) {
  const db = useDb();
  const p = id ? db.proveedores.find((x) => x.id === id) : undefined;
  if (!p && !nuevo) return null;
  return (
    <EntitySheet
      open
      onOpenChange={(v) => !v && onClose()}
      titulo={p?.razonSocial ?? "Nuevo proveedor"}
      subtitulo={p ? `CUIT ${p.cuit} · ${p.contacto}` : "Completá los datos fiscales y comerciales"}
      tabs={
        p
          ? [
              { value: "datos", label: "Datos", content: <FormProveedor proveedor={p} onSaved={() => {}} /> },
              { value: "productos", label: "Productos que provee", content: <ProductosProveedor id={p.id} /> },
              { value: "oc", label: "Órdenes de compra", content: <OCsProveedor id={p.id} /> },
              { value: "ctacte", label: "Cuenta corriente", content: <CtaCteProveedor id={p.id} /> },
            ]
          : [{ value: "datos", label: "Datos", content: <FormProveedor onSaved={onClose} /> }]
      }
    />
  );
}

function FormProveedor({ proveedor, onSaved }: { proveedor?: Proveedor; onSaved: () => void }) {
  const guardar = useStore((s) => s.guardarProveedor);
  const puede = usePuede("proveedores.editar");
  const [f, setF] = React.useState<Form>(proveedor ? { ...proveedor } : VACIO);
  const [err, setErr] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    if (proveedor) setF({ ...proveedor });
  }, [proveedor]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!f.razonSocial.trim()) er.razonSocial = "Ingresá la razón social.";
    const c = validarCUIT(f.cuit);
    if (c) er.cuit = c;
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) er.email = "Email inválido.";
    setErr(er);
    if (Object.keys(er).length) return;
    const r = guardar({ ...f, cuit: formatearCUIT(f.cuit) }, proveedor?.id);
    if (r.ok) {
      toast.success(proveedor ? "Proveedor actualizado" : "Proveedor creado");
      onSaved();
    } else toast.error(r.error);
  };
  const ro = !puede;
  return (
    <form onSubmit={submit} className="space-y-4">
      <FormField label="Razón social" required error={err.razonSocial} htmlFor="pv-rs">
        <Input id="pv-rs" disabled={ro} value={f.razonSocial} onChange={(e) => set("razonSocial", e.target.value)} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="CUIT" required error={err.cuit} hint="Se valida el dígito verificador" htmlFor="pv-cuit">
          <Input id="pv-cuit" disabled={ro} value={f.cuit} onChange={(e) => set("cuit", e.target.value)} onBlur={() => set("cuit", formatearCUIT(f.cuit))} placeholder="30-12345678-9" aria-invalid={!!err.cuit} />
        </FormField>
        <FormField label="Condición IVA">
          <Select disabled={ro} value={f.condicionIVA} onValueChange={(v) => set("condicionIVA", v as CondicionIVA)} options={opciones(CONDICION_IVA_LABEL)} />
        </FormField>
        <FormField label="Contacto" htmlFor="pv-contacto">
          <Input id="pv-contacto" disabled={ro} value={f.contacto} onChange={(e) => set("contacto", e.target.value)} />
        </FormField>
        <FormField label="Teléfono" htmlFor="pv-tel">
          <Input id="pv-tel" disabled={ro} value={f.telefono} onChange={(e) => set("telefono", e.target.value)} />
        </FormField>
        <FormField label="Email" error={err.email} htmlFor="pv-email">
          <Input id="pv-email" disabled={ro} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
        </FormField>
        <FormField label="Dirección" htmlFor="pv-dir">
          <Input id="pv-dir" disabled={ro} value={f.direccion} onChange={(e) => set("direccion", e.target.value)} />
        </FormField>
        <FormField label="Plazo de entrega (días)" htmlFor="pv-plazo">
          <NumberInput id="pv-plazo" disabled={ro} value={f.plazoEntregaDias} min={0} onValueChange={(v) => set("plazoEntregaDias", Math.round(v))} />
        </FormField>
        <FormField label="Condición de pago">
          <Select disabled={ro} value={f.condicionPago} onValueChange={(v) => set("condicionPago", v as CondicionPago)} options={opciones(CONDICION_PAGO_LABEL)} />
        </FormField>
      </div>
      <FormField label="Notas" htmlFor="pv-notas">
        <Textarea id="pv-notas" disabled={ro} value={f.notas ?? ""} onChange={(e) => set("notas", e.target.value)} rows={2} />
      </FormField>
      <label className="flex items-center gap-3 text-[13px]">
        <Switch disabled={ro} checked={f.activo} onCheckedChange={(v) => set("activo", v)} /> Proveedor activo
      </label>
      {!ro && (
        <div className="flex justify-end border-t border-border pt-4">
          <Button type="submit"><Save /> {proveedor ? "Guardar cambios" : "Crear proveedor"}</Button>
        </div>
      )}
    </form>
  );
}

function ProductosProveedor({ id }: { id: string }) {
  const db = useDb();
  const verCostos = usePuede("margenes.ver");
  const prods = db.productos.filter((p) => p.proveedorHabitualId === id);
  if (!prods.length) return <p className="py-8 text-center text-[13px] text-muted">No hay productos con este proveedor habitual.</p>;
  return (
    <table className="w-full text-table">
      <thead>
        <tr className="border-b border-border text-[12px] text-muted">
          <th className="py-2 text-left font-medium">Producto</th>
          {verCostos && <th className="py-2 text-right font-medium">Último costo</th>}
          <th className="py-2 text-right font-medium">Fecha</th>
        </tr>
      </thead>
      <tbody>
        {prods.map((p) => (
          <tr key={p.id} className="border-b border-border">
            <td className="py-2"><Link href={`/productos?id=${p.id}`} className="hover:underline"><span className="mr-2 whitespace-nowrap font-mono text-[11px] text-muted">{p.codigo}</span>{p.nombre}</Link></td>
            {verCostos && <td className="py-2 text-right tnum">{formatMoney(p.costoUltimo)}</td>}
            <td className="py-2 text-right text-muted">{formatDate(p.fechaUltimoCosto)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function OCsProveedor({ id }: { id: string }) {
  const db = useDb();
  const ocs = db.ordenesCompra.filter((o) => o.proveedorId === id).sort((a, b) => b.fechaEmision.localeCompare(a.fechaEmision));
  if (!ocs.length) return <p className="py-8 text-center text-[13px] text-muted">Sin órdenes de compra.</p>;
  return (
    <ul className="divide-y divide-border rounded-card border border-border">
      {ocs.map((o) => (
        <li key={o.id}>
          <Link href={`/compras/oc/${o.id}`} className="flex items-center gap-3 px-3 py-2.5 text-[13px] hover:bg-subtle">
            <span className="font-mono text-[12px]">{o.numero}</span>
            <span className="flex-1 text-muted">{formatDate(o.fechaEmision)}</span>
            <span className="tnum">{formatMoney(o.total, { decimals: false })}</span>
            <StatusBadge tipo="OC" estado={o.estado} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CtaCteProveedor({ id }: { id: string }) {
  const saldos = useSaldosProveedores();
  const s = saldos.get(id);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Saldo", s?.saldo ?? 0, ""],
          ["Vencido", s?.vencido ?? 0, (s?.vencido ?? 0) > 0 ? "text-danger" : ""],
          ["A vencer", s?.aVencer ?? 0, ""],
        ].map(([l, v, c]) => (
          <div key={l as string} className="rounded-card border border-border p-3">
            <div className="text-[12px] text-muted">{l}</div>
            <div className={cn("text-[17px] font-semibold tnum", c as string)}>{formatMoney(v as number, { decimals: false })}</div>
          </div>
        ))}
      </div>
      <p className="text-[13px] text-muted">{s?.comprobantesPendientes ?? 0} facturas pendientes de pago.</p>
      <Link href={`/cuentas-corrientes/proveedores/${id}`} className="inline-flex text-[13px] font-medium underline-offset-4 hover:underline">
        Ver cuenta corriente completa y registrar pago →
      </Link>
    </div>
  );
}
