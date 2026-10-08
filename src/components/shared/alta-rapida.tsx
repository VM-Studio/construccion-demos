"use client";

import * as React from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePuede } from "@/store/selectors";
import type { Permiso } from "@/domain/permisos";
import { ClienteForm } from "@/components/modulos/ventas/cliente-form";
import { FormProveedor } from "@/components/modulos/proveedores/proveedor-form";
import { FormProducto } from "@/components/modulos/productos/producto-sheet";
import { EntitySheet } from "./entity-sheet";
import { Combobox, type OpcionCombo } from "./combobox";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input, NumberInput } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatNumber } from "@/lib/format";

export type TipoAltaRapida = "cliente" | "proveedor" | "producto" | "vehiculo" | "chofer";

const TITULO: Record<TipoAltaRapida, [string, string]> = {
  cliente: ["Nuevo cliente", "Al guardar queda elegido y seguís con lo que estabas cargando."],
  proveedor: ["Nuevo proveedor", "Al guardar queda elegido y seguís con lo que estabas cargando."],
  producto: ["Nuevo artículo", "Al guardar se agrega y seguís con lo que estabas cargando."],
  vehiculo: ["Nuevo vehículo", "Al guardar queda elegido y seguís con lo que estabas cargando."],
  chofer: ["Nuevo chofer", "Al guardar queda elegido y seguís con lo que estabas cargando."],
};

export const PERMISO_ALTA: Record<TipoAltaRapida, Permiso> = {
  cliente: "clientes.editar",
  proveedor: "proveedores.editar",
  producto: "productos.editar",
  vehiculo: "vehiculos.editar",
  chofer: "vehiculos.editar",
};

/**
 * Alta rápida en un panel lateral: se abre por encima de lo que se está cargando
 * (sin perderlo) y, al guardar, devuelve el id para dejarlo seleccionado.
 */
export function AltaRapidaSheet({ tipo, open, onOpenChange, onCreado, unidadNegocioId }: { tipo: TipoAltaRapida; open: boolean; onOpenChange: (v: boolean) => void; onCreado: (id: string) => void; unidadNegocioId?: string | null }) {
  const [titulo, subtitulo] = TITULO[tipo];
  const listo = (id: string) => {
    onCreado(id);
    onOpenChange(false);
  };
  return (
    <EntitySheet open={open} onOpenChange={onOpenChange} titulo={titulo} subtitulo={subtitulo} width={tipo === "chofer" || tipo === "vehiculo" ? 480 : 640}>
      {open && (
        <>
          {tipo === "cliente" && <ClienteForm onSaved={listo} compacto />}
          {tipo === "proveedor" && <FormProveedor onSaved={listo} />}
          {tipo === "producto" && <FormProducto onSaved={listo} unidadNegocioId={unidadNegocioId} />}
          {tipo === "vehiculo" && <FormVehiculo onSaved={listo} />}
          {tipo === "chofer" && <FormChofer onSaved={listo} />}
        </>
      )}
    </EntitySheet>
  );
}

function FormVehiculo({ onSaved }: { onSaved: (id: string) => void }) {
  const db = useDb();
  const [f, setF] = React.useState({ patente: "", descripcion: "", capacidadKg: 3500, choferId: "" });
  const guardar = () => {
    const r = useStore.getState().guardarVehiculo({ ...f, patente: f.patente.toUpperCase(), choferId: f.choferId || undefined, activo: true });
    if (!r.ok) return toast.error(r.error);
    toast.success("Vehículo creado");
    onSaved(r.data);
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Patente" required htmlFor="ar-vh-p"><Input id="ar-vh-p" autoFocus value={f.patente} onChange={(e) => setF({ ...f, patente: e.target.value })} placeholder="AE 412 KD" /></FormField>
        <FormField label="Capacidad (kg)" htmlFor="ar-vh-c"><NumberInput id="ar-vh-c" value={f.capacidadKg} min={0} onValueChange={(x) => setF({ ...f, capacidadKg: x })} /></FormField>
        <FormField label="Descripción" htmlFor="ar-vh-d" className="sm:col-span-2"><Input id="ar-vh-d" value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} placeholder="Ej. Ford Cargo 1723 playo" /></FormField>
        <FormField label="Chofer habitual" className="sm:col-span-2"><Select value={f.choferId} onValueChange={(x) => setF({ ...f, choferId: x })} options={[{ value: "", label: "Sin chofer habitual" }, ...db.choferes.filter((c) => c.activo).map((c) => ({ value: c.id, label: c.nombre }))]} /></FormField>
      </div>
      <div className="flex justify-end"><Button onClick={guardar} disabled={!f.patente.trim()}><Save /> Guardar vehículo</Button></div>
    </div>
  );
}

function FormChofer({ onSaved }: { onSaved: (id: string) => void }) {
  const [f, setF] = React.useState({ nombre: "", telefono: "" });
  const guardar = () => {
    const r = useStore.getState().guardarChofer({ ...f, activo: true });
    if (!r.ok) return toast.error(r.error);
    toast.success("Chofer creado");
    onSaved(r.data);
  };
  return (
    <div className="space-y-4">
      <FormField label="Nombre" required htmlFor="ar-ch-n"><Input id="ar-ch-n" autoFocus value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></FormField>
      <FormField label="Teléfono" htmlFor="ar-ch-t"><Input id="ar-ch-t" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} /></FormField>
      <div className="flex justify-end"><Button onClick={guardar} disabled={!f.nombre.trim()}><Save /> Guardar chofer</Button></div>
    </div>
  );
}

type SelectorProps = {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  /** Opciones a mostrar (por defecto, todas las activas). */
  filtro?: (x: { id: string }) => boolean;
};

/** Combobox de entidad con "+ Crear nuevo…" al final (si el usuario tiene permiso). */
function SelectorEntidad({ tipo, opciones, label, ...p }: SelectorProps & { tipo: TipoAltaRapida; opciones: OpcionCombo[]; label: string }) {
  const [alta, setAlta] = React.useState(false);
  const puedeCrear = usePuede(PERMISO_ALTA[tipo]);
  return (
    <>
      <Combobox
        id={p.id}
        aria-label={p["aria-label"] ?? label}
        className={p.className}
        disabled={p.disabled}
        value={p.value}
        onChange={p.onChange}
        placeholder={p.placeholder ?? `Buscar ${label.toLowerCase()}…`}
        opciones={opciones}
        vacio={opciones.length ? "Sin resultados" : `Todavía no hay ${label.toLowerCase()}s cargados`}
        accionNuevo={puedeCrear ? { label: `Crear nuevo ${label.toLowerCase()}…`, onSelect: () => setAlta(true) } : undefined}
      />
      <AltaRapidaSheet tipo={tipo} open={alta} onOpenChange={setAlta} onCreado={p.onChange} />
    </>
  );
}

export function SelectorCliente(p: SelectorProps) {
  const db = useDb();
  const opciones = db.clientes.filter((c) => c.activo && (!p.filtro || p.filtro(c))).map((c) => ({ value: c.id, label: c.nombreFantasia ?? c.razonSocial, detalle: c.codigo, buscar: `${c.razonSocial} ${c.cuit}` }));
  return <SelectorEntidad tipo="cliente" label="Cliente" opciones={opciones} {...p} />;
}

export function SelectorProveedor(p: SelectorProps) {
  const db = useDb();
  const opciones = db.proveedores.filter((x) => x.activo && (!p.filtro || p.filtro(x))).map((x) => ({ value: x.id, label: x.razonSocial, detalle: x.codigo, buscar: x.cuit }));
  return <SelectorEntidad tipo="proveedor" label="Proveedor" opciones={opciones} {...p} />;
}

export function SelectorVehiculo(p: SelectorProps) {
  const db = useDb();
  const opciones = db.vehiculos.filter((v) => v.activo && (!p.filtro || p.filtro(v))).map((v) => ({ value: v.id, label: `${v.patente} · ${v.descripcion}`, detalle: `${formatNumber(v.capacidadKg, 0)} kg` }));
  return <SelectorEntidad tipo="vehiculo" label="Vehículo" opciones={opciones} {...p} />;
}

export function SelectorChofer(p: SelectorProps) {
  const db = useDb();
  const opciones = db.choferes.filter((c) => c.activo && (!p.filtro || p.filtro(c))).map((c) => ({ value: c.id, label: c.nombre, detalle: c.telefono }));
  return <SelectorEntidad tipo="chofer" label="Chofer" opciones={opciones} {...p} />;
}
