"use client";

import { useMovimientos } from "@/lib/datos/hooks";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftRight, Calculator, Copy, Rows3, Save, SlidersHorizontal, X } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePosiciones, usePuede } from "@/store/selectors";
import type { Producto, Unidad } from "@/domain/types";
import { siguienteCodigoProducto } from "@/domain/productos";
import { markupsEfectivos, markupsSospechosos, nombreRepetidoEnRubro, preciosParaCosto, siguientesCodigos } from "@/domain/duplicar";
import type { CampoDuplicar } from "@/store/types";
import { Checkbox } from "@/components/ui/checkbox";
import { SerieDialog } from "./serie-dialog";
import { calcularPrecioDesdeMarkup, markupEfectivo } from "@/domain/precios";
import { opciones, UNIDAD_LABEL } from "@/domain/estados";
import { EntitySheet } from "@/components/shared/entity-sheet";
import { StatusBadge } from "@/components/shared/status-badge";
import { SelectorProveedor } from "@/components/shared/alta-rapida";
import { FormField } from "@/components/ui/form-field";
import { Input, NumberInput, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LineaChart } from "@/components/charts";
import { formatDate, formatDateTime, formatMoney, formatPercent, formatQty } from "@/lib/format";
import { referenciaMovimiento, nombreUsuario } from "@/lib/referencias";
import { cn } from "@/lib/utils";
import { Impacto, ImpactoCampo, medir } from "@/capacitacion";
import { formatUSD, useTipoCambio } from "@/lib/tipo-cambio";

type Form = Omit<Producto, "id" | "creadoEn" | "actualizadoEn">;

function vacio(rubroId: string, codigo: string): Form {
  return {
    codigo,
    nombre: "",
    descripcion: "",
    rubroId,
    unidadNegocioId: "",
    marca: "",
    unidad: "UN",
    unidadesPorPallet: undefined,
    proveedorHabitualId: undefined,
    costoUltimo: 0,
    costoPromedio: 0,
    fechaUltimoCosto: new Date().toISOString(),
    stockMinimo: 0,
    activo: true,
    codigoBarras: "",
    pesoKg: undefined,
  };
}

/**
 * Ficha de producto: datos, precios, stock, kardex e historial de costos. También alta
 * (`nuevo`) y duplicación (`duplicarDeId`): "Guardar y duplicar" encadena altas parecidas.
 */
export function ProductoSheet({ productoId, nuevo, duplicarDeId, onClose, onCreado }: { productoId?: string | null; nuevo?: boolean; duplicarDeId?: string | null; onClose: () => void; onCreado?: (id: string) => void }) {
  const db = useDb();
  const producto = productoId ? db.productos.find((p) => p.id === productoId) : undefined;
  const puedeEditar = usePuede("productos.editar");
  // Duplicación en curso (desde la cabecera de la ficha, el listado o "Guardar y duplicar").
  const [dupDe, setDupDe] = React.useState<string | null>(duplicarDeId ?? null);
  const [vuelta, setVuelta] = React.useState(0);
  const [serieDe, setSerieDe] = React.useState<string | null>(null);
  React.useEffect(() => setDupDe(duplicarDeId ?? null), [duplicarDeId, productoId, nuevo]);
  const origen = dupDe ? db.productos.find((p) => p.id === dupDe) : undefined;
  const open = !!producto || !!nuevo || !!origen;
  const [tab, setTab] = React.useState("general");
  React.useEffect(() => setTab("general"), [productoId, nuevo, dupDe]);
  const pos = usePosiciones().get(producto?.id ?? "");
  const verCostos = usePuede("margenes.ver");
  const cerrar = () => {
    setDupDe(null);
    onClose();
  };
  const encadenar = (id: string) => {
    // "Guardar y duplicar": el recién creado pasa a ser el origen del siguiente.
    setDupDe(id);
    setVuelta((v) => v + 1);
  };

  const enFormulario = !!origen || (!producto && !!nuevo);
  const form = <TabGeneral key={`${dupDe ?? "nuevo"}-${vuelta}`} origen={origen} onSaved={(id) => (onCreado ? onCreado(id) : cerrar())} onGuardarYDuplicar={encadenar} />;
  const tabs = enFormulario
    ? [{ value: "general", label: origen ? "Duplicar" : "General", content: form }]
    : producto
      ? [
          { value: "general", label: "General", content: <TabGeneral producto={producto} onSaved={() => {}} /> },
          { value: "precios", label: "Precios", content: <TabPrecios producto={producto} /> },
          { value: "stock", label: "Stock", content: <TabStock producto={producto} /> },
          { value: "movimientos", label: "Movimientos", content: <TabMovimientos producto={producto} /> },
          ...(verCostos ? [{ value: "costos", label: "Historial de costos", content: <TabCostos producto={producto} /> }] : []),
        ]
      : [];

  return (
    <>
      <EntitySheet
        open={open}
        onOpenChange={(v) => !v && cerrar()}
        titulo={origen ? "Duplicar artículo" : producto ? producto.nombre : "Nuevo producto"}
        subtitulo={origen ? `A partir de ${origen.codigo} · ${origen.nombre}` : producto ? `${producto.codigo} · ${producto.marca ?? ""} · ${db.rubros.find((r) => r.id === producto.rubroId)?.nombre}` : "Completá los datos del producto"}
        estado={!enFormulario && producto && pos ? <StatusBadge tipo="STOCK" estado={pos.estado} /> : undefined}
        acciones={
          !enFormulario && producto && puedeEditar ? (
            <div className="flex gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => setDupDe(producto.id)}><Copy /> Duplicar</Button>
              <Button size="sm" variant="secondary" onClick={() => setSerieDe(producto.id)}><Rows3 /> Crear serie</Button>
            </div>
          ) : undefined
        }
        tabs={tabs}
        tab={tab}
        onTabChange={setTab}
      />
      {serieDe && <SerieDialog origenId={serieDe} onClose={() => setSerieDe(null)} />}
    </>
  );
}

/** Formulario de datos generales del artículo (también alta rápida desde los buscadores). */
export function FormProducto({ producto, onSaved, unidadNegocioId }: { producto?: Producto; onSaved: (id: string) => void; unidadNegocioId?: string | null }) {
  return <TabGeneral producto={producto} onSaved={onSaved} unidadNegocioId={unidadNegocioId} />;
}

const CAMPOS_SIEMPRE: { campo: CampoDuplicar; label: string }[] = [
  { campo: "nombre", label: "Nombre" },
  { campo: "pesoKg", label: "Peso" },
  { campo: "costoUltimo", label: "Costo" },
  { campo: "precios", label: "Precio" },
];

/** Campos del formulario que se comparan con el origen al duplicar. */
type Comparable = "rubroId" | "codigo" | "nombre" | "descripcion" | "marca" | "unidad" | "unidadesPorPallet" | "proveedorHabitualId" | "codigoBarras" | "pesoKg" | "monedaCosto" | "costoUSD" | "costoUltimo" | "stockMinimo" | "activo";

function TabGeneral({
  producto,
  origen,
  onSaved,
  onGuardarYDuplicar,
  unidadNegocioId,
}: {
  producto?: Producto;
  origen?: Producto;
  onSaved: (id: string) => void;
  onGuardarYDuplicar?: (id: string) => void;
  unidadNegocioId?: string | null;
}) {
  const db = useDb();
  const guardar = useStore((s) => s.guardarProducto);
  const duplicar = useStore((s) => s.duplicarProducto);
  const recordar = useStore((s) => s.recordarCargaArticulo);
  const setCamposSiempre = useStore((s) => s.setCamposSiempre);
  const usuarioId = useStore((s) => s.ui.usuarioId) ?? "";
  const carga = useStore((s) => s.ui.cargaArticulos);
  const camposSiempre = carga?.camposSiempre?.[usuarioId] ?? [];
  const puedeEditar = usePuede("productos.editar");
  const verCostos = usePuede("margenes.ver");
  const nombreRef = React.useRef<HTMLInputElement>(null);
  const dupRef = React.useRef(false);

  // Rubro y proveedor iniciales de un alta: los últimos usados en esta sesión, si siguen existiendo.
  const rubroRecordado = carga?.ultimoRubroId && db.rubros.some((r) => r.id === carga.ultimoRubroId && (!unidadNegocioId || r.unidadNegocioId === unidadNegocioId)) ? carga.ultimoRubroId : undefined;
  const rubroInicial = rubroRecordado ?? (unidadNegocioId ? db.rubros.find((r) => r.unidadNegocioId === unidadNegocioId) : undefined)?.id ?? db.rubros[0]?.id ?? "";
  const inicial = (): Form => {
    if (producto) return { ...producto };
    if (origen) {
      const vaciar = new Set(camposSiempre);
      return {
        ...origen,
        codigo: siguientesCodigos(origen.rubroId, db.productos, db.rubros, 1)[0] ?? "",
        codigoBarras: "",
        nombre: vaciar.has("nombre") ? "" : origen.nombre,
        pesoKg: vaciar.has("pesoKg") ? undefined : origen.pesoKg,
        costoUltimo: vaciar.has("costoUltimo") ? 0 : origen.costoUltimo,
        costoPromedio: vaciar.has("costoUltimo") ? 0 : origen.costoUltimo,
        fechaUltimoCosto: new Date().toISOString(),
      };
    }
    const proveedorRecordado = carga?.ultimoProveedorId && db.proveedores.some((p) => p.id === carga.ultimoProveedorId) ? carga.ultimoProveedorId : undefined;
    return { ...vacio(rubroInicial, siguienteCodigoProducto(rubroInicial, db.productos, db.rubros)), proveedorHabitualId: proveedorRecordado };
  };
  const [f, setF] = React.useState<Form>(inicial);
  // Precios del duplicado: los del origen o recalculados con su markup efectivo si cambia el costo.
  const listas = db.listasPrecios;
  const markups = React.useMemo(() => (origen ? markupsEfectivos(origen, db.precios, listas) : {}), [origen, db.precios, listas]);
  const preciosOrigen = React.useMemo(() => (origen ? preciosParaCosto(origen, db.precios, listas, origen.costoUltimo) : {}), [origen, db.precios, listas]);
  const [precios, setPrecios] = React.useState<Record<string, number>>(() => (origen ? (camposSiempre.includes("precios") ? Object.fromEntries(listas.map((l) => [l.id, 0])) : origen ? preciosParaCosto(origen, db.precios, listas, f.costoUltimo) : {}) : {}));
  const [preciosTocados, setPreciosTocados] = React.useState<Set<string>>(new Set());
  const [errores, setErrores] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    if (producto) setF({ ...producto });
  }, [producto]);
  // Al duplicar, el nombre queda enfocado y seleccionado para sobrescribirlo rápido.
  React.useEffect(() => {
    if (!origen) return;
    const t = setTimeout(() => {
      nombreRef.current?.focus();
      nombreRef.current?.select();
    }, 80);
    return () => clearTimeout(t);
  }, [origen]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const setCosto = (v: number) => {
    set("costoUltimo", v);
    if (origen) setPrecios((ps) => ({ ...ps, ...Object.fromEntries(Object.entries(preciosParaCosto(origen, db.precios, listas, v)).filter(([k]) => !preciosTocados.has(k))) }));
  };
  const enUSD = f.monedaCosto === "USD";
  const { tc } = useTipoCambio();

  // Qué cambió respecto del origen (para marcarlo y poder restablecerlo).
  const modificado = (k: Comparable) => !!origen && k !== "codigo" && (f[k] ?? "") !== ((k === "codigoBarras" ? "" : origen[k]) ?? "");
  const restablecer = (k: Comparable) => {
    if (!origen) return;
    if (k === "costoUltimo") return setCosto(origen.costoUltimo);
    set(k, origen[k] as never);
  };
  const resaltar = (k: Comparable) => (modificado(k) ? "rounded-control ring-1 ring-accent/70" : camposSiempre.includes(k as CampoDuplicar) && !String(f[k] ?? "").replace(/^0$/, "") ? "rounded-control ring-1 ring-accent/40 bg-accent-soft/40" : "");
  const marca = (k: Comparable) =>
    modificado(k) ? (
      <span className="mt-1 flex items-center gap-2 text-[11px] text-accent">
        modificado
        <button type="button" className="text-muted underline-offset-2 hover:text-ink hover:underline" onClick={() => restablecer(k)}>Restablecer</button>
      </span>
    ) : null;
  const costoCambio = !!origen && Math.abs(f.costoUltimo - origen.costoUltimo) > 0.0001;

  const accionId = producto ? "editarArticulo" : origen ? "duplicarProducto" : "crearArticulo";
  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const yDuplicar = dupRef.current;
    dupRef.current = false;
    const err: Record<string, string> = {};
    if (!f.nombre.trim()) err.nombre = "Ingresá el nombre.";
    else if (!producto && nombreRepetidoEnRubro(f.nombre, f.rubroId, db.productos)) err.nombre = "Ya existe un artículo con ese nombre; cambiá el nombre o el diámetro/medida.";
    if (!f.codigo.trim()) err.codigo = "Ingresá el código.";
    else if (db.productos.some((p) => p.id !== producto?.id && p.codigo.toUpperCase() === f.codigo.trim().toUpperCase())) err.codigo = "Ese código ya existe.";
    if (f.codigoBarras && db.productos.some((p) => p.id !== producto?.id && p.codigoBarras === f.codigoBarras)) err.codigoBarras = "Ese código de barras ya es de otro artículo.";
    if (!f.rubroId) err.rubroId = "Elegí el rubro.";
    if (f.costoUltimo < 0) err.costoUltimo = "El costo no puede ser negativo.";
    if (enUSD && !((f.costoUSD ?? 0) > 0)) err.costoUSD = "Ingresá el costo en dólares.";
    setErrores(err);
    if (Object.keys(err).length) return;
    let r;
    if (origen) {
      const cambios = {
        codigo: f.codigo,
        nombre: f.nombre,
        rubroId: f.rubroId,
        descripcion: f.descripcion || undefined,
        marca: f.marca || undefined,
        unidad: f.unidad,
        unidadesPorPallet: f.unidadesPorPallet,
        proveedorHabitualId: f.proveedorHabitualId,
        codigoBarras: f.codigoBarras || undefined,
        pesoKg: f.pesoKg,
        monedaCosto: f.monedaCosto ?? "ARS",
        costoUSD: enUSD ? f.costoUSD : undefined,
        costoUltimo: f.costoUltimo,
        stockMinimo: f.stockMinimo,
        activo: f.activo,
        precios: verCostos || costoCambio || preciosTocados.size ? precios : undefined,
      };
      r = await medir(accionId, { productoIds: [origen.id] }, () => duplicar(origen.id, cambios));
    } else {
      // Con costo en USD, el costo en pesos lo calcula el servidor con su dólar vigente.
      const data = { ...f, monedaCosto: f.monedaCosto ?? "ARS", costoUSD: enUSD ? f.costoUSD : undefined, costoPromedio: producto ? f.costoPromedio : f.costoPromedio || f.costoUltimo, marca: f.marca || undefined, codigoBarras: f.codigoBarras || undefined };
      r = await medir(accionId, { productoIds: producto ? [producto.id] : [], proveedorId: f.proveedorHabitualId }, () => guardar(data, producto?.id));
    }
    if (r.ok) {
      if (!producto) recordar(f.rubroId, f.proveedorHabitualId);
      toast.success(producto ? "Producto actualizado" : origen ? `Artículo ${f.codigo.toUpperCase()} creado a partir de ${origen.codigo}` : `Producto ${f.codigo} creado`);
      if (yDuplicar && onGuardarYDuplicar) onGuardarYDuplicar(r.data);
      else onSaved(r.data);
    } else toast.error(r.error);
  };
  const guardarYDuplicar = () => {
    dupRef.current = true;
    void submit();
  };
  // Atajo: Ctrl/Cmd + Shift + Enter = "Guardar y duplicar".
  const alTeclear = (e: React.KeyboardEvent) => {
    if (!producto && onGuardarYDuplicar && e.key === "Enter" && e.shiftKey && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      guardarYDuplicar();
    }
  };

  const ro = !puedeEditar;
  return (
    <form onSubmit={submit} onKeyDown={alTeclear} className="space-y-4">
      {origen && (
        <div className="rounded-control border border-border bg-subtle px-3 py-2 text-[13px]">
          Duplicando desde{" "}
          <Link className="font-medium underline underline-offset-2" href={`/productos?id=${origen.id}`}>
            {origen.codigo} · {origen.nombre}
          </Link>
          . Cambiá lo que sea distinto y guardá.
        </div>
      )}
      {origen && verCostos && markupsSospechosos(markups).length > 0 && (
        <p className="rounded-control bg-warning-soft px-3 py-2 text-[13px] text-warning">
          Los precios del artículo original parecen mal cargados: son más de 10 veces su costo ({listas.filter((l) => markupsSospechosos(markups).includes(l.id)).map((l) => `${l.nombre} ${formatPercent((markups[l.id] ?? 0) / 100)}`).join(", ")}). Si cambiás el costo, el duplicado copia ese markup: revisá los precios abajo.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Rubro" required error={errores.rubroId}>
          <div className={resaltar("rubroId")}>
            <Select
              disabled={ro}
              value={f.rubroId}
              onValueChange={(v) => {
                set("rubroId", v);
                if (!producto) set("codigo", siguienteCodigoProducto(v, db.productos, db.rubros));
              }}
              options={db.rubros.map((r) => ({ value: r.id, label: r.nombre }))}
            />
          </div>
          {marca("rubroId")}
        </FormField>
        <FormField label="Código" required error={errores.codigo} hint={!producto ? "Autogenerado por rubro, editable." : undefined} htmlFor="p-codigo">
          <Input id="p-codigo" disabled={ro} value={f.codigo} onChange={(e) => set("codigo", e.target.value.toUpperCase())} aria-invalid={!!errores.codigo} />
        </FormField>
      </div>
      <FormField label="Nombre" required error={errores.nombre} htmlFor="p-nombre">
        <Input ref={nombreRef} id="p-nombre" disabled={ro} value={f.nombre} onChange={(e) => set("nombre", e.target.value)} aria-invalid={!!errores.nombre} placeholder="Ej. Cemento Portland normal 50 kg" className={resaltar("nombre")} />
        {marca("nombre")}
      </FormField>
      <FormField label="Descripción" htmlFor="p-desc">
        <Textarea id="p-desc" disabled={ro} value={f.descripcion ?? ""} onChange={(e) => set("descripcion", e.target.value)} rows={2} className={resaltar("descripcion")} />
        {marca("descripcion")}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Marca" htmlFor="p-marca">
          <Input id="p-marca" disabled={ro} value={f.marca ?? ""} onChange={(e) => set("marca", e.target.value)} className={resaltar("marca")} />
          {marca("marca")}
        </FormField>
        <FormField label="Unidad" required>
          <div className={resaltar("unidad")}>
            <Select disabled={ro} value={f.unidad} onValueChange={(v) => set("unidad", v as Unidad)} options={opciones(UNIDAD_LABEL)} />
          </div>
          {marca("unidad")}
        </FormField>
        <FormField label="Peso (kg por unidad)" htmlFor="p-peso" hint="Cambia entre medidas; carga de camiones">
          <NumberInput id="p-peso" disabled={ro} value={f.pesoKg ?? 0} min={0} onValueChange={(v) => set("pesoKg", v || undefined)} className={resaltar("pesoKg")} />
          {marca("pesoKg")}
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Proveedor habitual" className="sm:col-span-2">
          <div className={cn("flex items-center gap-1", resaltar("proveedorHabitualId"))}>
            <SelectorProveedor className="min-w-0 flex-1" disabled={ro} value={f.proveedorHabitualId ?? ""} placeholder="Sin proveedor habitual" onChange={(v) => set("proveedorHabitualId", v || undefined)} />
            {f.proveedorHabitualId && !ro && (
              <Button variant="ghost" size="icon-sm" aria-label="Quitar proveedor habitual" onClick={() => set("proveedorHabitualId", undefined)}>
                <X />
              </Button>
            )}
          </div>
          {marca("proveedorHabitualId")}
        </FormField>
        <FormField label="Unidades por pallet" htmlFor="p-pallet">
          <NumberInput id="p-pallet" disabled={ro} value={f.unidadesPorPallet ?? 0} min={0} onValueChange={(v) => set("unidadesPorPallet", v || undefined)} className={resaltar("unidadesPorPallet")} />
          {marca("unidadesPorPallet")}
        </FormField>
      </div>
      <FormField label="Código de barras" htmlFor="p-ean" error={errores.codigoBarras} hint={origen ? "No se copia: es único por artículo." : undefined}>
        <Input id="p-ean" disabled={ro} value={f.codigoBarras ?? ""} onChange={(e) => set("codigoBarras", e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
      </FormField>
      {verCostos && (
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Moneda del costo">
            <Select
              disabled={ro}
              value={f.monedaCosto ?? "ARS"}
              onValueChange={(v) => set("monedaCosto", v as "ARS" | "USD")}
              options={[
                { value: "ARS", label: "Pesos (ARS)" },
                { value: "USD", label: "Dólares (USD)" },
              ]}
            />
            <ImpactoCampo campo="producto.monedaCosto" />
          </FormField>
          {enUSD && (
            <FormField label="Costo USD" htmlFor="p-costo-usd" error={errores.costoUSD} hint="Sin IVA">
              <NumberInput id="p-costo-usd" disabled={ro} value={f.costoUSD ?? 0} min={0} onValueChange={(v) => set("costoUSD", v || undefined)} />
            </FormField>
          )}
          {enUSD && (
            <div className="self-end pb-2 text-[13px]">
              {tc?.valor ? (
                <>
                  <span className="tnum">
                    {formatUSD(f.costoUSD ?? 0)} → <span className="font-medium">{formatMoney((f.costoUSD ?? 0) * tc.valor, { decimals: false })}</span>
                  </span>
                  <span className="block text-[12px] text-muted">Dólar {formatMoney(tc.valor)} · se recalcula al guardar</span>
                </>
              ) : (
                <span className="text-muted">Sin tipo de cambio disponible</span>
              )}
            </div>
          )}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        {verCostos && (
          <FormField label="Costo último" htmlFor="p-costo" error={errores.costoUltimo} hint={producto ? `Actualizado ${formatDate(producto.fechaUltimoCosto)}` : "Sin IVA"}>
            <NumberInput id="p-costo" disabled={ro || enUSD} value={f.costoUltimo} min={0} onValueChange={setCosto} className={resaltar("costoUltimo")} />
            {enUSD ? <p className="mt-1 text-[12px] text-muted">En pesos: lo calcula el sistema desde el costo USD.</p> : <ImpactoCampo campo="producto.costo" />}
            {marca("costoUltimo")}
          </FormField>
        )}
        {verCostos && !origen && (
          <FormField label="Costo promedio" htmlFor="p-cprom" hint={producto ? "Se recalcula en cada recepción" : "Por defecto, igual al costo"}>
            <NumberInput id="p-cprom" disabled={ro || !!producto} value={f.costoPromedio} min={0} onValueChange={(v) => set("costoPromedio", v)} />
          </FormField>
        )}
        <FormField label="Stock mínimo" htmlFor="p-min" hint="Total entre depósitos">
          <NumberInput id="p-min" disabled={ro} value={f.stockMinimo} min={0} onValueChange={(v) => set("stockMinimo", v)} className={resaltar("stockMinimo")} />
          <ImpactoCampo campo="producto.stockMinimo" />
          {marca("stockMinimo")}
        </FormField>
      </div>
      {origen && (
        <div className="space-y-2 rounded-control border border-border p-3">
          <p className="text-[13px] font-medium">Precios</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {listas.map((l) => {
              const cambiado = Math.abs((precios[l.id] ?? 0) - (preciosOrigen[l.id] ?? 0)) > 0.004;
              return (
                <FormField key={l.id} label={`${l.nombre}${verCostos ? ` · ${formatPercent((markups[l.id] ?? 0) / 100)}` : ""}`} htmlFor={`p-pre-${l.id}`}>
                  <NumberInput
                    id={`p-pre-${l.id}`}
                    disabled={ro}
                    value={precios[l.id] ?? 0}
                    min={0}
                    onValueChange={(v) => {
                      setPrecios((ps) => ({ ...ps, [l.id]: v }));
                      setPreciosTocados((t) => new Set(t).add(l.id));
                    }}
                    className={cambiado ? "rounded-control ring-1 ring-accent/70" : camposSiempre.includes("precios") && !precios[l.id] ? "rounded-control ring-1 ring-accent/40 bg-accent-soft/40" : ""}
                  />
                  {cambiado && (
                    <span className="mt-1 flex items-center gap-2 text-[11px] text-accent">
                      modificado
                      <button
                        type="button"
                        className="text-muted underline-offset-2 hover:text-ink hover:underline"
                        onClick={() => {
                          setPrecios((ps) => ({ ...ps, [l.id]: preciosParaCosto(origen, db.precios, listas, f.costoUltimo)[l.id] }));
                          setPreciosTocados((t) => {
                            const n = new Set(t);
                            n.delete(l.id);
                            return n;
                          });
                        }}
                      >
                        Restablecer
                      </button>
                    </span>
                  )}
                </FormField>
              );
            })}
          </div>
          {costoCambio && verCostos && (
            <p className="text-[12px] text-muted">
              Precios recalculados con el markup del artículo original ({listas.map((l) => `${l.nombre} ${formatPercent((markups[l.id] ?? 0) / 100)}`).join(", ")}). Podés editar cada uno.
            </p>
          )}
        </div>
      )}
      <label className="flex items-center gap-3 text-[13px]">
        <Switch disabled={ro} checked={f.activo} onCheckedChange={(v) => set("activo", v)} />
        Producto activo (aparece en buscadores de venta y compra)
      </label>
      {origen && !ro && (
        <details className="rounded-control border border-border px-3 py-2 text-[13px]" open={camposSiempre.length > 0}>
          <summary className="cursor-pointer font-medium">Campos a cambiar siempre</summary>
          <p className="mt-1 text-[12px] text-muted">Los tildados quedan vacíos y resaltados cada vez que duplicás un artículo (se recuerda para tu usuario).</p>
          <div className="mt-2 flex flex-wrap gap-4">
            {CAMPOS_SIEMPRE.map((c) => (
              <label key={c.campo} className="flex items-center gap-2">
                <Checkbox checked={camposSiempre.includes(c.campo)} onCheckedChange={(v) => setCamposSiempre(v === true ? [...camposSiempre, c.campo] : camposSiempre.filter((x) => x !== c.campo))} />
                {c.label}
              </label>
            ))}
          </div>
        </details>
      )}
      {!ro && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
          {!producto && onGuardarYDuplicar && (
            <Button type="button" variant="secondary" onClick={guardarYDuplicar} title="Ctrl/Cmd + Shift + Enter">
              <Copy /> Guardar y duplicar
            </Button>
          )}
          <Button type="submit">
            <Save />
            {producto ? "Guardar cambios" : origen ? "Crear artículo" : "Crear producto"}
          </Button>
        </div>
      )}
      {!ro && <Impacto accion={accionId} />}
    </form>
  );
}

function TabPrecios({ producto }: { producto: Producto }) {
  const db = useDb();
  const actualizar = useStore((s) => s.actualizarPrecio);
  const puedeEditar = usePuede("precios.editar");
  const verCostos = usePuede("margenes.ver");
  const [editando, setEditando] = React.useState<Record<string, number>>({});
  const guardar = async (listaId: string, precio: number) => {
    const r = await medir("actualizarPrecio", { productoIds: [producto.id] }, () => actualizar(producto.id, listaId, precio));
    if (r.ok) toast.success("Precio actualizado");
    else toast.error(r.error);
  };
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full text-table">
          <thead className="bg-[#FAFAF8]">
            <tr className="text-[12px] text-muted">
              <th className="h-9 px-3 text-left font-medium">Lista</th>
              <th className="h-9 px-3 text-right font-medium">Precio (sin IVA)</th>
              {verCostos && <th className="h-9 px-3 text-right font-medium">Markup efectivo</th>}
              <th className="h-9 px-3 text-right font-medium">Actualizado</th>
            </tr>
          </thead>
          <tbody>
            {db.listasPrecios.map((l) => {
              const reg = db.precios.find((p) => p.productoId === producto.id && p.listaPreciosId === l.id);
              const precio = editando[l.id] ?? reg?.precio ?? 0;
              const mk = markupEfectivo(precio, producto.costoPromedio);
              return (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="font-medium">{l.nombre}</div>
                    <div className="text-[11px] text-muted">Markup por defecto {l.markupPorDefecto} %</div>
                  </td>
                  <td className="px-3 py-2">
                    {puedeEditar ? (
                      <NumberInput
                        aria-label={`Precio ${l.nombre}`}
                        value={precio}
                        min={0}
                        className="ml-auto h-8 w-36"
                        onValueChange={(v) => setEditando((e) => ({ ...e, [l.id]: v }))}
                        onBlur={() => {
                          if (editando[l.id] !== undefined && editando[l.id] !== reg?.precio) guardar(l.id, editando[l.id]);
                          setEditando((e) => {
                            const n = { ...e };
                            delete n[l.id];
                            return n;
                          });
                        }}
                      />
                    ) : (
                      <div className="text-right tnum">{formatMoney(precio)}</div>
                    )}
                  </td>
                  {verCostos && (
                    <td className={cn("px-3 py-2 text-right tnum", mk < l.markupPorDefecto - 3 ? "text-danger" : "text-ink")}>{formatPercent(mk, { base100: true })}</td>
                  )}
                  <td className="px-3 py-2 text-right text-muted">{formatDate(reg?.actualizadoEn)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {verCostos && <p className="text-[12px] text-muted">Costo promedio {formatMoney(producto.costoPromedio)} · costo último {formatMoney(producto.costoUltimo)} ({formatDate(producto.fechaUltimoCosto)}). En rojo: markup por debajo del de la lista.</p>}
      {puedeEditar && (
        <Button
          variant="secondary"
          onClick={async () => {
            await medir("actualizarPreciosMasivo", { productoIds: [producto.id], n: db.listasPrecios.length }, () => {
              for (const l of db.listasPrecios) actualizar(producto.id, l.id, calcularPrecioDesdeMarkup(producto.costoPromedio, l.markupPorDefecto));
            });
            toast.success("Precios recalculados desde costo promedio + markup de cada lista");
          }}
        >
          <Calculator />
          Recalcular desde markup
        </Button>
      )}
      {puedeEditar && <Impacto accion="actualizarPrecio" />}
    </div>
  );
}

function TabStock({ producto }: { producto: Producto }) {
  const db = useDb();
  const router = useRouter();
  const pos = usePosiciones().get(producto.id);
  const puedeTransferir = usePuede("stock.transferir");
  const puedeAjustar = usePuede("stock.ajustar");
  if (!pos) return null;
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full text-table">
          <thead className="bg-[#FAFAF8]">
            <tr className="text-[12px] text-muted">
              <th className="h-9 px-3 text-left font-medium">Depósito</th>
              <th className="h-9 px-3 text-right font-medium">Físico</th>
              <th className="h-9 px-3 text-right font-medium">Comprometido</th>
              <th className="h-9 px-3 text-right font-medium">Disponible</th>
              <th className="h-9 px-3 text-right font-medium">En tránsito</th>
            </tr>
          </thead>
          <tbody>
            {db.depositos.map((d) => {
              const x = pos.porDeposito[d.id];
              return (
                <tr key={d.id} className="h-10 border-t border-border">
                  <td className="px-3">{d.nombre}</td>
                  <td className="px-3 text-right tnum">{formatQty(x.fisico, producto.unidad)}</td>
                  <td className="px-3 text-right text-muted tnum">{formatQty(x.comprometido, producto.unidad)}</td>
                  <td className={cn("px-3 text-right font-medium tnum", x.disponible < 0 && "text-danger")}>{formatQty(x.disponible, producto.unidad)}</td>
                  <td className="px-3 text-right text-muted tnum">{formatQty(x.enTransito, producto.unidad)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="h-10 border-t border-border-strong bg-[#FAFAF8] font-semibold">
              <td className="px-3">Total</td>
              <td className="px-3 text-right tnum">{formatQty(pos.fisico, producto.unidad)}</td>
              <td className="px-3 text-right tnum">{formatQty(pos.comprometido, producto.unidad)}</td>
              <td className="px-3 text-right tnum">{formatQty(pos.disponible, producto.unidad)}</td>
              <td className="px-3 text-right tnum">{formatQty(pos.enTransito, producto.unidad)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-muted">Stock mínimo:</span>
        <span className="font-medium">{formatQty(producto.stockMinimo, producto.unidad)}</span>
        {pos.estado !== "OK" && <Badge variant="danger">Bajo mínimo</Badge>}
        {pos.enTransferencia > 0 && <Badge variant="warning">{formatQty(pos.enTransferencia, producto.unidad)} viajando entre depósitos</Badge>}
      </div>
      <div className="flex flex-wrap gap-2">
        {puedeTransferir && (
          <Button variant="secondary" onClick={() => router.push(`/stock/transferencias?nuevo=1&producto=${producto.id}`)}>
            <ArrowLeftRight />
            Transferir
          </Button>
        )}
        {puedeAjustar && (
          <Button variant="secondary" onClick={() => router.push(`/stock/ajustes?nuevo=1&producto=${producto.id}`)}>
            <SlidersHorizontal />
            Ajustar
          </Button>
        )}
      </div>
    </div>
  );
}

function TabMovimientos({ producto }: { producto: Producto }) {
  const db = useDb();
  const [dep, setDep] = React.useState("");
  const verCostos = usePuede("margenes.ver");
  const { movimientos } = useMovimientos({ productoId: producto.id, depositoId: dep || null });
  const movs = React.useMemo(() => {
    const lista = [...movimientos].sort((a, b) => a.fecha.localeCompare(b.fecha));
    let saldo = 0;
    return lista.map((m) => ({ m, saldo: (saldo += m.signo * m.cantidad) })).reverse();
  }, [movimientos]);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="w-56">
          <Select size="sm" aria-label="Depósito" value={dep} onValueChange={setDep} options={[{ value: "", label: "Todos los depósitos" }, ...db.depositos.map((d) => ({ value: d.id, label: d.nombre }))]} />
        </div>
        <span className="text-[12px] text-muted">{movs.length} movimientos</span>
      </div>
      <div className="max-h-[460px] overflow-auto rounded-card border border-border">
        <table className="w-full min-w-[620px] text-table">
          <thead className="sticky top-0 bg-[#FAFAF8]">
            <tr className="text-[12px] text-muted">
              <th className="h-9 px-3 text-left font-medium">Fecha</th>
              <th className="h-9 px-3 text-left font-medium">Tipo</th>
              <th className="h-9 px-3 text-left font-medium">Depósito</th>
              <th className="h-9 px-3 text-right font-medium">Cantidad</th>
              <th className="h-9 px-3 text-right font-medium">Saldo</th>
              {verCostos && <th className="h-9 px-3 text-right font-medium">Costo</th>}
              <th className="h-9 px-3 text-left font-medium">Referencia</th>
              <th className="h-9 px-3 text-left font-medium">Usuario</th>
            </tr>
          </thead>
          <tbody>
            {movs.map(({ m, saldo }) => {
              const ref = referenciaMovimiento(db, m);
              return (
                <tr key={m.id} className="h-9 border-t border-border">
                  <td className="whitespace-nowrap px-3 text-muted">{formatDateTime(m.fecha)}</td>
                  <td className="px-3"><StatusBadge tipo="MOVIMIENTO" estado={m.tipo} /></td>
                  <td className="whitespace-nowrap px-3 text-muted">{db.depositos.find((d) => d.id === m.depositoId)?.nombre.replace("Depósito ", "")}</td>
                  <td className={cn("px-3 text-right font-medium tnum", m.signo > 0 ? "text-success" : "text-danger")}>{m.signo > 0 ? "+" : "−"}{formatQty(m.cantidad, producto.unidad).split(" ")[0]}</td>
                  <td className="px-3 text-right tnum">{formatQty(saldo, producto.unidad).split(" ")[0]}</td>
                  {verCostos && <td className="px-3 text-right text-muted tnum">{formatMoney(m.costoUnitario)}</td>}
                  <td className="px-3"><Link href={ref.href} className="font-mono text-[12px] underline-offset-2 hover:underline">{ref.label}</Link></td>
                  <td className="whitespace-nowrap px-3 text-muted">{nombreUsuario(db, m.usuarioId)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!movs.length && <p className="py-10 text-center text-[13px] text-muted">Sin movimientos todavía. El stock de este artículo se mueve con ingresos de mercadería, remitos, transferencias y ajustes (por ejemplo, el inventario inicial).</p>}
      </div>
    </div>
  );
}

function TabCostos({ producto }: { producto: Producto }) {
  const db = useDb();
  const { movimientos } = useMovimientos({ productoId: producto.id, tipo: "INGRESO_COMPRA,AJUSTE_POSITIVO" });
  const serie = React.useMemo(
    () =>
      movimientos
        .filter((m) => m.tipo === "INGRESO_COMPRA" || (m.tipo === "AJUSTE_POSITIVO" && (m.observacion === "INVENTARIO_INICIAL" || m.referenciaId.startsWith("aju_apertura"))))
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .map((m) => ({ clave: m.fecha, valor: m.costoUnitario, ref: referenciaMovimiento(db, m).label })),
    [db, movimientos],
  );
  const primero = serie[0]?.valor ?? producto.costoUltimo;
  const variacion = primero ? (producto.costoUltimo - primero) / primero : 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-card border border-border p-3">
          <div className="text-[12px] text-muted">Costo último</div>
          <div className="text-[18px] font-semibold tnum">{formatMoney(producto.costoUltimo)}</div>
        </div>
        <div className="rounded-card border border-border p-3">
          <div className="text-[12px] text-muted">Costo promedio</div>
          <div className="text-[18px] font-semibold tnum">{formatMoney(producto.costoPromedio)}</div>
        </div>
        <div className="rounded-card border border-border p-3">
          <div className="text-[12px] text-muted">Variación en el período</div>
          <div className={cn("text-[18px] font-semibold tnum", variacion > 0 ? "text-danger" : "text-success")}>{formatPercent(variacion, { signo: true })}</div>
        </div>
      </div>
      {serie.length > 1 ? (
        <LineaChart data={serie} etiquetaX={(v) => formatDate(v, "dd/MM")} nombre="Costo unitario" />
      ) : (
        <p className="py-8 text-center text-[13px] text-muted">Todavía no hay suficientes recepciones para graficar.</p>
      )}
      <ul className="divide-y divide-border rounded-card border border-border text-[13px]">
        {[...serie].reverse().map((s, i) => (
          <li key={i} className="flex items-center justify-between px-3 py-2">
            <span className="text-muted">{formatDate(s.clave)} · {s.ref}</span>
            <span className="font-medium tnum">{formatMoney(s.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

