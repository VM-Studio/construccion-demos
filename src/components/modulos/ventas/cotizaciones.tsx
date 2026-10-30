"use client";
/**
 * Cotizaciones de venta. Flujo pedido por los dueños:
 * - "Crear cotización" (cliente cargado) o "Crear cotización rápida" (solo nombre y teléfono).
 * - Mientras se arma: "Guardar borrador" o "Crear" (queda pendiente).
 * - En la fila: descargar PDF, ✓ aceptar (se convierte en venta en un paso), ✗ anular, ver.
 * - Aceptadas pasan a Notas de pedido / ficha del cliente; anuladas a Ventas anuladas.
 */
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Calculator, Check, Download, Eye, FileText, Plus, Save, Trash2, X, Zap } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePuede, useSucursalActiva, useUnidadNegocio, useUsuario, useVeCircuito2 } from "@/store/selectors";
import type { Circuito, CondicionIVA, Cotizacion, EstadoInicial, ItemVenta, Moneda, Producto } from "@/domain/types";
import { precioLista } from "@/domain/precios";
import { calcularTotales } from "@/domain/ventas";
import { puede } from "@/domain/permisos";
import { barrasPorTonelada, BARRAS_POR_TONELADA, diametroDe, esBarraDeHierro } from "@/domain/unidades";
import { CONDICION_IVA_LABEL, nombreTipoCliente, opciones, opcionesTipoCliente } from "@/domain/estados";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { CircuitoBadge } from "@/components/shared/circuito-badge";
import { SelectorCliente } from "@/components/shared/alta-rapida";
import { ObraSelect } from "@/components/shared/obra-select";
import { ItemsGrid, type LineaBase } from "@/components/shared/items-grid";
import { PrintLayout, PrintPreview, PrintTable } from "@/components/shared/print-layout";
import { MediosEditor, mediosParaEnviar, nuevoMedio, pesosDe, type FilaMedio } from "@/components/shared/medios-editor";
import { ComprobanteDocumento, ReciboDocumento } from "@/components/modulos/cuentas/documentos";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NumberInput, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { presentarLinea } from "@/lib/lineas";
import { cn, newId } from "@/lib/utils";
import { obtenerDb } from "@/lib/datos/almacen";
import { aDolares, formatUSD, textoTipoCambioAplicado, useTipoCambio } from "@/lib/tipo-cambio";

type Db = EstadoInicial;

/** Nombre a mostrar: cliente o interesado de una cotización rápida. */
export const nombreCotizacion = (c: Cotizacion, db: Db) => {
  const cli = c.clienteId ? db.clientes.find((x) => x.id === c.clienteId) : undefined;
  return cli ? (cli.nombreFantasia ?? cli.razonSocial) : (c.prospectoNombre ?? "—");
};
const venceEl = (c: Cotizacion) => new Date(Date.parse(c.fecha) + c.validezDias * 86_400_000);
const listaSugerida = (tipo: string | undefined, db: Db) => {
  const ids = new Set(db.listasPrecios.filter((l) => l.activa && !l.clienteId).map((l) => l.id));
  const pref = tipo === "CONSUMIDOR_FINAL" || tipo === "PARTICULAR" ? "lst_pub" : tipo === "MAYORISTA" || tipo === "CONSTRUCTORA" ? "lst_may" : "lst_gen";
  return ids.has(pref) ? pref : ([...ids][0] ?? "lst_gen");
};

// ───────────────────────── PDF ─────────────────────────

export async function descargarPdfCotizacion(cot: Cotizacion, db: Db) {
  const { generarPdfDocumento, descargarBlob } = await import("@/lib/pdf/documento");
  const cli = cot.clienteId ? db.clientes.find((c) => c.id === cot.clienteId) : undefined;
  const usd = cot.moneda === "USD" && !!cot.tipoCambioAplicado;
  const m = (n: number) => (usd ? formatUSD(aDolares(n, cot.tipoCambioAplicado)) : formatMoney(n));
  const neto = cot.subtotal * (1 - cot.descuentoPct / 100);
  const blob = generarPdfDocumento({
    empresa: db.config.empresa,
    titulo: "Cotización",
    numero: cot.numero,
    fecha: formatDate(cot.fecha),
    extras: [`Válida hasta el ${formatDate(venceEl(cot))}`],
    destinatario: {
      titulo: "Cliente",
      lineas: cli
        ? [cli.razonSocial, [cli.cuit ? `CUIT ${cli.cuit}` : "", CONDICION_IVA_LABEL[cli.condicionIVA]].filter(Boolean).join(" · "), [cli.direccion, cli.localidad].filter(Boolean).join(", "), [cli.telefono, cli.email].filter(Boolean).join(" · ")].filter(Boolean)
        : [cot.prospectoNombre ?? "", cot.prospectoTelefono ? `Tel. ${cot.prospectoTelefono}` : ""].filter(Boolean),
    },
    columnas: [{ titulo: "Código", ancho: 20 }, { titulo: "Artículo" }, { titulo: "Cantidad", ancho: 24, derecha: true }, { titulo: "Precio unit.", ancho: 28, derecha: true }, { titulo: "Desc.", ancho: 14, derecha: true }, { titulo: "Subtotal", ancho: 30, derecha: true }],
    filas: cot.items.map((i) => {
      const p = db.productos.find((x) => x.id === i.productoId);
      const l = presentarLinea(i, p);
      return [p?.codigo ?? "", p?.nombre ?? "", l.texto, m(l.precio), i.descuentoPct ? `${formatNumber(i.descuentoPct, 1)} %` : "", m(i.cantidad * i.precioUnitario * (1 - i.descuentoPct / 100))];
    }),
    totales: [
      { etiqueta: "Subtotal", valor: m(cot.subtotal) },
      ...(cot.descuentoPct ? [{ etiqueta: `Descuento ${cot.descuentoPct} %`, valor: `− ${m(cot.subtotal - neto)}` }] : []),
      ...(cot.iva ? [{ etiqueta: `IVA ${db.config.ivaPct} %`, valor: m(cot.iva) }] : []),
      { etiqueta: "TOTAL", valor: m(cot.total), destacado: true },
    ],
    observaciones: [cot.observaciones, usd ? `Equivalente en pesos ${formatMoney(cot.total)} · ${textoTipoCambioAplicado(cot.tipoCambioAplicado!, cot.tipoCambioFecha)}` : ""].filter(Boolean).join("\n") || undefined,
    pie: "Precios sujetos a disponibilidad de stock y a modificación sin previo aviso vencida la validez.",
  });
  descargarBlob(blob, `Cotizacion ${cot.numero.replace(/\s+/g, "-")}.pdf`);
}

/** Vista previa de la cotización (lo mismo que se manda al cliente). */
export function CotizacionDocumento({ cot }: { cot: Cotizacion }) {
  const db = useDb();
  const c = cot.clienteId ? db.clientes.find((x) => x.id === cot.clienteId) : undefined;
  const tc = cot.tipoCambioAplicado;
  const usd = cot.moneda === "USD" && !!tc;
  const m = (n: number) => (usd ? formatUSD(aDolares(n, tc)) : formatMoney(n));
  return (
    <PrintLayout
      titulo="Cotización"
      numero={cot.numero}
      fecha={formatDate(cot.fecha)}
      leyenda={`Válida hasta el ${formatDate(venceEl(cot))}`}
      subtitulo={
        <div className="text-[11px]">
          <div className="text-[10px] font-semibold uppercase text-muted">Cliente</div>
          {c ? (
            <>
              <div className="font-semibold">{c.razonSocial}</div>
              <div>{[c.cuit ? `CUIT ${c.cuit}` : "", CONDICION_IVA_LABEL[c.condicionIVA]].filter(Boolean).join(" · ")}</div>
              <div>{[c.direccion, c.localidad].filter(Boolean).join(", ")}</div>
            </>
          ) : (
            <>
              <div className="font-semibold">{cot.prospectoNombre}</div>
              {cot.prospectoTelefono && <div>Tel. {cot.prospectoTelefono}</div>}
            </>
          )}
        </div>
      }
      pie="Precios sujetos a disponibilidad de stock."
    >
      <PrintTable
        head={["Código", "Artículo", "Cantidad", "Precio", "Desc.", "Subtotal"]}
        rows={cot.items.map((i) => {
          const p = db.productos.find((x) => x.id === i.productoId);
          const l = presentarLinea(i, p);
          return [p?.codigo, p?.nombre, l.texto, m(l.precio), i.descuentoPct ? `${i.descuentoPct} %` : "", m(i.cantidad * i.precioUnitario * (1 - i.descuentoPct / 100))];
        })}
      />
      <dl className="ml-auto mt-3 grid w-64 grid-cols-[1fr_auto] gap-y-1 text-[11px]">
        <dt>Subtotal</dt>
        <dd className="text-right tnum">{m(cot.subtotal)}</dd>
        {cot.descuentoPct > 0 && (
          <>
            <dt>Descuento {cot.descuentoPct} %</dt>
            <dd className="text-right tnum">− {m(cot.subtotal * (cot.descuentoPct / 100))}</dd>
          </>
        )}
        {cot.iva > 0 && (
          <>
            <dt>IVA</dt>
            <dd className="text-right tnum">{m(cot.iva)}</dd>
          </>
        )}
        <dt className="border-t border-ink pt-1 font-semibold">Total</dt>
        <dd className="border-t border-ink pt-1 text-right font-semibold tnum">{m(cot.total)}</dd>
      </dl>
      {cot.observaciones && <p className="mt-4 whitespace-pre-line text-[11px]"><b>Observaciones:</b> {cot.observaciones}</p>}
    </PrintLayout>
  );
}

// ───────────────────────── Listado ─────────────────────────

export function CotizacionesView() {
  const db = useDb();
  const params = useSearchParams();
  const veC2 = useVeCircuito2();
  const sucursal = useSucursalActiva();
  const puede = usePuede("ventas.editar");
  const puedeAceptar = usePuede("ventas.confirmar");
  const [editar, setEditar] = React.useState<{ cot?: Cotizacion; rapida?: boolean } | null>(params.get("nuevo") === "1" ? {} : null);
  const [vista, setVista] = React.useState<"PENDIENTES" | "BORRADORES">("PENDIENTES");
  const [aceptar, setAceptar] = React.useState<Cotizacion | null>(null);
  const [anular, setAnular] = React.useState<Cotizacion | null>(null);
  const [ver, setVer] = React.useState<Cotizacion | null>(null);
  const visibles = db.cotizaciones.filter((c) => (veC2 || c.circuito !== 2) && (!sucursal || c.sucursalId === sucursal));
  const pendientes = visibles.filter((c) => c.estado === "PENDIENTE" || c.estado === "ENVIADA");
  const borradores = visibles.filter((c) => c.estado === "BORRADOR");
  const filas = vista === "PENDIENTES" ? pendientes : borradores;
  const icono = (titulo: string, onClick: () => void, el: React.ReactNode, clase?: string) => (
    <Tooltip content={titulo}>
      <Button size="icon-sm" variant="ghost" aria-label={titulo} className={clase} onClick={(e) => { e.stopPropagation(); onClick(); }}>{el}</Button>
    </Tooltip>
  );
  const columnas: Column<Cotizacion>[] = [
    { key: "n", header: "Número", sortable: true, sortValue: (c) => c.numero, cell: (c) => <span className="whitespace-nowrap font-mono text-[12px]">{c.numero}</span> },
    { key: "f", header: "Fecha", sortable: true, sortValue: (c) => c.fecha, cell: (c) => <span className="text-muted">{formatDate(c.fecha)}</span> },
    {
      key: "c",
      header: "Cliente",
      sortable: true,
      sortValue: (c) => nombreCotizacion(c, db),
      cell: (c) => (
        <span className="block min-w-[160px]">
          {nombreCotizacion(c, db)}
          {!c.clienteId && (
            <span className="ml-2 inline-flex items-center gap-1 align-middle">
              <Badge variant="accent">Rápida</Badge>
              {c.prospectoTelefono && <span className="text-[11px] text-muted">{c.prospectoTelefono}</span>}
            </span>
          )}
        </span>
      ),
    },
    { key: "ci", header: "Circuito", cell: (c) => <CircuitoBadge circuito={c.circuito} corto />, hideOnMobile: true },
    {
      key: "t",
      header: "Total",
      align: "right",
      sortable: true,
      sortValue: (c) => c.total,
      cell: (c) => (
        <span className="tnum">
          {formatMoney(c.total, { decimals: false })}
          {c.moneda === "USD" && c.tipoCambioAplicado ? <span className="block text-[11px] text-muted">{formatUSD(aDolares(c.total, c.tipoCambioAplicado))}</span> : null}
        </span>
      ),
    },
    { key: "v", header: "Vence", cell: (c) => <span className={cn("whitespace-nowrap", venceEl(c).getTime() < Date.now() ? "text-danger" : "text-muted")}>{formatDate(venceEl(c))}</span>, hideOnMobile: true },
    { key: "e", header: "Estado", cell: (c) => <StatusBadge tipo="COTIZACION" estado={c.estado} /> },
    {
      key: "acc",
      header: "",
      align: "right",
      cell: (c) => (
        <div className="flex items-center justify-end gap-0.5">
          {icono("Descargar PDF", () => void descargarPdfCotizacion(c, db), <Download />)}
          {icono("Ver", () => setVer(c), <Eye />)}
          {c.estado === "BORRADOR"
            ? puede && icono("Eliminar borrador", () => setAnular(c), <Trash2 />, "text-danger")
            : (
              <>
                {puedeAceptar && icono("Aceptar: pasa a venta", () => setAceptar(c), <Check />, "text-success")}
                {puede && icono("Anular cotización", () => setAnular(c), <X />, "text-danger")}
              </>
            )}
        </div>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        titulo="Cotizaciones de venta"
        acciones={
          puede && (
            <>
              <Button variant="secondary" onClick={() => setEditar({ rapida: true })}><Zap /> Crear cotización rápida</Button>
              <Button onClick={() => setEditar({})}><Plus /> Crear cotización</Button>
            </>
          )
        }
      />
      <DataTable
        rows={filas}
        columns={columnas}
        getRowId={(c) => c.id}
        onRowClick={(c) => setEditar({ cot: c })}
        searchText={(c) => `${c.numero} ${nombreCotizacion(c, db)} ${c.prospectoTelefono ?? ""}`}
        initialSort={{ key: "f", dir: "desc" }}
        empty={
          vista === "PENDIENTES" ? (
            <EmptyState icono={FileText} titulo="No hay cotizaciones pendientes" accion={puede ? <Button size="sm" onClick={() => setEditar({})}><Plus /> Crear cotización</Button> : undefined} />
          ) : (
            { icono: FileText, titulo: "No hay borradores" }
          )
        }
        filters={
          <>
            <Segmented value={vista} onChange={setVista} options={[{ value: "PENDIENTES", label: `Pendientes (${pendientes.length})` }, { value: "BORRADORES", label: `Borradores (${borradores.length})` }]} />
            <Link href="/ventas/anuladas" className="ml-1 self-center text-[12px] text-muted underline-offset-2 hover:underline">Ver anuladas</Link>
          </>
        }
      />
      {editar && <CotizacionDialog cot={editar.cot} rapida={editar.rapida} clienteInicial={params.get("cliente") ?? undefined} onClose={() => setEditar(null)} onAceptar={(c) => { setEditar(null); setAceptar(c); }} />}
      {aceptar && <AceptarCotizacionDialog cot={aceptar} onClose={() => setAceptar(null)} />}
      {anular && <AnularCotizacionDialog cot={anular} onClose={() => setAnular(null)} />}
      {ver && (
        <PrintPreview open onOpenChange={(v) => !v && setVer(null)} titulo={`Cotización ${ver.numero}`} acciones={<Button variant="secondary" onClick={() => void descargarPdfCotizacion(ver, db)}><Download /> Descargar PDF</Button>}>
          <CotizacionDocumento cot={ver} />
        </PrintPreview>
      )}
    </>
  );
}

function AnularCotizacionDialog({ cot, onClose }: { cot: Cotizacion; onClose: () => void }) {
  const db = useDb();
  const [motivo, setMotivo] = React.useState("");
  const [cargando, setCargando] = React.useState(false);
  const borrador = cot.estado === "BORRADOR";
  const confirmar = async () => {
    setCargando(true);
    const r = borrador ? await useStore.getState().eliminarCotizacion(cot.id) : await useStore.getState().rechazarCotizacion(cot.id, motivo || undefined);
    setCargando(false);
    if (!r.ok) return toast.error(r.error);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        size="sm"
        title={borrador ? "¿Eliminar este borrador?" : "¿Estás seguro que querés anular esta cotización?"}
        description={`${cot.numero} · ${nombreCotizacion(cot, db)} · ${formatMoney(cot.total)}`}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>Volver</Button>
            <Button variant="danger" loading={cargando} onClick={confirmar}>{borrador ? "Eliminar" : "Sí, anular"}</Button>
          </>
        }
      >
        {!borrador && (
          <FormField label="Motivo (opcional)" htmlFor="anu-m">
            <Input id="anu-m" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. compró en otro lado" />
          </FormField>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────── Alta / edición ─────────────────────────

interface LineaCot extends LineaBase {
  obraId?: string;
}

function CotizacionDialog({ cot, rapida: rapidaInicial, clienteInicial, onClose, onAceptar }: { cot?: Cotizacion; rapida?: boolean; clienteInicial?: string; onClose: () => void; onAceptar: (c: Cotizacion) => void }) {
  const db = useDb();
  const usuario = useUsuario();
  const unActiva = useUnidadNegocio();
  const rapida = cot ? !cot.clienteId : !!rapidaInicial;
  const [clienteId, setClienteId] = React.useState(cot?.clienteId ?? (rapida ? "" : (clienteInicial ?? "")));
  const cliente = db.clientes.find((c) => c.id === clienteId);
  const [prospecto, setProspecto] = React.useState({ nombre: cot?.prospectoNombre ?? "", telefono: cot?.prospectoTelefono ?? "", tipo: cot?.tipoCliente ?? "CONSUMIDOR_FINAL" });
  const [listaRapida, setListaRapida] = React.useState(() => listaSugerida(cot?.tipoCliente ?? "CONSUMIDOR_FINAL", db));
  const [obraId, setObraId] = React.useState(cot?.obraId ?? "");
  const [circuito, setCircuito] = React.useState<Circuito>(cot?.circuito ?? cliente?.circuitoHabitual ?? 1);
  const [validez, setValidez] = React.useState(cot?.validezDias ?? db.config.validezPresupuestoDias);
  const [descuento, setDescuento] = React.useState(cot?.descuentoPct ?? 0);
  const [obs, setObs] = React.useState(cot?.observaciones ?? "");
  const [items, setItems] = React.useState<LineaCot[]>(cot?.items.map((i) => ({ id: i.id, productoId: i.productoId, obraId: i.obraId, cantidad: i.cantidad, precio: i.precioUnitario, descuentoPct: i.descuentoPct, unidadVenta: i.unidadVenta })) ?? []);
  const [moneda, setMoneda] = React.useState<Moneda>(cot?.moneda ?? "ARS");
  const [calc, setCalc] = React.useState(false);
  const [guardando, setGuardando] = React.useState<"BORRADOR" | "PENDIENTE" | null>(null);
  const { valor: dolar } = useTipoCambio();
  const enUSD = !!cliente?.facturaEnUSD && moneda === "USD";
  const editable = !cot || cot.estado === "BORRADOR" || cot.estado === "ENVIADA" || cot.estado === "PENDIENTE";
  const lista = rapida ? listaRapida : (cliente?.listaPreciosId ?? "lst_gen");
  const precioDe = (pid: string, l = lista) => precioLista(pid, l, obtenerDb());
  const sucursalId = cliente?.sucursalPreferidaId ?? usuario?.sucursalId ?? db.sucursales[0]?.id ?? "suc_central";

  const repreciar = (l: string) => setItems((its) => its.map((i) => ({ ...i, precio: precioDe(i.productoId, l) })));
  const elegirCliente = (v: string) => {
    setClienteId(v);
    const c = obtenerDb().clientes.find((x) => x.id === v);
    setCircuito(c?.circuitoHabitual ?? 1);
    setObraId("");
    repreciar(c?.listaPreciosId ?? "lst_gen");
  };
  const guardar = async (estado: "BORRADOR" | "PENDIENTE") => {
    if (rapida && !prospecto.nombre.trim()) return toast.error("Cargá el nombre de quien consulta.");
    if (!rapida && !clienteId) return toast.error("Elegí un cliente.");
    if (!items.length) return toast.error("Agregá al menos un artículo.");
    setGuardando(estado);
    const its: ItemVenta[] = items.map((i) => ({ id: i.id, productoId: i.productoId, obraId: i.obraId ?? (obraId || undefined), cantidad: i.cantidad, precioUnitario: i.precio ?? 0, costoUnitarioSnapshot: 0, descuentoPct: i.descuentoPct ?? 0, unidadVenta: i.unidadVenta }));
    const r = await useStore.getState().guardarCotizacion(
      {
        ...(rapida ? { prospectoNombre: prospecto.nombre.trim(), prospectoTelefono: prospecto.telefono.trim() || undefined, tipoCliente: prospecto.tipo } : { clienteId, obraId: obraId || undefined }),
        sucursalId,
        circuito,
        fecha: cot?.fecha ?? new Date().toISOString(),
        validezDias: validez,
        items: its,
        descuentoPct: descuento,
        observaciones: obs.trim() || undefined,
        moneda: enUSD ? "USD" : "ARS",
        estado,
      },
      cot?.id,
    );
    setGuardando(null);
    if (!r.ok) return toast.error(r.error);
    onClose();
  };
  const agregarDeCalculadora = (lineas: { productoId: string; barras: number }[]) => {
    setItems((its) => {
      const out = [...its];
      for (const l of lineas) {
        const ex = out.find((i) => i.productoId === l.productoId);
        if (ex) ex.cantidad = l.barras;
        else out.push({ id: newId("l"), productoId: l.productoId, obraId: obraId || undefined, cantidad: l.barras, precio: precioDe(l.productoId), descuentoPct: 0 });
      }
      return out.map((x) => ({ ...x }));
    });
    setCalc(false);
  };
  const hayHierros = db.productos.some((p) => p.activo && esBarraDeHierro(p, db.rubros));
  const actual = cot ? db.cotizaciones.find((c) => c.id === cot.id) : undefined;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        size="xl"
        title={cot ? `Cotización ${cot.numero}${rapida ? " · rápida" : ""}` : rapida ? "Cotización rápida" : "Nueva cotización"}
        description={cot ? `${nombreCotizacion(cot, db)} · ${formatDate(cot.fecha)}` : undefined}
        footer={
          editable ? (
            <>
              <Button variant="secondary" onClick={onClose}>Cancelar</Button>
              {(!cot || cot.estado === "BORRADOR") && <Button variant="secondary" loading={guardando === "BORRADOR"} onClick={() => guardar("BORRADOR")}><Save /> Guardar borrador</Button>}
              {actual && actual.estado !== "BORRADOR" && puede(usuario, "ventas.confirmar") && <Button variant="secondary" onClick={() => onAceptar(actual)}><Check /> Aceptar</Button>}
              <Button loading={guardando === "PENDIENTE"} onClick={() => guardar("PENDIENTE")}>{cot && cot.estado !== "BORRADOR" ? "Guardar cambios" : "Crear"}</Button>
            </>
          ) : (
            <Button variant="secondary" onClick={onClose}>Cerrar</Button>
          )
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            {rapida ? (
              <>
                <FormField label="Nombre" required className="sm:col-span-2" htmlFor="cr-n">
                  <Input id="cr-n" autoFocus disabled={!editable} value={prospecto.nombre} onChange={(e) => setProspecto({ ...prospecto, nombre: e.target.value })} placeholder="Nombre de quien consulta" />
                </FormField>
                <FormField label="Teléfono" htmlFor="cr-t">
                  <Input id="cr-t" disabled={!editable} value={prospecto.telefono} onChange={(e) => setProspecto({ ...prospecto, telefono: e.target.value })} inputMode="tel" />
                </FormField>
                <FormField label="Tipo de cliente">
                  <Select
                    disabled={!editable}
                    value={prospecto.tipo}
                    onValueChange={(v) => {
                      setProspecto({ ...prospecto, tipo: v });
                      const l = listaSugerida(v, db);
                      setListaRapida(l);
                      repreciar(l);
                    }}
                    options={opcionesTipoCliente(db.config.tiposCliente, prospecto.tipo)}
                  />
                </FormField>
                <FormField label="Lista de precios">
                  <Select disabled={!editable} value={listaRapida} onValueChange={(v) => { setListaRapida(v); repreciar(v); }} options={db.listasPrecios.filter((l) => l.activa && !l.clienteId).map((l) => ({ value: l.id, label: l.nombre }))} />
                </FormField>
              </>
            ) : (
              <>
                <FormField label="Cliente" required className="sm:col-span-2">
                  <SelectorCliente value={clienteId} disabled={!editable} onChange={elegirCliente} />
                </FormField>
                <FormField label="Obra">
                  <ObraSelect clienteId={clienteId} value={obraId} onChange={setObraId} />
                </FormField>
              </>
            )}
            <FormField label="Validez (días)" htmlFor="cot-v">
              <Input id="cot-v" type="number" min={1} value={validez} disabled={!editable} onChange={(e) => setValidez(Math.max(1, Number(e.target.value) || 1))} />
            </FormField>
            <FormField label="Circuito" className="sm:col-span-2">
              <Segmented value={String(circuito) as "1" | "2"} onChange={(v) => setCircuito(Number(v) as Circuito)} options={[{ value: "1", label: "AC1 · Fiscal (con IVA)" }, { value: "2", label: "AC2 · Interno" }]} />
            </FormField>
            {cliente?.facturaEnUSD && (
              <FormField label="Moneda" className="sm:col-span-2">
                <label className="flex h-9 items-center gap-3 text-[13px]">
                  <Switch checked={enUSD} disabled={!editable} onCheckedChange={(v) => setMoneda(v ? "USD" : "ARS")} /> Precios en USD
                  {enUSD && <span className="text-muted">{dolar ? `Dólar de hoy ${formatMoney(dolar)}` : "Sin tipo de cambio disponible"}</span>}
                </label>
              </FormField>
            )}
          </div>
          {editable && hayHierros && (
            <div>
              <Button size="sm" variant={calc ? "primary" : "secondary"} onClick={() => setCalc(!calc)}>
                <Calculator /> Calculadora de hierros
              </Button>
              {calc && <CalculadoraHierros unidadNegocioId={unActiva} onAgregar={agregarDeCalculadora} />}
            </div>
          )}
          <ItemsGrid<LineaCot>
            items={items}
            onChange={setItems}
            readOnly={!editable}
            crearItem={(p: Producto) => ({ id: newId("l"), productoId: p.id, obraId: obraId || undefined, cantidad: 1, precio: precioDe(p.id), descuentoPct: 0 })}
            listaId={lista}
            precioDe={(p) => precioDe(p.id)}
            depositoId={db.sucursales.find((s) => s.id === sucursalId)?.depositoId}
            totales={{ descuentoPct: descuento, ivaPct: circuito === 1 ? db.config.ivaPct : 0, onDescuentoChange: setDescuento }}
          />
          {enUSD && (() => {
            const t = calcularTotales(items.map((i) => ({ cantidad: i.cantidad, precioUnitario: i.precio ?? 0, descuentoPct: i.descuentoPct })), descuento, circuito === 1 ? db.config.ivaPct : 0);
            return <p className="text-right text-[13px] text-muted">Total en USD <span className="font-medium text-ink tnum">{formatUSD(aDolares(t.total, actual?.tipoCambioAplicado ?? dolar))}</span></p>;
          })()}
          <FormField label="Observaciones (opcional)" htmlFor="cot-obs">
            <Textarea id="cot-obs" rows={2} disabled={!editable} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Condiciones, plazo de entrega, forma de pago…" />
          </FormField>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────── Calculadora de hierros ─────────────────────────

interface FilaCalc {
  productoId?: string;
  diametro: number;
  nombre: string;
  bpt: number;
  barras: number;
}

/**
 * Calculadora de hierros (la planilla "CALCULADORA HIERROS"): barras ↔ toneladas por diámetro.
 * Es un paso de cálculo interno: no se guarda en la cotización ni se imprime.
 */
export function CalculadoraHierros({ unidadNegocioId, onAgregar }: { unidadNegocioId?: string | null; onAgregar?: (l: { productoId: string; barras: number }[]) => void }) {
  const db = useDb();
  const [filas, setFilas] = React.useState<FilaCalc[]>(() => {
    const prods = db.productos.filter((p) => p.activo && esBarraDeHierro(p, db.rubros) && (!unidadNegocioId || p.unidadNegocioId === unidadNegocioId) && !/DULCE/i.test(p.nombre));
    const desdeProductos = prods
      .map((p) => ({ productoId: p.id, diametro: diametroDe(p.nombre) ?? 0, nombre: p.nombre, bpt: barrasPorTonelada(p) ?? 0, barras: 0 }))
      .filter((f) => f.bpt > 0)
      .sort((a, b) => a.diametro - b.diametro);
    const usados = new Set(desdeProductos.map((f) => f.diametro));
    const sinArticulo = BARRAS_POR_TONELADA.filter((x) => !usados.has(x.diametro)).map((x) => ({ diametro: x.diametro, nombre: `Hierro ${formatNumber(x.diametro, x.diametro % 1 ? 1 : 0)} mm`, bpt: x.barras, barras: 0 }));
    return [...desdeProductos, ...sinArticulo].sort((a, b) => a.diametro - b.diametro);
  });
  const up = (i: number, patch: Partial<FilaCalc>) => setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const tn = (f: FilaCalc) => (f.bpt ? f.barras / f.bpt : 0);
  const totBarras = filas.reduce((a, f) => a + f.barras, 0);
  const totTn = filas.reduce((a, f) => a + tn(f), 0);
  const conArticulo = filas.filter((f) => f.productoId && f.barras > 0);
  return (
    <div className="mt-2 rounded-card border border-border bg-[#FAFAF8] p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h4 className="text-[13px] font-semibold">Calculadora de hierros</h4>
        <span className="text-[11px] text-muted">Solo para calcular: no se guarda ni sale en la cotización</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-table">
          <thead className="text-[12px] text-muted">
            <tr>
              <th className="h-8 px-2 text-left font-medium">Hierro</th>
              <th className="h-8 w-[120px] px-2 text-right font-medium">Barras por TN</th>
              <th className="h-8 w-[120px] px-2 text-right font-medium">Barras</th>
              <th className="h-8 w-[130px] px-2 text-right font-medium">Toneladas</th>
              <th className="h-8 w-[90px] px-2 text-right font-medium">Kilos</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={`${f.productoId ?? ""}${f.diametro}`} className="border-t border-border">
                <td className="px-2 py-1"><span className="font-medium">Ø {formatNumber(f.diametro, f.diametro % 1 ? 1 : 0)}</span> <span className="text-[11px] text-muted">{f.productoId ? f.nombre : "sin artículo cargado"}</span></td>
                <td className="px-2 py-1"><NumberInput aria-label={`Barras por tonelada Ø ${f.diametro}`} value={f.bpt} min={0} onValueChange={(v) => up(i, { bpt: v })} className="h-7" /></td>
                <td className="px-2 py-1"><NumberInput aria-label={`Barras Ø ${f.diametro}`} value={f.barras} min={0} onValueChange={(v) => up(i, { barras: v })} className="h-7" /></td>
                <td className="px-2 py-1"><NumberInput aria-label={`Toneladas Ø ${f.diametro}`} value={Math.round(tn(f) * 1000) / 1000} min={0} onValueChange={(v) => up(i, { barras: Math.round(v * f.bpt) })} className="h-7" /></td>
                <td className="px-2 py-1 text-right text-muted tnum">{formatNumber(tn(f) * 1000, 0)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border-strong font-semibold">
              <td className="px-2 py-1.5">Total</td>
              <td />
              <td className="px-2 py-1.5 text-right tnum">{formatNumber(totBarras, 0)}</td>
              <td className="px-2 py-1.5 text-right tnum">{formatNumber(totTn, 3)} TN</td>
              <td className="px-2 py-1.5 text-right tnum">{formatNumber(totTn * 1000, 0)} kg</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {onAgregar && (
        <div className="mt-2 flex justify-end">
          <Button size="sm" disabled={!conArticulo.length} onClick={() => onAgregar(conArticulo.map((f) => ({ productoId: f.productoId!, barras: f.barras })))}>
            <Plus /> Pasar a la cotización
          </Button>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Aceptar → venta ─────────────────────────

export function AceptarCotizacionDialog({ cot, onClose }: { cot: Cotizacion; onClose: () => void }) {
  const db = useDb();
  const router = useRouter();
  const usuario = useUsuario();
  const cli = cot.clienteId ? db.clientes.find((c) => c.id === cot.clienteId) : undefined;
  const puedeFacturar = puede(usuario, "ventas.facturar");
  const puedeCobrar = puede(usuario, "ctacte.cobrar");
  const [datos, setDatos] = React.useState({ razonSocial: cli?.razonSocial ?? cot.prospectoNombre ?? "", cuit: cli?.cuit ?? "", condicionIVA: (cli?.condicionIVA ?? "CF") as CondicionIVA, tipo: cli?.tipo ?? cot.tipoCliente ?? "CONSUMIDOR_FINAL", telefono: cli?.telefono ?? cot.prospectoTelefono ?? "" });
  const [editarDatos, setEditarDatos] = React.useState(!cli);
  const [circuito, setCircuito] = React.useState<Circuito>(cot.circuito);
  const [formaPago, setFormaPago] = React.useState<"CONTADO" | "CUENTA_CORRIENTE">(cli && cli.condicionPago !== "CONTADO" ? "CUENTA_CORRIENTE" : "CONTADO");
  const [entrega, setEntrega] = React.useState<"RETIRA_AHORA" | "RETIRA_DESPUES" | "ENVIO">("RETIRA_AHORA");
  const [fechaEntrega, setFechaEntrega] = React.useState("");
  const [direccion, setDireccion] = React.useState("");
  const [facturar, setFacturar] = React.useState(puedeFacturar);
  const ivaPct = circuito === 1 ? db.config.ivaPct : 0;
  const t = calcularTotales(cot.items.map((i) => ({ cantidad: i.cantidad, precioUnitario: i.precioUnitario, descuentoPct: i.descuentoPct })), cot.descuentoPct, ivaPct);
  const [cobrar, setCobrar] = React.useState(puedeCobrar && puedeFacturar && formaPago === "CONTADO");
  const [medios, setMedios] = React.useState<FilaMedio[]>(() => [nuevoMedio("EFECTIVO", t.total)]);
  const [obs, setObs] = React.useState("");
  const [cargando, setCargando] = React.useState(false);
  const [bloqueo, setBloqueo] = React.useState<{ codigo: string; error: string } | null>(null);
  const [hecho, setHecho] = React.useState<{ npId: string; numero: string; facturaId?: string; reciboId?: string } | null>(null);
  const [imprimir, setImprimir] = React.useState<"F" | "R" | null>(null);
  React.useEffect(() => {
    // Al cambiar el circuito cambia el IVA: el cobro sugerido sigue al total.
    setMedios((ms) => (ms.length === 1 && ms[0].medio === "EFECTIVO" && ms[0].moneda !== "USD" ? [{ ...ms[0], importe: t.total }] : ms));
  }, [t.total]);
  const cobrado = medios.reduce((a, m) => a + pesosDe(m), 0);
  const enviar = async (opciones?: { forzarSinDisponible?: boolean; excepcionCredito?: boolean }) => {
    if (editarDatos && !datos.razonSocial.trim()) return toast.error("Cargá el nombre o razón social.");
    setCargando(true);
    const r = await useStore.getState().aceptarCotizacion(cot.id, {
      cliente: editarDatos ? { razonSocial: datos.razonSocial, cuit: datos.cuit || undefined, condicionIVA: datos.condicionIVA, tipo: datos.tipo, telefono: datos.telefono || undefined } : undefined,
      circuito,
      formaPago,
      entrega,
      fechaEntregaProgramada: entrega !== "RETIRA_AHORA" && fechaEntrega ? new Date(`${fechaEntrega}T12:00:00`).toISOString() : undefined,
      direccionEntrega: entrega === "ENVIO" ? direccion || undefined : undefined,
      facturar,
      cobro: cobrar ? { medios: mediosParaEnviar(medios) } : undefined,
      observaciones: obs || undefined,
      opciones,
    });
    setCargando(false);
    if (!r.ok) {
      if (r.codigo === "SIN_DISPONIBLE" || r.codigo === "CREDITO" || r.codigo === "SIN_STOCK") setBloqueo({ codigo: r.codigo, error: r.error });
      else toast.error(r.error);
      return;
    }
    setHecho(r.data);
  };
  const np = hecho ? db.notasPedido.find((n) => n.id === hecho.npId) : undefined;
  const fac = hecho?.facturaId ? db.comprobantes.find((c) => c.id === hecho.facturaId) : undefined;
  const rec = hecho?.reciboId ? db.cobranzas.find((c) => c.id === hecho.reciboId) : undefined;
  if (hecho)
    return (
      <Dialog open onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          size="md"
          title={`Venta ${hecho.numero} generada`}
          description={`${datos.razonSocial} · ${formatMoney(np?.total ?? t.total)}`}
          footer={
            <>
              <Button variant="secondary" onClick={onClose}>Cerrar</Button>
              <Button onClick={() => router.push(`/ventas/notas-pedido/${hecho.npId}`)}>Ver la venta</Button>
            </>
          }
        >
          <ul className="space-y-2 text-[13px]">
            <li className="flex items-center gap-2"><Check className="size-4 text-success" /> Nota de pedido {hecho.numero}{np?.pendienteEntrega ? " · pendiente de entrega" : ""}</li>
            {fac && (
              <li className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><Check className="size-4 text-success" /> Factura {fac.numero}{fac.arcaEstado === "AUTORIZADO" ? ` · CAE ${fac.cae}` : fac.arcaEstado === "PENDIENTE" ? " · enviándose a ARCA" : ""}</span>
                <Button size="sm" variant="ghost" onClick={() => setImprimir("F")}>Imprimir</Button>
              </li>
            )}
            {rec && (
              <li className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><Check className="size-4 text-success" /> Recibo {rec.numero} · {formatMoney(rec.total)}</span>
                <Button size="sm" variant="ghost" onClick={() => setImprimir("R")}>Imprimir</Button>
              </li>
            )}
          </ul>
          {fac && <PrintPreview open={imprimir === "F"} onOpenChange={(v) => !v && setImprimir(null)} titulo={`Factura ${fac.numero}`}><ComprobanteDocumento comprobante={fac} /></PrintPreview>}
          {rec && <PrintPreview open={imprimir === "R"} onOpenChange={(v) => !v && setImprimir(null)} titulo={`Recibo ${rec.numero}`}><ReciboDocumento cobranza={rec} /></PrintPreview>}
        </DialogContent>
      </Dialog>
    );
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        size="lg"
        title={`Aceptar cotización ${cot.numero}`}
        description="Se convierte en venta en un solo paso."
        footer={
          <>
            <span className="mr-auto text-[13px] text-muted">Total <b className="text-[15px] text-ink tnum">{formatMoney(t.total)}</b></span>
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button loading={cargando} onClick={() => enviar()} disabled={cobrar && cobrado <= 0}><Check /> Aceptar y generar venta</Button>
          </>
        }
      >
        <div className="space-y-4">
          <section className="rounded-card border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-[13px] font-semibold">Cliente</h4>
              {cli && <Button size="sm" variant="ghost" onClick={() => setEditarDatos(!editarDatos)}>{editarDatos ? "No cambiar datos" : "Corregir datos de facturación"}</Button>}
            </div>
            {!editarDatos ? (
              <p className="text-[13px]"><b>{cli?.razonSocial}</b> · {cli?.cuit ? `CUIT ${cli.cuit}` : "sin CUIT"} · {CONDICION_IVA_LABEL[cli?.condicionIVA ?? "CF"]} · {nombreTipoCliente(cli?.tipo, db.config.tiposCliente)}</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Nombre o razón social" required htmlFor="ac-rs"><Input id="ac-rs" value={datos.razonSocial} onChange={(e) => setDatos({ ...datos, razonSocial: e.target.value })} /></FormField>
                <FormField label="CUIT / CUIL (opcional)" htmlFor="ac-cuit"><Input id="ac-cuit" value={datos.cuit} onChange={(e) => setDatos({ ...datos, cuit: e.target.value })} inputMode="numeric" /></FormField>
                <FormField label="Condición IVA"><Select value={datos.condicionIVA} onValueChange={(v) => setDatos({ ...datos, condicionIVA: v as CondicionIVA })} options={opciones(CONDICION_IVA_LABEL)} /></FormField>
                {!cli && <FormField label="Tipo de cliente"><Select value={datos.tipo} onValueChange={(v) => setDatos({ ...datos, tipo: v })} options={opcionesTipoCliente(db.config.tiposCliente, datos.tipo)} /></FormField>}
                {!cli && <FormField label="Teléfono" htmlFor="ac-tel"><Input id="ac-tel" value={datos.telefono} onChange={(e) => setDatos({ ...datos, telefono: e.target.value })} /></FormField>}
              </div>
            )}
          </section>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Comprobante">
              <Segmented value={String(circuito) as "1" | "2"} onChange={(v) => setCircuito(Number(v) as Circuito)} options={[{ value: "1", label: "Factura fiscal (F1)" }, { value: "2", label: "Interno (F2)" }]} />
            </FormField>
            <FormField label="Forma de pago">
              <Segmented value={formaPago} onChange={(v) => { setFormaPago(v); setCobrar(v === "CONTADO" && puedeCobrar && facturar); }} options={[{ value: "CONTADO", label: "Contado" }, { value: "CUENTA_CORRIENTE", label: "Cuenta corriente" }]} />
            </FormField>
            <FormField label="Entrega" className="sm:col-span-2">
              <Segmented value={entrega} onChange={setEntrega} options={[{ value: "RETIRA_AHORA", label: "Se lo lleva ahora" }, { value: "RETIRA_DESPUES", label: "Retira después" }, { value: "ENVIO", label: "Envío" }]} />
            </FormField>
            {entrega !== "RETIRA_AHORA" && (
              <FormField label="Fecha de entrega" htmlFor="ac-fe"><Input id="ac-fe" type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} /></FormField>
            )}
            {entrega === "ENVIO" && (
              <FormField label="Dirección de entrega" htmlFor="ac-dir"><Input id="ac-dir" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder={cli?.direccion} /></FormField>
            )}
          </div>
          {puedeFacturar && (
            <label className="flex items-center gap-2 text-[13px]">
              <Switch checked={facturar} onCheckedChange={(v) => { setFacturar(v); if (!v) setCobrar(false); }} /> Emitir {circuito === 1 ? "factura" : "comprobante interno"} ahora
            </label>
          )}
          {puedeCobrar && facturar && (
            <section>
              <label className="flex items-center gap-2 text-[13px]">
                <Switch checked={cobrar} onCheckedChange={setCobrar} /> Registrar el cobro ahora (genera el recibo)
              </label>
              {cobrar && (
                <div className="mt-2">
                  <MediosEditor medios={medios} onChange={setMedios} sucursalId={cot.sucursalId} />
                  <p className={cn("mt-1 text-right text-[12px]", Math.abs(cobrado - t.total) > 0.01 ? "text-warning" : "text-muted")}>
                    Cobrado {formatMoney(cobrado)} de {formatMoney(t.total)}
                    {cobrado < t.total - 0.01 ? ` · queda ${formatMoney(t.total - cobrado)} en cuenta corriente` : cobrado > t.total + 0.01 ? ` · ${formatMoney(cobrado - t.total)} a favor del cliente` : ""}
                  </p>
                </div>
              )}
            </section>
          )}
          <FormField label="Observaciones (opcional)" htmlFor="ac-obs"><Input id="ac-obs" value={obs} onChange={(e) => setObs(e.target.value)} /></FormField>
          {bloqueo && (
            <div className="rounded-control border border-danger/30 bg-danger-soft p-3 text-[13px] text-danger">
              <p>{bloqueo.error}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {bloqueo.codigo === "SIN_STOCK" && <Button size="sm" variant="secondary" onClick={() => { setEntrega("RETIRA_DESPUES"); setBloqueo(null); }}>Dejarlo pendiente de entrega</Button>}
                {bloqueo.codigo === "SIN_DISPONIBLE" && puede(usuario, "stock.forzarVenta") && <Button size="sm" variant="danger" onClick={() => enviar({ forzarSinDisponible: true })}>Vender igual (queda registrado)</Button>}
                {bloqueo.codigo === "CREDITO" && puede(usuario, "credito.autorizar") && <Button size="sm" variant="danger" onClick={() => enviar({ excepcionCredito: true })}>Autorizar excepción de crédito</Button>}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────── Ventas anuladas ─────────────────────────

type FilaAnulada = { id: string; tipo: "COT" | "NP"; numero: string; fecha: string; cliente: string; total: number; motivo?: string; recuperable: boolean };

/** Cotizaciones y ventas anuladas, con "Recuperar" para no tener que cargarlas de nuevo. */
export function VentasAnuladasView() {
  const db = useDb();
  const router = useRouter();
  const veC2 = useVeCircuito2();
  const puedeRecuperar = usePuede("ventas.editar");
  const [ver, setVer] = React.useState<Cotizacion | null>(null);
  const filas: FilaAnulada[] = [
    ...db.cotizaciones.filter((c) => (c.estado === "RECHAZADA" || c.estado === "VENCIDA") && (veC2 || c.circuito !== 2)).map((c) => ({ id: c.id, tipo: "COT" as const, numero: c.numero, fecha: c.fechaRespuesta ?? c.actualizadoEn, cliente: nombreCotizacion(c, db), total: c.total, motivo: c.motivoRechazo, recuperable: true })),
    ...db.notasPedido
      .filter((n) => n.estado === "ANULADA" && (veC2 || n.circuito !== 2))
      .map((n) => {
        const cot = n.cotizacionId ? db.cotizaciones.find((c) => c.id === n.cotizacionId) : undefined;
        const yaRecuperada = !!cot && !(cot.estado === "ACEPTADA" && cot.notaPedidoId === n.id) && cot.estado !== "RECHAZADA";
        const c = db.clientes.find((x) => x.id === n.clienteId);
        return { id: n.id, tipo: "NP" as const, numero: n.numero, fecha: n.anuladaEn ?? n.actualizadoEn, cliente: c?.nombreFantasia ?? c?.razonSocial ?? "", total: n.total, motivo: n.motivoAnulacion, recuperable: !yaRecuperada && n.origen !== "ACOPIO" };
      }),
  ];
  const recuperar = async (f: FilaAnulada) => {
    const r = f.tipo === "COT" ? await useStore.getState().recuperarCotizacion(f.id) : await useStore.getState().recuperarVenta(f.id);
    if (!r.ok) return toast.error(r.error);
    router.push("/ventas/cotizaciones");
  };
  const columnas: Column<FilaAnulada>[] = [
    { key: "t", header: "Tipo", cell: (f) => <Badge variant={f.tipo === "NP" ? "danger" : "neutral"}>{f.tipo === "NP" ? "Venta" : "Cotización"}</Badge> },
    { key: "n", header: "Número", sortable: true, sortValue: (f) => f.numero, cell: (f) => <span className="whitespace-nowrap font-mono text-[12px]">{f.numero}</span> },
    { key: "f", header: "Anulada el", sortable: true, sortValue: (f) => f.fecha, cell: (f) => <span className="text-muted">{formatDate(f.fecha)}</span> },
    { key: "c", header: "Cliente", sortable: true, sortValue: (f) => f.cliente, cell: (f) => <span className="block min-w-[150px]">{f.cliente}</span> },
    { key: "m", header: "Motivo", cell: (f) => <span className="block max-w-[260px] truncate text-[12px] text-muted" title={f.motivo}>{f.motivo || "—"}</span>, hideOnMobile: true },
    { key: "to", header: "Total", align: "right", sortable: true, sortValue: (f) => f.total, cell: (f) => <span className="tnum">{formatMoney(f.total, { decimals: false })}</span> },
    {
      key: "a",
      header: "",
      align: "right",
      cell: (f) =>
        puedeRecuperar && f.recuperable ? (
          <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); void recuperar(f); }}>Recuperar</Button>
        ) : f.tipo === "NP" ? (
          <span className="text-[12px] text-muted">Recuperada</span>
        ) : null,
    },
  ];
  return (
    <>
      <PageHeader titulo="Ventas anuladas" />
      <DataTable
        rows={filas}
        columns={columnas}
        getRowId={(f) => f.id}
        onRowClick={(f) => (f.tipo === "NP" ? router.push(`/ventas/notas-pedido/${f.id}`) : setVer(db.cotizaciones.find((c) => c.id === f.id) ?? null))}
        searchText={(f) => `${f.numero} ${f.cliente} ${f.motivo ?? ""}`}
        initialSort={{ key: "f", dir: "desc" }}
        empty={{ icono: X, titulo: "No hay ventas ni cotizaciones anuladas" }}
      />
      {ver && (
        <PrintPreview open onOpenChange={(v) => !v && setVer(null)} titulo={`Cotización ${ver.numero} · anulada`}>
          <CotizacionDocumento cot={ver} />
        </PrintPreview>
      )}
    </>
  );
}
