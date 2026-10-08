"use client";

import * as React from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePuede } from "@/store/selectors";
import type { CondicionIVA, CondicionPago, Proveedor, TipoProveedor } from "@/domain/types";
import { validarCUIT, formatearCUIT } from "@/domain/cuit";
import { CONDICION_IVA_LABEL, CONDICION_PAGO_LABEL, TIPO_PROVEEDOR_LABEL, opciones } from "@/domain/estados";
import { Button } from "@/components/ui/button";
import { Input, NumberInput, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Impacto, ImpactoCampo, medir } from "@/capacitacion";

type Form = Omit<Proveedor, "id" | "creadoEn" | "actualizadoEn">;
const VACIO: Form = { codigo: "", razonSocial: "", tipo: "FABRICANTE", cuit: "", condicionIVA: "RI", circuitoHabitual: 1, email: "", telefono: "", direccion: "", contacto: "", plazoEntregaDias: 5, condicionPago: "CTA_CTE_30", unidadNegocioIds: ["un_cor"], activo: true, notas: "" };

export function FormProveedor({ proveedor, onSaved }: { proveedor?: Proveedor; onSaved: (id: string) => void }) {
  const db = useDb();
  const guardar = useStore((s) => s.guardarProveedor);
  const puede = usePuede("proveedores.editar");
  const [f, setF] = React.useState<Form>(proveedor ? { ...proveedor } : VACIO);
  const [err, setErr] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    if (proveedor) setF({ ...proveedor });
  }, [proveedor]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!f.razonSocial.trim()) er.razonSocial = "Ingresá la razón social.";
    const c = validarCUIT(f.cuit);
    if (c) er.cuit = c;
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) er.email = "Email inválido.";
    setErr(er);
    if (Object.keys(er).length) return;
    const r = await medir(proveedor ? "editarProveedor" : "crearProveedor", { proveedorId: proveedor?.id }, () => guardar({ ...f, cuit: formatearCUIT(f.cuit) }, proveedor?.id));
    if (r.ok) {
      toast.success(proveedor ? "Proveedor actualizado" : "Proveedor creado");
      onSaved(r.data);
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
        <FormField label="Tipo">
          <Select disabled={ro} value={f.tipo} onValueChange={(v) => set("tipo", v as TipoProveedor)} options={opciones(TIPO_PROVEEDOR_LABEL)} />
        </FormField>
        <FormField label="Circuito habitual">
          <Select disabled={ro} value={String(f.circuitoHabitual)} onValueChange={(v) => set("circuitoHabitual", Number(v) as 1 | 2)} options={[{ value: "1", label: "AC1 · Fiscal" }, { value: "2", label: "AC2 · Interno" }]} />
          <ImpactoCampo campo={`circuito.${f.circuitoHabitual}`} />
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
      <FormField label="Unidades de negocio que provee">
        <div className="flex gap-3">
          {db.unidadesNegocio.map((u) => (
            <label key={u.id} className="flex items-center gap-2 text-[13px]">
              <Checkbox disabled={ro} checked={f.unidadNegocioIds.includes(u.id)} onCheckedChange={(v) => set("unidadNegocioIds", v ? [...f.unidadNegocioIds, u.id] : f.unidadNegocioIds.filter((x) => x !== u.id))} aria-label={u.nombre} /> {u.nombre}
            </label>
          ))}
        </div>
      </FormField>
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
      {!ro && !proveedor && <Impacto accion="crearProveedor" />}
    </form>
  );
}


/** Alta / edición de proveedor en un diálogo. */
export function ProveedorDialog({ proveedor, open, onOpenChange, onSaved }: { proveedor?: Proveedor; open: boolean; onOpenChange: (v: boolean) => void; onSaved?: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" title={proveedor ? `Editar ${proveedor.razonSocial}` : "Nuevo proveedor"}>
        {open && <FormProveedor proveedor={proveedor} onSaved={() => { onSaved?.(); onOpenChange(false); }} />}
      </DialogContent>
    </Dialog>
  );
}
