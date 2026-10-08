"use client";

import * as React from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePuede } from "@/store/selectors";
import type { Cliente, CondicionIVA, CondicionPago, TipoCliente } from "@/domain/types";
import { validarCUIT, formatearCUIT } from "@/domain/cuit";
import { CONDICION_IVA_LABEL, CONDICION_PAGO_LABEL, TIPO_CLIENTE_LABEL, opciones } from "@/domain/estados";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, NumberInput, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/ui/form-field";
import { Impacto, ImpactoCampo, medir } from "@/capacitacion";

type Form = Omit<Cliente, "id" | "creadoEn" | "actualizadoEn">;

function vacio(sucursalId: string, vendedorId?: string): Form {
  return {
    codigo: "",
    razonSocial: "",
    nombreFantasia: "",
    tipo: "PARTICULAR",
    cuit: "",
    condicionIVA: "CF",
    circuitoHabitual: 2,
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
  const [f, setF] = React.useState<Form>(() => (cliente ? { ...cliente } : vacio(usuario?.sucursalId ?? "suc_central", usuario?.rol === "VENTAS" ? usuario.id : undefined)));
  const [err, setErr] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    if (cliente) setF({ ...cliente });
  }, [cliente]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const submit = async (e: React.FormEvent) => {
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
    const ejecutar = () => guardar({ ...f, cuit: f.cuit ? formatearCUIT(f.cuit) : "", nombreFantasia: f.nombreFantasia || undefined }, cliente?.id);
    const r = await medir(cliente ? "editarCliente" : "crearCliente", { clienteId: cliente?.id }, ejecutar);
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
              if (!cliente) set("listaPreciosId", t === "CONSTRUCTORA" ? "lst_may" : t === "PARTICULAR" ? "lst_pub" : t === "ARQUITECTO" ? "lst_gen" : "lst_may");
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
        <FormField label="Circuito habitual" hint="Se precarga al vender y acopiar">
          <Select disabled={ro} value={String(f.circuitoHabitual)} onValueChange={(v) => set("circuitoHabitual", Number(v) as 1 | 2)} options={[{ value: "1", label: "AC1 · Fiscal" }, { value: "2", label: "AC2 · Interno" }]} />
        </FormField>
        <FormField label="Contacto" htmlFor="cl-cto">
          <Input id="cl-cto" disabled={ro} value={f.contacto ?? ""} onChange={(e) => set("contacto", e.target.value || undefined)} />
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
          <ImpactoCampo campo="cliente.limiteCredito" />
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
      {!ro && !cliente && <Impacto accion="crearCliente" />}
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

/** Edición de datos del cliente. */
export function EditarClienteDialog({ cliente, open, onOpenChange }: { cliente: Cliente; open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" title={`Editar ${cliente.razonSocial}`}>
        {open && <ClienteForm cliente={cliente} onSaved={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
