"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Boxes, FileText, Pencil, Plus, ShoppingCart, Wallet, PackageOpen, Check, X } from "lucide-react";
import { useStore } from "@/store";
import { useAcopiosResumen, useDb, usePendientes, usePuede, useRentabilidadNP, useSaldosClientes } from "@/store/selectors";
import { CONDICION_IVA_LABEL, CONDICION_PAGO_LABEL, FORMA_PAGO_LABEL, TIPO_CLIENTE_LABEL } from "@/domain/estados";
import { porcentajeEntregado } from "@/domain/ventas";
import type { Obra } from "@/domain/types";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { CircuitoBadge } from "@/components/shared/circuito-badge";
import { AdjuntosPanel, ClipContador, useAdjuntos } from "@/components/shared/adjuntos-panel";
import { HistorialEntidad } from "@/components/shared/historial-entidad";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EditarClienteDialog } from "@/components/modulos/ventas/cliente-form";
import { PendientesTabla } from "@/components/modulos/ventas/pendientes-tabla";
import { CobranzaDialog } from "@/components/modulos/cuentas/cobranza-dialog";
import { EstadoCuenta } from "@/components/modulos/cuentas/estado-cuenta";
import { DescargarDesacopio } from "@/components/modulos/acopios/descargar-desacopio";
import { Impacto, medir } from "@/capacitacion";

export function ClienteFicha({ id }: { id: string }) {
  const db = useDb();
  const router = useRouter();
  const params = useSearchParams();
  const c = db.clientes.find((x) => x.id === id);
  const saldos = useSaldosClientes();
  const acopios = useAcopiosResumen().filter((a) => a.acopio.clienteId === id);
  const pendientes = usePendientes().filter((l) => l.clienteId === id);
  const rent = useRentabilidadNP();
  const verMargen = usePuede("margenes.ver");
  const puedeAcopiar = usePuede("acopios.editar");
  const puedeVender = usePuede("ventas.editar");
  const puedeCobrar = usePuede("ctacte.cobrar");
  const puedeEditar = usePuede("clientes.editar");
  const [tab, setTab] = React.useState(params.get("tab") ?? "resumen");
  const [editar, setEditar] = React.useState(false);
  const [cobrar, setCobrar] = React.useState(false);
  const adjCliente = useAdjuntos("CLIENTE", id);

  if (!c)
    return (
      <Card>
        <EmptyState titulo="Cliente inexistente" accion={<Button onClick={() => router.push("/clientes")}>Volver a clientes</Button>} />
      </Card>
    );

  const s = saldos.get(id) ?? { saldo: 0, vencido: 0, aVencer: 0, comprobantesPendientes: 0 };
  const vigentes = acopios.filter((a) => a.estado === "VIGENTE");
  const saldoAcopios = vigentes.reduce((a, x) => a + x.saldo, 0);
  const pendPesos = pendientes.reduce((a, l) => a + l.pendiente * l.precio, 0);
  const desde = Date.now() - 365 * 86_400_000;
  const nps = db.notasPedido.filter((n) => n.clienteId === id && n.estado !== "BORRADOR" && n.estado !== "ANULADA");
  const ult12 = nps.filter((n) => Date.parse(n.fecha) >= desde);
  const compras = ult12.reduce((a, n) => a + (rent.get(n.id)?.ingreso ?? 0), 0);
  const margen = ult12.reduce((a, n) => a + (rent.get(n.id)?.margenBruto ?? 0), 0);

  return (
    <div>
      <Link href="/clientes" className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Clientes
      </Link>
      <PageHeader
        titulo={c.nombreFantasia ?? c.razonSocial}
        descripcion={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono">{c.codigo}</span>·<span>{TIPO_CLIENTE_LABEL[c.tipo]}</span>·<span>CUIT {c.cuit || "—"}</span>·<span>{CONDICION_IVA_LABEL[c.condicionIVA]}</span>·
            <CircuitoBadge circuito={c.circuitoHabitual} />
            {c.contacto && <span>· Contacto {c.contacto}</span>}
            <ClipContador cantidad={adjCliente.length} onClick={() => setTab("adjuntos")} />
          </span>
        }
        acciones={
          <div className="flex flex-wrap gap-2" data-tour="cliente-acciones">
            {puedeAcopiar && <Button onClick={() => router.push(`/acopios/nuevo?cliente=${id}`)}><Boxes /> Nuevo acopio</Button>}
            {puedeVender && <Button variant="secondary" onClick={() => router.push(`/ventas/notas-pedido/nueva?cliente=${id}`)}><ShoppingCart /> Nueva venta</Button>}
            {puedeAcopiar && vigentes.length > 0 && <Button variant="secondary" onClick={() => router.push(`/ventas/notas-pedido/nueva?cliente=${id}&origen=acopio`)}><PackageOpen /> Retiro de acopio</Button>}
            {puedeCobrar && <Button variant="secondary" onClick={() => setCobrar(true)}><Wallet /> Registrar cobro</Button>}
            {puedeVender && <Button variant="secondary" onClick={() => router.push(`/ventas/cotizaciones?nuevo=1&cliente=${id}`)}><FileText /> Nueva cotización</Button>}
            {puedeEditar && <Button variant="ghost" onClick={() => setEditar(true)}><Pencil /> Editar</Button>}
          </div>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Saldo cuenta corriente" valor={formatMoney(s.saldo, { compact: Math.abs(s.saldo) >= 1_000_000 })} subtexto={s.vencido > 0.5 ? <span className="font-medium text-danger">{formatMoney(s.vencido, { compact: true })} vencido</span> : "sin deuda vencida"} onClick={() => setTab("ctacte")} />
        <KpiCard label="Saldo disponible en acopios" valor={formatMoney(saldoAcopios, { compact: Math.abs(saldoAcopios) >= 1_000_000 })} acento subtexto={`${vigentes.length} acopio${vigentes.length === 1 ? "" : "s"} vigente${vigentes.length === 1 ? "" : "s"}`} onClick={() => setTab("acopios")} />
        <KpiCard label="Pendiente de entrega" valor={formatMoney(pendPesos, { compact: pendPesos >= 1_000_000 })} subtexto={`${pendientes.length} líneas`} onClick={() => setTab("pendiente")} />
        <KpiCard label="Compras últimos 12 meses" valor={formatMoney(compras, { compact: compras >= 1_000_000 })} subtexto={verMargen ? `margen ${formatPercent(compras ? margen / compras : 0)}` : `${ult12.length} notas de pedido`} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="acopios">Acopios ({acopios.length})</TabsTrigger>
          <TabsTrigger value="ventas">Ventas ({nps.length})</TabsTrigger>
          <TabsTrigger value="pendiente">Pendiente de entrega ({pendientes.length})</TabsTrigger>
          <TabsTrigger value="ctacte">Cuenta corriente</TabsTrigger>
          <TabsTrigger value="remitos">Remitos</TabsTrigger>
          <TabsTrigger value="adjuntos">Adjuntos ({adjCliente.length})</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>
        <TabsContent value="resumen"><ResumenCliente id={id} /></TabsContent>
        <TabsContent value="acopios"><AcopiosCliente id={id} /></TabsContent>
        <TabsContent value="ventas"><VentasCliente id={id} /></TabsContent>
        <TabsContent value="pendiente"><PendientesTabla lineas={pendientes} vacio="El cliente no tiene entregas pendientes: lo que compre y no se lleve en el momento va a aparecer acá." /></TabsContent>
        <TabsContent value="ctacte"><EstadoCuenta tipo="cliente" id={id} embebido /></TabsContent>
        <TabsContent value="remitos"><RemitosCliente id={id} /></TabsContent>
        <TabsContent value="adjuntos"><Card className="p-4"><AdjuntosPanel entidadTipo="CLIENTE" entidadId={id} /></Card></TabsContent>
        <TabsContent value="historial">
          <Card className="p-4"><HistorialEntidad ids={[id, ...acopios.map((a) => a.acopio.id), ...nps.map((n) => n.id)]} /></Card>
        </TabsContent>
      </Tabs>
      <EditarClienteDialog cliente={c} open={editar} onOpenChange={setEditar} />
      <CobranzaDialog open={cobrar} onOpenChange={setCobrar} clienteId={id} />
    </div>
  );
}

function ResumenCliente({ id }: { id: string }) {
  const db = useDb();
  const c = db.clientes.find((x) => x.id === id)!;
  const obras = db.obras.filter((o) => o.clienteId === id);
  const editaCliente = usePuede("clientes.editar");
  const editaVentas = usePuede("ventas.editar");
  const puede = editaCliente || editaVentas;
  const [edit, setEdit] = React.useState<Partial<Obra> & { id?: string } | null>(null);
  const [notas, setNotas] = React.useState(c.notas ?? "");
  const guardarObra = async () => {
    if (!edit) return;
    const ejecutar = () => useStore.getState().guardarObra({ clienteId: id, nombre: edit.nombre ?? "", direccion: edit.direccion, localidad: edit.localidad, activa: edit.activa ?? true }, edit.id);
    const r = await medir(edit.id ? "editarObra" : "crearObra", { clienteId: id }, ejecutar);
    if (!r.ok) return toast.error(r.error);
    toast.success(edit.id ? "Obra actualizada" : "Obra creada");
    setEdit(null);
  };
  const dato = (l: string, v?: React.ReactNode) => (
    <div className="grid grid-cols-[140px_1fr] gap-2 border-b border-border py-2 text-[13px] last:border-0">
      <dt className="text-muted">{l}</dt>
      <dd className="text-ink">{v || "—"}</dd>
    </div>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader><CardTitle>Datos</CardTitle></CardHeader>
        <CardContent>
          <dl>
            {dato("Razón social", c.razonSocial)}
            {dato("Email", c.email)}
            {dato("Teléfono", c.telefono)}
            {dato("Dirección", `${c.direccion}, ${c.localidad}`)}
            {dato("Lista de precios", db.listasPrecios.find((l) => l.id === c.listaPreciosId)?.nombre)}
            {dato("Condición de pago", CONDICION_PAGO_LABEL[c.condicionPago])}
            {dato("Límite de crédito", c.limiteCredito ? formatMoney(c.limiteCredito, { decimals: false }) : "Contado")}
            {dato("Sucursal", db.sucursales.find((s) => s.id === c.sucursalPreferidaId)?.nombre)}
            {dato("Vendedor", db.usuarios.find((u) => u.id === c.vendedorId)?.nombre)}
          </dl>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Obras</CardTitle>
            {puede && <Button size="sm" variant="secondary" onClick={() => setEdit({ nombre: "", activa: true })}><Plus /> Nueva obra</Button>}
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-table">
              <thead className="bg-[#FAFAF8] text-[12px] text-muted">
                <tr>
                  <th className="h-9 px-3 text-left font-medium">Nombre</th>
                  <th className="h-9 px-3 text-left font-medium">Dirección</th>
                  <th className="h-9 px-3 text-left font-medium">Localidad</th>
                  <th className="h-9 px-3 text-left font-medium">Activa</th>
                  <th className="h-9 w-20" />
                </tr>
              </thead>
              <tbody>
                {[...obras, ...(edit && !edit.id ? [edit as Obra] : [])].map((o, i) => {
                  const enEdicion = edit && (edit.id ? edit.id === o.id : !o.id);
                  return (
                    <tr key={o.id ?? `nueva-${i}`} className="h-10 border-t border-border">
                      {enEdicion ? (
                        <>
                          <td className="px-2"><Input className="h-8" aria-label="Nombre de la obra" autoFocus value={edit.nombre ?? ""} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} /></td>
                          <td className="px-2"><Input className="h-8" aria-label="Dirección" value={edit.direccion ?? ""} onChange={(e) => setEdit({ ...edit, direccion: e.target.value })} /></td>
                          <td className="px-2"><Input className="h-8" aria-label="Localidad" value={edit.localidad ?? ""} onChange={(e) => setEdit({ ...edit, localidad: e.target.value })} /></td>
                          <td className="px-3"><Switch aria-label="Activa" checked={edit.activa ?? true} onCheckedChange={(v) => setEdit({ ...edit, activa: v })} /></td>
                          <td className="whitespace-nowrap px-1 text-right">
                            <Button size="icon-sm" variant="ghost" aria-label="Guardar obra" onClick={guardarObra}><Check /></Button>
                            <Button size="icon-sm" variant="ghost" aria-label="Cancelar" onClick={() => setEdit(null)}><X /></Button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 font-medium">{o.nombre}</td>
                          <td className="px-3 text-muted">{o.direccion ?? "—"}</td>
                          <td className="px-3 text-muted">{o.localidad ?? "—"}</td>
                          <td className="px-3">{o.activa ? <Badge variant="success">Activa</Badge> : <Badge>Inactiva</Badge>}</td>
                          <td className="px-1 text-right">{puede && <Button size="icon-sm" variant="ghost" aria-label={`Editar ${o.nombre}`} onClick={() => setEdit({ ...o })}><Pencil /></Button>}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
                {!obras.length && !edit && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-[13px] text-muted">
                      Todavía no tiene obras. Cada línea de venta y cada acopio se imputa a una obra.
                      {puede && <Button size="sm" variant="link" className="ml-1 text-[13px]" onClick={() => setEdit({ nombre: "", activa: true })}>Cargar la primera obra</Button>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {edit && !edit.id && <div className="border-t border-border p-3"><Impacto accion="crearObra" /></div>}
        </Card>
        <Card>
          <CardHeader><CardTitle>Notas internas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <textarea aria-label="Notas internas" value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} className="w-full rounded-control border border-border-strong bg-surface p-2.5 text-[13px] outline-none focus:border-ink" />
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="secondary"
                disabled={notas === (c.notas ?? "")}
                onClick={async () => {
                  const { id: _id, creadoEn: _c, actualizadoEn: _a, ...data } = c;
                  void _id; void _c; void _a;
                  const r = await medir("editarCliente", { clienteId: c.id }, () => useStore.getState().guardarCliente({ ...data, notas }, c.id));
                  if (r.ok) toast.success("Notas guardadas");
                  else toast.error(r.error);
                }}
              >
                Guardar notas
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AcopiosCliente({ id }: { id: string }) {
  const db = useDb();
  const router = useRouter();
  const puedeAcopiar = usePuede("acopios.editar");
  const filas = useAcopiosResumen().filter((a) => a.acopio.clienteId === id);
  type F = (typeof filas)[number];
  const t = filas.reduce((a, f) => ({ i: a.i + f.acopio.importe, r: a.r + f.retirado, s: a.s + f.saldo, p: a.p + f.pendienteEntrega }), { i: 0, r: 0, s: 0, p: 0 });
  const columnas: Column<F>[] = [
    { key: "n", header: "Número", footer: "Total", cell: (f) => <span className="whitespace-nowrap font-mono text-[12px]">{f.acopio.numero}</span> },
    { key: "c", header: "Circuito", cell: (f) => <CircuitoBadge circuito={f.acopio.circuito} corto /> },
    { key: "f", header: "Fecha", cell: (f) => <span className="text-muted">{formatDate(f.acopio.fechaCreacion)}</span> },
    { key: "v", header: "Vencimiento", cell: (f) => <span className={cn("whitespace-nowrap", f.estado === "VIGENTE" && f.diasParaVencer <= 30 ? "font-medium text-warning" : f.estado === "VENCIDO" ? "text-danger" : "text-muted")}>{formatDate(f.acopio.fechaVencimiento)}</span> },
    { key: "o", header: "Obras", cell: (f) => <span className="block min-w-[140px] text-[12px] text-muted">{db.obras.filter((o) => f.acopio.obraIds.includes(o.id)).map((o) => o.nombre).join(", ")}</span> },
    { key: "i", header: "Importe", align: "right", footer: <span className="tnum">{formatMoney(t.i, { decimals: false })}</span>, cell: (f) => <span className="tnum">{formatMoney(f.acopio.importe, { decimals: false })}</span> },
    { key: "r", header: "Retirado", align: "right", footer: <span className="tnum">{formatMoney(t.r, { decimals: false })}</span>, cell: (f) => <span className="tnum">{formatMoney(f.retirado, { decimals: false })}</span> },
    { key: "s", header: "Saldo disponible", align: "right", footer: <span className="tnum text-accent">{formatMoney(t.s)}</span>, cell: (f) => <span className="font-medium tnum">{formatMoney(f.saldo)}</span> },
    { key: "p", header: "Pendiente entrega", align: "right", footer: <span className="tnum">{formatMoney(t.p, { decimals: false })}</span>, cell: (f) => <span className="tnum">{formatMoney(f.pendienteEntrega, { decimals: false })}</span> },
    { key: "fp", header: "Forma de pago", cell: (f) => <span className="whitespace-nowrap text-muted">{FORMA_PAGO_LABEL[f.acopio.formaPago]}{f.acopio.formaPago === "CUENTA_CORRIENTE" && ` · pagado ${formatPercent(f.pagadoPct, { decimals: 0 })}`}</span> },
    { key: "e", header: "Estado", cell: (f) => <StatusBadge tipo="ACOPIO" estado={f.estado} /> },
    {
      key: "x",
      header: "",
      cell: (f) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => router.push(`/acopios/desacopio?acopio=${f.acopio.id}`)}>Estado de desacopio</Button>
          <DescargarDesacopio acopioId={f.acopio.id} size="sm" />
        </div>
      ),
    },
  ];
  return (
    <DataTable
      rows={filas}
      columns={columnas}
      getRowId={(f) => f.acopio.id}
      onRowClick={(f) => router.push(`/acopios/${f.acopio.id}`)}
      showFooter
      initialSort={{ key: "f", dir: "desc" }}
      empty={{
        icono: Boxes,
        titulo: "El cliente no tiene acopios",
        descripcion: "Si deja plata para retirar materiales a precio congelado, creale un acopio.",
        accion: puedeAcopiar ? <Button size="sm" onClick={() => router.push(`/acopios/nuevo?cliente=${id}`)}><Plus /> Nuevo acopio</Button> : undefined,
      }}
    />
  );
}

function VentasCliente({ id }: { id: string }) {
  const db = useDb();
  const router = useRouter();
  const puedeVender = usePuede("ventas.editar");
  const filas = db.notasPedido.filter((n) => n.clienteId === id && n.estado !== "BORRADOR");
  type F = (typeof filas)[number];
  const columnas: Column<F>[] = [
    { key: "n", header: "Número", sortable: true, sortValue: (n) => n.numero, cell: (n) => <span className="whitespace-nowrap font-mono text-[12px]">{n.numero}</span> },
    { key: "f", header: "Fecha", sortable: true, sortValue: (n) => n.fecha, cell: (n) => <span className="text-muted">{formatDate(n.fecha)}</span> },
    { key: "o", header: "Origen", cell: (n) => (n.origen === "ACOPIO" ? <Badge variant="accent">Acopio {db.acopios.find((a) => a.id === n.acopioId)?.numero.split(" ")[0]}</Badge> : <Badge>Nueva</Badge>) },
    { key: "fp", header: "Forma de pago", cell: (n) => <span className="whitespace-nowrap text-muted">{FORMA_PAGO_LABEL[n.formaPago]}</span> },
    { key: "ob", header: "Obra", cell: (n) => <span className="text-[12px] text-muted">{[...new Set(n.items.map((i) => db.obras.find((o) => o.id === i.obraId)?.nombre).filter(Boolean))].join(", ")}</span> },
    { key: "t", header: "Total", align: "right", sortable: true, sortValue: (n) => n.total, cell: (n) => <span className="tnum">{formatMoney(n.total, { decimals: false })}</span> },
    { key: "e", header: "Entregado", cell: (n) => <div className="flex min-w-[90px] items-center gap-2"><Progress value={porcentajeEntregado(n)} className="w-14" /><span className="text-[11px] text-muted tnum">{Math.round(porcentajeEntregado(n) * 100)} %</span></div> },
    { key: "s", header: "Estado", cell: (n) => <StatusBadge tipo="NP" estado={n.estado} /> },
    { key: "c", header: "Comprobante", cell: (n) => <span className="whitespace-nowrap font-mono text-[11px] text-muted">{db.comprobantes.find((c) => n.comprobanteIds.includes(c.id) && c.tipo === "FACTURA")?.numero ?? (n.origen === "ACOPIO" ? "Acopio" : "—")}</span> },
    { key: "r", header: "Remitos", cell: (n) => <span className="text-[12px] text-muted tnum">{n.remitoIds.length}</span> },
  ];
  return <DataTable rows={filas} columns={columnas} getRowId={(n) => n.id} onRowClick={(n) => router.push(`/ventas/notas-pedido/${n.id}`)} searchText={(n) => n.numero} initialSort={{ key: "f", dir: "desc" }} empty={{ icono: ShoppingCart, titulo: "Todavía no le vendiste nada", descripcion: "Las notas de pedido del cliente, nuevas o retiros de acopio, aparecen acá.", accion: puedeVender ? <Button size="sm" onClick={() => router.push(`/ventas/notas-pedido/nueva?cliente=${id}`)}><Plus /> Nueva venta</Button> : undefined }} />;
}

function RemitosCliente({ id }: { id: string }) {
  const db = useDb();
  const router = useRouter();
  const filas = db.remitos.filter((r) => r.clienteId === id);
  type F = (typeof filas)[number];
  const adj = (rid: string) => db.adjuntos.filter((a) => a.entidadTipo === "REMITO" && a.entidadId === rid).length;
  const columnas: Column<F>[] = [
    { key: "n", header: "Número", sortable: true, sortValue: (r) => r.numero, cell: (r) => <span className="whitespace-nowrap font-mono text-[12px]">{r.numero}</span> },
    { key: "f", header: "Fecha", sortable: true, sortValue: (r) => r.fecha, cell: (r) => <span className="text-muted">{formatDate(r.fecha)}</span> },
    { key: "t", header: "Tipo", cell: (r) => <span className="text-muted">{r.tipo === "DESACOPIO" ? "Desacopio" : r.tipo === "DEVOLUCION" ? "Devolución" : "Venta"}</span> },
    { key: "o", header: "Obra", cell: (r) => <span className="text-[12px] text-muted">{db.obras.find((o) => o.id === r.obraId)?.nombre ?? "—"}</span> },
    { key: "e", header: "Estado", cell: (r) => <StatusBadge tipo="REMITO" estado={r.estado} /> },
    { key: "fa", header: "Facturado", cell: (r) => (r.facturado ? <Badge variant="success">Sí</Badge> : <Badge>No</Badge>) },
    { key: "a", header: "Adjuntos", cell: (r) => <ClipContador cantidad={adj(r.id)} firmado={!!r.firmadoAdjuntoId} /> },
  ];
  return <DataTable rows={filas} columns={columnas} getRowId={(r) => r.id} onRowClick={(r) => router.push(`/remitos/${r.id}`)} searchText={(r) => r.numero} initialSort={{ key: "f", dir: "desc" }} empty={{ titulo: "Todavía no hay remitos", descripcion: "Los remitos se generan desde las notas de pedido del cliente cuando se entrega la mercadería." }} />;
}
