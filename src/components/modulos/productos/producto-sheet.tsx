"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftRight, Calculator, Save, SlidersHorizontal, X } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePosiciones, usePuede } from "@/store/selectors";
import type { Producto, Unidad } from "@/domain/types";
import { siguienteCodigoProducto } from "@/domain/productos";
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

/** Ficha de producto: datos, precios, stock, kardex e historial de costos. */
export function ProductoSheet({ productoId, nuevo, onClose }: { productoId?: string | null; nuevo?: boolean; onClose: () => void }) {
  const db = useDb();
  const producto = productoId ? db.productos.find((p) => p.id === productoId) : undefined;
  const open = !!producto || !!nuevo;
  const [tab, setTab] = React.useState("general");
  React.useEffect(() => setTab("general"), [productoId, nuevo]);
  const titulo = producto ? producto.nombre : "Nuevo producto";
  const pos = usePosiciones().get(producto?.id ?? "");
  const verCostos = usePuede("margenes.ver");

  const tabs = producto
    ? [
        { value: "general", label: "General", content: <TabGeneral producto={producto} onSaved={() => {}} /> },
        { value: "precios", label: "Precios", content: <TabPrecios producto={producto} /> },
        { value: "stock", label: "Stock", content: <TabStock producto={producto} /> },
        { value: "movimientos", label: "Movimientos", content: <TabMovimientos producto={producto} /> },
        ...(verCostos ? [{ value: "costos", label: "Historial de costos", content: <TabCostos producto={producto} /> }] : []),
      ]
    : [{ value: "general", label: "General", content: <TabGeneral onSaved={onClose} /> }];

  return (
    <EntitySheet
      open={open}
      onOpenChange={(v) => !v && onClose()}
      titulo={titulo}
      subtitulo={producto ? `${producto.codigo} · ${producto.marca ?? ""} · ${db.rubros.find((r) => r.id === producto.rubroId)?.nombre}` : "Completá los datos del producto"}
      estado={producto && pos ? <StatusBadge tipo="STOCK" estado={pos.estado} /> : undefined}
      tabs={tabs}
      tab={tab}
      onTabChange={setTab}
    />
  );
}

/** Formulario de datos generales del artículo (también alta rápida desde los buscadores). */
export function FormProducto({ producto, onSaved, unidadNegocioId }: { producto?: Producto; onSaved: (id: string) => void; unidadNegocioId?: string | null }) {
  return <TabGeneral producto={producto} onSaved={onSaved} unidadNegocioId={unidadNegocioId} />;
}

function TabGeneral({ producto, onSaved, unidadNegocioId }: { producto?: Producto; onSaved: (id: string) => void; unidadNegocioId?: string | null }) {
  const db = useDb();
  const guardar = useStore((s) => s.guardarProducto);
  const puedeEditar = usePuede("productos.editar");
  const verCostos = usePuede("margenes.ver");
  const rubroInicial = (unidadNegocioId ? db.rubros.find((r) => r.unidadNegocioId === unidadNegocioId) : undefined)?.id ?? db.rubros[0]?.id ?? "";
  const [f, setF] = React.useState<Form>(() => (producto ? { ...producto } : vacio(rubroInicial, siguienteCodigoProducto(rubroInicial, db.productos, db.rubros))));
  const [errores, setErrores] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    if (producto) setF({ ...producto });
  }, [producto]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const accionId = producto ? "editarArticulo" : "crearArticulo";
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!f.nombre.trim()) err.nombre = "Ingresá el nombre.";
    if (!f.codigo.trim()) err.codigo = "Ingresá el código.";
    if (!f.rubroId) err.rubroId = "Elegí el rubro.";
    if (f.costoUltimo < 0) err.costoUltimo = "El costo no puede ser negativo.";
    setErrores(err);
    if (Object.keys(err).length) return;
    const data = { ...f, costoPromedio: producto ? f.costoPromedio : f.costoPromedio || f.costoUltimo, marca: f.marca || undefined, codigoBarras: f.codigoBarras || undefined };
    const r = await medir(accionId, { productoIds: producto ? [producto.id] : [], proveedorId: f.proveedorHabitualId }, () => guardar(data, producto?.id));
    if (r.ok) {
      toast.success(producto ? "Producto actualizado" : `Producto ${f.codigo} creado`);
      onSaved(r.data);
    } else toast.error(r.error);
  };

  const ro = !puedeEditar;
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Rubro" required error={errores.rubroId}>
          <Select
            disabled={ro}
            value={f.rubroId}
            onValueChange={(v) => {
              set("rubroId", v);
              if (!producto) set("codigo", siguienteCodigoProducto(v, db.productos, db.rubros));
            }}
            options={db.rubros.map((r) => ({ value: r.id, label: r.nombre }))}
          />
        </FormField>
        <FormField label="Código" required error={errores.codigo} hint={!producto ? "Autogenerado por rubro, editable." : undefined} htmlFor="p-codigo">
          <Input id="p-codigo" disabled={ro} value={f.codigo} onChange={(e) => set("codigo", e.target.value.toUpperCase())} aria-invalid={!!errores.codigo} />
        </FormField>
      </div>
      <FormField label="Nombre" required error={errores.nombre} htmlFor="p-nombre">
        <Input id="p-nombre" disabled={ro} value={f.nombre} onChange={(e) => set("nombre", e.target.value)} aria-invalid={!!errores.nombre} placeholder="Ej. Cemento Portland normal 50 kg" />
      </FormField>
      <FormField label="Descripción" htmlFor="p-desc">
        <Textarea id="p-desc" disabled={ro} value={f.descripcion ?? ""} onChange={(e) => set("descripcion", e.target.value)} rows={2} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Marca" htmlFor="p-marca">
          <Input id="p-marca" disabled={ro} value={f.marca ?? ""} onChange={(e) => set("marca", e.target.value)} />
        </FormField>
        <FormField label="Unidad" required>
          <Select disabled={ro} value={f.unidad} onValueChange={(v) => set("unidad", v as Unidad)} options={opciones(UNIDAD_LABEL)} />
        </FormField>
        <FormField label="Unidades por pallet" htmlFor="p-pallet">
          <NumberInput id="p-pallet" disabled={ro} value={f.unidadesPorPallet ?? 0} min={0} onValueChange={(v) => set("unidadesPorPallet", v || undefined)} />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Proveedor habitual">
          <div className="flex items-center gap-1">
            <SelectorProveedor className="min-w-0 flex-1" disabled={ro} value={f.proveedorHabitualId ?? ""} placeholder="Sin proveedor habitual" onChange={(v) => set("proveedorHabitualId", v || undefined)} />
            {f.proveedorHabitualId && !ro && (
              <Button variant="ghost" size="icon-sm" aria-label="Quitar proveedor habitual" onClick={() => set("proveedorHabitualId", undefined)}>
                <X />
              </Button>
            )}
          </div>
        </FormField>
        <FormField label="Código de barras" htmlFor="p-ean">
          <Input id="p-ean" disabled={ro} value={f.codigoBarras ?? ""} onChange={(e) => set("codigoBarras", e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {verCostos && (
          <FormField label="Costo último" htmlFor="p-costo" error={errores.costoUltimo} hint={producto ? `Actualizado ${formatDate(producto.fechaUltimoCosto)}` : "Sin IVA"}>
            <NumberInput id="p-costo" disabled={ro} value={f.costoUltimo} min={0} onValueChange={(v) => set("costoUltimo", v)} />
            <ImpactoCampo campo="producto.costo" />
          </FormField>
        )}
        {verCostos && (
          <FormField label="Costo promedio" htmlFor="p-cprom" hint={producto ? "Se recalcula en cada recepción" : "Por defecto, igual al costo"}>
            <NumberInput id="p-cprom" disabled={ro || !!producto} value={f.costoPromedio} min={0} onValueChange={(v) => set("costoPromedio", v)} />
          </FormField>
        )}
        <FormField label="Stock mínimo" htmlFor="p-min" hint="Total entre depósitos">
          <NumberInput id="p-min" disabled={ro} value={f.stockMinimo} min={0} onValueChange={(v) => set("stockMinimo", v)} />
          <ImpactoCampo campo="producto.stockMinimo" />
        </FormField>
        <FormField label="Peso (kg por unidad)" htmlFor="p-peso" hint="Para calcular la carga de los camiones">
          <NumberInput id="p-peso" disabled={ro} value={f.pesoKg ?? 0} min={0} onValueChange={(v) => set("pesoKg", v || undefined)} />
        </FormField>
      </div>
      <label className="flex items-center gap-3 text-[13px]">
        <Switch disabled={ro} checked={f.activo} onCheckedChange={(v) => set("activo", v)} />
        Producto activo (aparece en buscadores de venta y compra)
      </label>
      {!ro && (
        <div className="flex justify-end border-t border-border pt-4">
          <Button type="submit">
            <Save />
            {producto ? "Guardar cambios" : "Crear producto"}
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
  const movs = React.useMemo(() => {
    const lista = db.movimientos.filter((m) => m.productoId === producto.id && (!dep || m.depositoId === dep)).sort((a, b) => a.fecha.localeCompare(b.fecha));
    let saldo = 0;
    return lista.map((m) => ({ m, saldo: (saldo += m.signo * m.cantidad) })).reverse();
  }, [db.movimientos, producto.id, dep]);
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
  const serie = React.useMemo(
    () =>
      db.movimientos
        .filter((m) => m.productoId === producto.id && (m.tipo === "INGRESO_COMPRA" || (m.tipo === "AJUSTE_POSITIVO" && m.referenciaId.startsWith("aju_apertura"))))
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .map((m) => ({ clave: m.fecha, valor: m.costoUnitario, ref: referenciaMovimiento(db, m).label })),
    [db, producto.id],
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

