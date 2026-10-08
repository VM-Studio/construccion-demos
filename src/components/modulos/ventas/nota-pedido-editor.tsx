"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Info, Plus, Save, ShieldAlert, Users } from "lucide-react";
import { useStore } from "@/store";
import { useAcopiosResumen, useDb, usePendientes, usePuede, useUnidadNegocio, useUsuario } from "@/store/selectors";
import type { Circuito, FormaPagoVenta, ModalidadEntrega, NotaPedido, OrigenVenta, Producto } from "@/domain/types";
import { obtenerPrecio } from "@/domain/precios";
import { calcularTotales } from "@/domain/ventas";
import { precioCongelado } from "@/domain/acopios";
import { puede } from "@/domain/permisos";
import type { OpcionesConfirmacion } from "@/store/slices/ventas";
import { PageHeader } from "@/components/shared/page-header";
import { ItemsGrid, type LineaBase } from "@/components/shared/items-grid";
import { SelectorCliente } from "@/components/shared/alta-rapida";
import { NuevaObraDialog, ObraSelect } from "@/components/shared/obra-select";
import { prerequisitos } from "@/domain/prerequisitos";
import { CircuitoBadge } from "@/components/shared/circuito-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/tabs";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { diaLocal } from "@/lib/periodos";
import { cn, newId } from "@/lib/utils";
import { AvisoFaltantes } from "@/components/shared/aviso-faltantes";
import { PendientesTabla } from "./pendientes-tabla";

interface Linea extends LineaBase {
  obraId?: string;
}

const deInput = (v: string, hora = 9) => {
  const [y, m, d] = v.split("-").map(Number);
  const n = new Date();
  return new Date(y, m - 1, d, v === diaLocal(n) ? n.getHours() : hora, v === diaLocal(n) ? n.getMinutes() : 0).toISOString();
};

/** Alta / edición de nota de pedido: venta nueva o retiro de acopio, con forma de pago, circuito y entrega. */
export function NotaPedidoEditor({ borrador }: { borrador?: NotaPedido }) {
  const db = useDb();
  const router = useRouter();
  const params = useSearchParams();
  const usuario = useUsuario();
  const unActiva = useUnidadNegocio();
  const acopiosRes = useAcopiosResumen();
  const verMargen = usePuede("margenes.ver");
  const cotizacion = params.get("cotizacion") ? db.cotizaciones.find((c) => c.id === params.get("cotizacion")) : undefined;

  const sucUsuario = usuario?.sucursalId ?? "suc_central";
  const [clienteId, setClienteId] = React.useState(borrador?.clienteId ?? params.get("cliente") ?? cotizacion?.clienteId ?? "");
  const cliente = db.clientes.find((c) => c.id === clienteId);
  const [sucursalId, setSucursalId] = React.useState(borrador?.sucursalId ?? cliente?.sucursalPreferidaId ?? sucUsuario);
  const [depositoId, setDepositoId] = React.useState(borrador?.depositoId ?? db.sucursales.find((s) => s.id === sucursalId)?.depositoId ?? "dep_central");
  const [vendedorId, setVendedorId] = React.useState(borrador?.vendedorId ?? cliente?.vendedorId ?? (usuario?.rol === "VENTAS" ? usuario.id : ""));
  const [fecha, setFecha] = React.useState(diaLocal(borrador?.fecha ?? new Date()));
  const [origen, setOrigen] = React.useState<OrigenVenta>(borrador?.origen ?? (params.get("origen") === "acopio" || params.get("acopio") ? "ACOPIO" : "NUEVA"));
  const [acopioId, setAcopioId] = React.useState(borrador?.acopioId ?? params.get("acopio") ?? "");
  const [formaPago, setFormaPago] = React.useState<FormaPagoVenta>(borrador?.formaPago ?? (cliente?.condicionPago === "CONTADO" || !cliente ? "CONTADO" : "CUENTA_CORRIENTE"));
  const [circuito, setCircuito] = React.useState<Circuito>(borrador?.circuito ?? cotizacion?.circuito ?? cliente?.circuitoHabitual ?? 1);
  const [pendiente, setPendiente] = React.useState(borrador?.pendienteEntrega ?? false);
  const [modalidad, setModalidad] = React.useState<ModalidadEntrega>(borrador?.modalidadEntrega ?? "RETIRA");
  const [fechaEntrega, setFechaEntrega] = React.useState(diaLocal(borrador?.fechaEntregaProgramada ?? new Date(Date.now() + 86_400_000)));
  const [obraEntrega, setObraEntrega] = React.useState("");
  const [direccion, setDireccion] = React.useState(borrador?.direccionEntrega ?? "");
  const [descuento, setDescuento] = React.useState(borrador?.descuentoPct ?? cotizacion?.descuentoPct ?? 0);
  const [obs, setObs] = React.useState(borrador?.observaciones ?? "");
  const [items, setItems] = React.useState<Linea[]>(
    () =>
      borrador?.items.map((i) => ({ id: i.id, productoId: i.productoId, obraId: i.obraId, cantidad: i.cantidad, precio: i.precioUnitario, descuentoPct: i.descuentoPct ?? 0 })) ??
      cotizacion?.items.map((i) => ({ id: newId("l"), productoId: i.productoId, obraId: i.obraId ?? cotizacion.obraId, cantidad: i.cantidad, precio: i.precioUnitario, descuentoPct: i.descuentoPct })) ??
      [],
  );
  const [nuevaObra, setNuevaObra] = React.useState(false);
  const [bloqueo, setBloqueo] = React.useState<{ codigo: string; error: string; opts: OpcionesConfirmacion } | null>(null);
  const [verPendientes, setVerPendientes] = React.useState<string | null>(null);

  const acopiosCliente = acopiosRes.filter((a) => a.acopio.clienteId === clienteId && a.estado === "VIGENTE" && a.saldo > 0.009);
  const acopioRes = acopiosRes.find((a) => a.acopio.id === acopioId);
  const acopio = origen === "ACOPIO" ? acopioRes?.acopio : undefined;

  // Al elegir cliente: precarga lista, condición, circuito, vendedor, sucursal y acopio único.
  const elegirCliente = (id: string) => {
    setClienteId(id);
    // Se lee del store en el momento: si el cliente se acaba de crear con el alta rápida, todavía no está en `db`.
    const c = useStore.getState().db.clientes.find((x) => x.id === id);
    if (!c) return;
    setCircuito(c.circuitoHabitual);
    setFormaPago(c.condicionPago === "CONTADO" ? "CONTADO" : "CUENTA_CORRIENTE");
    if (c.vendedorId) setVendedorId(c.vendedorId);
    if (!usuario?.sucursalId) {
      setSucursalId(c.sucursalPreferidaId);
      setDepositoId(db.sucursales.find((s) => s.id === c.sucursalPreferidaId)?.depositoId ?? depositoId);
    }
    setAcopioId("");
    setItems([]);
  };
  // Acopio: circuito, depósito y obras del acopio; un único acopio se preselecciona.
  React.useEffect(() => {
    if (origen !== "ACOPIO") return;
    if (!acopioId && acopiosCliente.length === 1) setAcopioId(acopiosCliente[0].acopio.id);
  }, [origen, acopioId, acopiosCliente]);
  React.useEffect(() => {
    if (!acopio) return;
    setCircuito(acopio.circuito);
    setDepositoId(acopio.depositoId);
    setSucursalId(acopio.sucursalId);
    setFormaPago("ACOPIO");
    setItems((its) => its.filter((i) => acopio.preciosCongelados.some((p) => p.productoId === i.productoId)).map((i) => ({ ...i, precio: precioCongelado(acopio, i.productoId)?.precio ?? i.precio, descuentoPct: 0, obraId: i.obraId && acopio.obraIds.includes(i.obraId) ? i.obraId : acopio.obraIds[0] })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acopio?.id]);
  React.useEffect(() => {
    if (origen === "NUEVA" && formaPago === "ACOPIO") setFormaPago(cliente?.condicionPago === "CONTADO" ? "CONTADO" : "CUENTA_CORRIENTE");
  }, [origen, formaPago, cliente]);

  const lista = cliente?.listaPreciosId ?? "lst_gen";
  const prod = React.useCallback((id: string) => db.productos.find((p) => p.id === id), [db.productos]);
  const obrasPermitidas = acopio ? acopio.obraIds : undefined;
  const crearItem = (p: Producto): Linea => ({
    id: newId("l"),
    productoId: p.id,
    obraId: items.at(-1)?.obraId ?? obrasPermitidas?.[0] ?? db.obras.find((o) => o.clienteId === clienteId && o.activa)?.id,
    cantidad: 1,
    precio: acopio ? (precioCongelado(acopio, p.id)?.precio ?? 0) : obtenerPrecio(p.id, lista, db.precios),
    descuentoPct: 0,
  });
  const congelados = React.useMemo(() => new Set(acopio?.preciosCongelados.map((p) => p.productoId) ?? []), [acopio]);
  const filtroProductos = React.useCallback((p: Producto) => (acopio ? congelados.has(p.id) : !unActiva || p.unidadNegocioId === unActiva), [acopio, congelados, unActiva]);

  const ivaPct = acopio || circuito === 2 ? 0 : db.config.ivaPct;
  const t = calcularTotales(items.map((i) => ({ cantidad: i.cantidad, precioUnitario: i.precio ?? 0, descuentoPct: i.descuentoPct })), acopio ? 0 : descuento, ivaPct);
  const monto = acopio ? t.subtotal : t.total;
  const costo = items.reduce((a, i) => a + i.cantidad * (acopio ? (precioCongelado(acopio, i.productoId)?.costoSnapshot ?? 0) : (prod(i.productoId)?.costoPromedio ?? 0)), 0);
  const margen = t.neto - costo;
  const saldoAntes = acopioRes?.saldo ?? 0;
  const saldoDespues = Math.round((saldoAntes - t.subtotal) * 100) / 100;

  const datos = () => ({
    clienteId,
    sucursalId,
    depositoId,
    vendedorId: vendedorId || undefined,
    fecha: deInput(fecha),
    circuito,
    origen,
    acopioId: acopio?.id,
    formaPago: (acopio ? "ACOPIO" : formaPago) as FormaPagoVenta,
    items: items.map((i) => ({ id: i.id, productoId: i.productoId, obraId: i.obraId, cantidad: i.cantidad, precioUnitario: i.precio ?? 0, descuentoPct: i.descuentoPct })),
    descuentoPct: acopio ? 0 : descuento,
    pendienteEntrega: pendiente,
    modalidadEntrega: pendiente ? modalidad : "RETIRA",
    fechaEntregaProgramada: pendiente ? deInput(fechaEntrega) : undefined,
    direccionEntrega: pendiente && modalidad === "ENVIO" ? direccion || [db.obras.find((o) => o.id === obraEntrega)?.direccion, db.obras.find((o) => o.id === obraEntrega)?.localidad].filter(Boolean).join(", ") || undefined : undefined,
    observaciones: obs || undefined,
    cotizacionId: cotizacion?.id,
  });

  const guardarBorrador = () => {
    const r = useStore.getState().guardarNotaPedido(datos(), borrador?.id);
    if (!r.ok) return toast.error(r.error);
    toast.success("Borrador guardado");
    if (!borrador) router.replace(`/ventas/notas-pedido/${r.data}`);
  };

  const confirmar = (opts: OpcionesConfirmacion = {}) => {
    if (!clienteId) return toast.error("Elegí un cliente.");
    if (!items.length) return toast.error("Agregá al menos un artículo.");
    if (origen === "ACOPIO" && !acopio) return toast.error("Elegí el acopio del que se retira.");
    const r = useStore.getState().crearNotaPedido(datos(), opts, borrador?.id);
    if (!r.ok) {
      if (r.codigo && ["SIN_DISPONIBLE", "SALDO_ACOPIO", "IMPAGO", "CREDITO"].includes(r.codigo)) setBloqueo({ codigo: r.codigo, error: r.error, opts });
      else toast.error(r.error);
      return;
    }
    const np = useStore.getState().db.notasPedido.find((n) => n.id === r.data)!;
    toast.success(`Nota de pedido ${np.numero} confirmada`, { description: acopio ? `Saldo del acopio luego del retiro: ${formatMoney(saldoDespues)}` : undefined });
    setBloqueo(null);
    router.replace(`/ventas/notas-pedido/${r.data}`);
  };

  const faltante = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) m.set(i.productoId, (m.get(i.productoId) ?? 0) + i.cantidad);
    return m;
  }, [items]);
  const productoBloqueo = bloqueo?.codigo === "SIN_DISPONIBLE" ? db.productos.find((p) => bloqueo.error.includes(p.codigo)) : undefined;
  const lineasProductoBloqueo = usePendientes().filter((l) => l.productoId === (verPendientes ?? "") && l.depositoId === depositoId);

  const sel = "grid gap-3 sm:grid-cols-2 lg:grid-cols-5";
  const faltan = borrador ? [] : prerequisitos("notasPedido", db);
  const obrasCliente = db.obras.filter((o) => o.clienteId === clienteId && o.activa);
  const obraCreada = (id: string) => setItems((its) => its.map((i) => (i.obraId ? i : { ...i, obraId: id })));
  return (
    <div>
      <PageHeader
        titulo={borrador ? "Nota de pedido (borrador)" : "Nueva nota de pedido"}
        descripcion={acopio ? "Retiro de acopio a precios congelados: descuenta del saldo disponible." : "Venta nueva: precios de lista del cliente, con control de disponible."}
        favorito={false}
      />
      {faltan.length > 0 && (
        <AvisoFaltantes
          className="mb-4"
          faltan={faltan}
          titulo="Para vender falta cargar datos"
          texto={`Necesitás ${faltan.map((f) => f.nombre).join(" y ")}. Podés crearlos desde los buscadores de abajo sin perder lo cargado, o ir a su pantalla.`}
        />
      )}
      {clienteId && !acopio && obrasCliente.length === 0 && (
        <AvisoFaltantes
          className="mb-4"
          faltan={[]}
          titulo="El cliente no tiene obras"
          texto="Cada línea de la nota de pedido indica a qué obra va. Creá la primera obra del cliente para poder imputar los artículos."
          acciones={<Button size="sm" variant="secondary" onClick={() => setNuevaObra(true)}><Plus /> Nueva obra</Button>}
        />
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-4">
              <div className={sel}>
                <FormField label="Cliente" required className="sm:col-span-2">
                  <SelectorCliente value={clienteId} onChange={elegirCliente} placeholder="Buscar cliente por nombre, código o CUIT…" />
                </FormField>
                <FormField label="Sucursal">
                  <Select aria-label="Sucursal" value={sucursalId} disabled={!!acopio} onValueChange={(v) => { setSucursalId(v); setDepositoId(db.sucursales.find((s) => s.id === v)?.depositoId ?? depositoId); }} options={db.sucursales.map((s) => ({ value: s.id, label: s.nombre }))} />
                </FormField>
                <FormField label="Depósito">
                  <Select aria-label="Depósito" value={depositoId} disabled={!!acopio} onValueChange={setDepositoId} options={db.depositos.map((d) => ({ value: d.id, label: d.nombre }))} />
                </FormField>
                <FormField label="Fecha" htmlFor="np-f">
                  <Input id="np-f" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </FormField>
                <FormField label="Vendedor">
                  <Select aria-label="Vendedor" value={vendedorId} onValueChange={setVendedorId} options={[{ value: "", label: "Sin asignar" }, ...db.usuarios.filter((u) => u.rol === "VENTAS" || u.rol === "DUENO").map((u) => ({ value: u.id, label: u.nombre }))]} />
                </FormField>
              </div>

              <div className="border-t border-border pt-4" data-tour="np-origen">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[13px] font-medium">Origen</span>
                  <Segmented value={origen} onChange={(v) => { setOrigen(v); if (v === "NUEVA") setAcopioId(""); }} options={[{ value: "NUEVA", label: "Nueva" }, { value: "ACOPIO", label: "Acopio" }]} />
                </div>
                {origen === "ACOPIO" && (
                  <div className="mt-3">
                    {!clienteId ? (
                      <p className="text-[13px] text-muted">Elegí el cliente para ver sus acopios.</p>
                    ) : acopiosCliente.length === 0 ? (
                      <p className="flex items-center gap-2 text-[13px] text-warning"><AlertTriangle className="size-4" /> El cliente no tiene acopios vigentes con saldo.</p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {acopiosCliente.map((a) => (
                          <button
                            key={a.acopio.id}
                            onClick={() => setAcopioId(a.acopio.id)}
                            className={cn("rounded-card border p-3 text-left transition-colors", a.acopio.id === acopioId ? "border-ink bg-subtle" : "border-border hover:border-border-strong")}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-[12px] font-medium">{a.acopio.numero}</span>
                              <CircuitoBadge circuito={a.acopio.circuito} corto />
                            </div>
                            <div className="mt-1 truncate text-[12px] text-muted">{db.obras.filter((o) => a.acopio.obraIds.includes(o.id)).map((o) => o.nombre).join(" · ")}</div>
                            <div className="mt-1.5 flex items-baseline justify-between text-[12px]">
                              <span>Saldo <span className="font-semibold tnum">{formatMoney(a.saldo)}</span></span>
                              <span className={cn("text-muted", a.diasParaVencer <= 30 && "text-warning")}>vence {formatDate(a.acopio.fechaVencimiento)}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid gap-4 border-t border-border pt-4 lg:grid-cols-3">
                <FormField label="Forma de pago">
                  {acopio ? (
                    <div className="flex h-9 items-center text-[13px] text-muted"><Info className="mr-1.5 size-4" /> Acopio (ya facturado y cobrado)</div>
                  ) : (
                    <Segmented value={formaPago} onChange={setFormaPago} options={[{ value: "CONTADO", label: "Contado" }, { value: "CUENTA_CORRIENTE", label: "Cuenta corriente" }]} />
                  )}
                </FormField>
                <FormField label="Circuito">
                  {acopio ? (
                    <div className="flex h-9 items-center"><CircuitoBadge circuito={acopio.circuito} /></div>
                  ) : (
                    <Segmented value={String(circuito) as "1" | "2"} onChange={(v) => setCircuito(Number(v) as Circuito)} options={[{ value: "1", label: "AC1 · Fiscal" }, { value: "2", label: "AC2 · Interno" }]} />
                  )}
                </FormField>
                <FormField label="Entrega">
                  <Segmented value={pendiente ? "P" : "I"} onChange={(v) => setPendiente(v === "P")} options={[{ value: "I", label: "Entrega inmediata" }, { value: "P", label: "Pendiente de entrega" }]} />
                </FormField>
              </div>
              {pendiente && (
                <div className="grid gap-3 rounded-card border border-border bg-[#FAFAF8] p-3 sm:grid-cols-2 lg:grid-cols-4">
                  <FormField label="Modalidad">
                    <Segmented value={modalidad} onChange={setModalidad} options={[{ value: "RETIRA", label: "Cliente retira" }, { value: "ENVIO", label: "Envío a obra" }]} />
                  </FormField>
                  <FormField label="Fecha programada" htmlFor="np-fe">
                    <Input id="np-fe" type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
                  </FormField>
                  {modalidad === "ENVIO" && (
                    <>
                      <FormField label="Obra de entrega">
                        <ObraSelect clienteId={clienteId} value={obraEntrega} onChange={setObraEntrega} permitidas={obrasPermitidas} />
                      </FormField>
                      <FormField label="Dirección" htmlFor="np-dir">
                        <Input id="np-dir" value={direccion} placeholder={db.obras.find((o) => o.id === obraEntrega)?.direccion ?? cliente?.direccion} onChange={(e) => setDireccion(e.target.value)} />
                      </FormField>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Artículos</CardTitle>
              <span className="text-[12px] text-muted">
                {acopio ? `Lista congelada del ${formatDate(acopio.fechaCreacion)}` : `${db.listasPrecios.find((l) => l.id === lista)?.nombre ?? ""}${unActiva ? ` · ${db.unidadesNegocio.find((u) => u.id === unActiva)?.nombre}` : ""}`} · disponible en {db.depositos.find((d) => d.id === depositoId)?.nombre}
              </span>
            </CardHeader>
            <CardContent>
              <ItemsGrid<Linea>
                items={items}
                onChange={setItems}
                crearItem={crearItem}
                depositoId={depositoId}
                listaId={acopio ? undefined : lista}
                conDescuento={!acopio}
                ocultarTotales
                filtroProductos={filtroProductos}
                precioDe={acopio ? (p) => precioCongelado(acopio, p.id)?.precio : undefined}
                precioFijo={acopio ? () => `Precio congelado del acopio el ${formatDate(acopio.fechaCreacion)}` : undefined}
                extras={[
                  {
                    header: "Obra",
                    width: 200,
                    cell: (i, up) => <ObraSelect clienteId={clienteId} value={i.obraId} onChange={(v) => up({ obraId: v })} permitidas={obrasPermitidas} className="h-8 text-[12px]" />,
                  },
                ]}
                avisoLinea={(i, p) => {
                  const costoU = acopio ? precioCongelado(acopio, p.id)?.costoSnapshot : p.costoPromedio;
                  if (!acopio && verMargen && costoU && (i.precio ?? 0) * (1 - (i.descuentoPct ?? 0) / 100) < costoU) return { texto: "Precio por debajo del costo", tono: "warning" };
                  return undefined;
                }}
                vacio={acopio ? "Agregá artículos de la lista congelada del acopio." : "Agregá artículos con el buscador."}
              />
            </CardContent>
          </Card>
          <FormField label="Observaciones" htmlFor="np-obs">
            <textarea id="np-obs" value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className="w-full rounded-control border border-border-strong bg-surface p-2.5 text-[13px] outline-none focus:border-ink" />
          </FormField>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {acopio && acopioRes && (
            <Card>
              <CardHeader><CardTitle>Datos del acopio</CardTitle><CircuitoBadge circuito={acopio.circuito} corto /></CardHeader>
              <CardContent>
                <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-[13px]">
                  <dt className="text-muted">Importe</dt><dd className="text-right tnum">{formatMoney(acopio.importe)}</dd>
                  <dt className="text-muted">Retirado</dt><dd className="text-right tnum">{formatMoney(acopioRes.retirado)}</dd>
                  <dt className="text-muted">Saldo disponible</dt><dd className="text-right font-medium tnum">{formatMoney(acopioRes.saldo)}</dd>
                  <dt className="text-muted">Pendiente de entrega</dt><dd className="text-right tnum">{formatMoney(acopioRes.pendienteEntrega)}</dd>
                  {acopio.formaPago === "CUENTA_CORRIENTE" && (<><dt className="text-muted">Pagado</dt><dd className="text-right tnum">{formatMoney(acopioRes.pagado)}</dd></>)}
                  <dt className="text-muted">Vencimiento</dt><dd className={cn("text-right", acopioRes.diasParaVencer <= 30 && "font-medium text-warning")}>{formatDate(acopio.fechaVencimiento)}</dd>
                </dl>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle>Resumen</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-[13px]">
                <dt className="text-muted">Subtotal</dt>
                <dd className="text-right tnum">{formatMoney(t.subtotal)}</dd>
                {!acopio && (
                  <>
                    <dt className="flex items-center gap-2 text-muted">
                      Descuento
                      <Input aria-label="Descuento general" type="number" min={0} max={100} value={descuento} onChange={(e) => setDescuento(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} className="h-7 w-16" />
                      %
                    </dt>
                    <dd className="text-right tnum">− {formatMoney(t.descuento)}</dd>
                    <dt className="text-muted">IVA {ivaPct} %{circuito === 2 && " (AC2)"}</dt>
                    <dd className="text-right tnum">{formatMoney(t.iva)}</dd>
                  </>
                )}
                <dt className="border-t border-border pt-1.5 font-semibold">{acopio ? "Monto del retiro" : "Total"}</dt>
                <dd className="border-t border-border pt-1.5 text-right text-[16px] font-semibold tnum">{formatMoney(monto)}</dd>
              </dl>
              {acopio && (
                <div className={cn("rounded-control border p-3 text-[13px]", saldoDespues < 0 ? "border-danger/30 bg-danger-soft" : "border-accent/30 bg-accent-soft")} data-tour="np-saldo">
                  <div className="text-[12px] text-muted">Saldo disponible del acopio</div>
                  <div className="mt-0.5 flex flex-wrap items-baseline gap-1.5">
                    <span className="font-semibold tnum">{formatMoney(saldoAntes)}</span>
                    <span className="text-muted">→ luego de este retiro</span>
                    <span className={cn("font-semibold tnum", saldoDespues < 0 ? "text-danger" : "text-ink")}>{formatMoney(saldoDespues)}</span>
                  </div>
                  {saldoDespues < 0 && <p className="mt-1 text-[12px] text-danger">Supera el saldo: requiere autorización de Dueño o Administración.</p>}
                </div>
              )}
              {verMargen && items.length > 0 && (
                <div className="rounded-control border border-border p-3">
                  <div className="text-[12px] text-muted">{acopio ? "Margen al costo congelado" : "Margen estimado (costo promedio)"}</div>
                  <div className="mt-0.5 flex items-baseline justify-between">
                    <span className="text-[16px] font-semibold tnum">{formatMoney(margen)}</span>
                    <span className={cn("text-[13px] font-semibold tnum", margen < 0 ? "text-danger" : "text-muted")}>{formatPercent(t.neto ? margen / t.neto : 0)}</span>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Button onClick={() => confirmar()} disabled={!clienteId || !items.length}>
                  <CheckCircle2 /> Confirmar
                </Button>
                <Button variant="secondary" onClick={guardarBorrador} disabled={!clienteId || !items.length}>
                  <Save /> Guardar borrador
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {clienteId && <NuevaObraDialog clienteId={clienteId} open={nuevaObra} onOpenChange={setNuevaObra} onCreada={obraCreada} />}

      <Dialog open={!!bloqueo} onOpenChange={(v) => !v && setBloqueo(null)}>
        {bloqueo && (
          <DialogContent
            size="md"
            title={bloqueo.codigo === "SIN_DISPONIBLE" ? "No hay disponible suficiente" : bloqueo.codigo === "CREDITO" ? "Supera el límite de crédito" : "Supera el saldo del acopio"}
            footer={
              <>
                <Button variant="secondary" onClick={() => setBloqueo(null)}>Volver</Button>
                {bloqueo.codigo === "SIN_DISPONIBLE" && puede(usuario, "stock.forzarVenta") && (
                  <Button variant="danger" onClick={() => confirmar({ ...bloqueo.opts, forzarSinDisponible: true })}><ShieldAlert /> Forzar venta (queda auditado)</Button>
                )}
                {(bloqueo.codigo === "SALDO_ACOPIO" || bloqueo.codigo === "IMPAGO") && puede(usuario, "acopios.autorizar") && (
                  <Button variant="danger" onClick={() => confirmar({ ...bloqueo.opts, autorizarSaldoNegativo: true })}><ShieldAlert /> Autorizar y confirmar</Button>
                )}
                {bloqueo.codigo === "CREDITO" && puede(usuario, "credito.autorizar") && (
                  <Button variant="danger" onClick={() => confirmar({ ...bloqueo.opts, excepcionCredito: true })}><ShieldAlert /> Autorizar excepción</Button>
                )}
              </>
            }
          >
            <div className="space-y-3 text-[13px]">
              <p className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" /> {bloqueo.error}</p>
              {bloqueo.codigo === "SIN_DISPONIBLE" && productoBloqueo && (
                <Button size="sm" variant="secondary" onClick={() => setVerPendientes(productoBloqueo.id)}>
                  <Users /> Ver quién tiene pendiente
                </Button>
              )}
              {!puede(usuario, bloqueo.codigo === "SIN_DISPONIBLE" ? "stock.forzarVenta" : bloqueo.codigo === "CREDITO" ? "credito.autorizar" : "acopios.autorizar") && (
                <p className="text-muted">Solo Dueño o Administración pueden autorizarlo. Pediles que confirmen esta nota de pedido.</p>
              )}
              {faltante.size > 0 && bloqueo.codigo === "SIN_DISPONIBLE" && <p className="text-[12px] text-muted">El disponible descuenta lo vendido o retirado de acopio que todavía no se entregó.</p>}
            </div>
          </DialogContent>
        )}
      </Dialog>
      <Sheet open={!!verPendientes} onOpenChange={(v) => !v && setVerPendientes(null)}>
        <SheetContent side="right" width={960} title={`Pendiente de entrega · ${prod(verPendientes ?? "")?.nombre ?? ""} · ${db.depositos.find((d) => d.id === depositoId)?.nombre}`}>
          <div className="p-4">
            <PendientesTabla lineas={lineasProductoBloqueo} mostrarCliente bare />
            <p className="mt-3 text-[12px] text-muted">
              Para liberar disponible podés entregar estas ventas o <Link href="/compras/ordenes" className="underline">reponer mercadería</Link>.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
