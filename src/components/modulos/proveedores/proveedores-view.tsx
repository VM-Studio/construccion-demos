"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Boxes, Download, Factory, FileUp, Mail, PackageCheck, Pencil, Plus, ShoppingCart, Wallet } from "lucide-react";
import { useStore } from "@/store";
import { medir } from "@/capacitacion";
import { useAcopiosProveedorResumen, useDb, usePuede, useSaldosProveedores } from "@/store/selectors";
import type { OrdenCompra, Proveedor, RecepcionMercaderia } from "@/domain/types";
import { CONDICION_PAGO_LABEL, TIPO_PROVEEDOR_LABEL, opciones } from "@/domain/estados";
import { variacionCosto } from "@/domain/costos";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { CircuitoBadge } from "@/components/shared/circuito-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { VacioGuiado } from "@/components/shared/vacio-guiado";
import { ImportarCsvDialog } from "@/components/shared/importar-csv-dialog";
import { AdjuntosPanel, ClipContador, useAdjuntos } from "@/components/shared/adjuntos-panel";
import { HistorialEntidad } from "@/components/shared/historial-entidad";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatMoney, formatPercent, formatQty } from "@/lib/format";
import { diaLocal } from "@/lib/periodos";
import { aCSV, cn, descargarArchivo } from "@/lib/utils";
import { EstadoCuenta } from "@/components/modulos/cuentas/estado-cuenta";
import { PagoDialog } from "@/components/modulos/cuentas/pago-dialog";
import { RecepcionDialog } from "@/components/modulos/compras/recepcion-dialog";
import { ProveedorDialog } from "./proveedor-form";
import { AcopiosProveedorTabla } from "./acopios-proveedor";

const ABIERTAS = new Set(["CONFIRMADA", "RECIBIDA_PARCIAL"]);
const pendienteOC = (o: OrdenCompra) => (ABIERTAS.has(o.estado) ? o.items.reduce((a, i) => a + Math.max(0, i.cantidadPedida - i.cantidadRecibida) * i.costoUnitario * (1 - (i.descuentoPct || 0) / 100), 0) : 0);

interface ResumenProveedor {
  p: Proveedor;
  saldo: number;
  vencido: number;
  acopios: number;
  faltaRetirar: number;
  pendienteEntrega: number;
  compras12: number;
}

/** Resumen por proveedor: le debemos, acopios, pendiente de entrega y compras. */
export function useResumenProveedores(): Map<string, ResumenProveedor> {
  const db = useDb();
  const saldos = useSaldosProveedores();
  const acps = useAcopiosProveedorResumen();
  return React.useMemo(() => {
    const desde = Date.now() - 365 * 86_400_000;
    const out = new Map<string, ResumenProveedor>();
    for (const p of db.proveedores) out.set(p.id, { p, saldo: saldos.get(p.id)?.saldo ?? 0, vencido: saldos.get(p.id)?.vencido ?? 0, acopios: 0, faltaRetirar: 0, pendienteEntrega: 0, compras12: 0 });
    for (const a of acps) {
      if (a.estado !== "VIGENTE") continue;
      const r = out.get(a.acopio.proveedorId);
      if (r) {
        r.acopios++;
        r.faltaRetirar += a.pendientePesos;
      }
    }
    for (const o of db.ordenesCompra) {
      const r = out.get(o.proveedorId);
      if (!r) continue;
      if (o.origen !== "ACOPIO") r.pendienteEntrega += pendienteOC(o);
      if (Date.parse(o.fechaEmision) >= desde && o.estado !== "BORRADOR" && o.estado !== "CANCELADA" && o.origen !== "ACOPIO") r.compras12 += o.total;
    }
    for (const c of db.comprobantes) if (c.acopioProveedorId && Date.parse(c.fecha) >= desde) out.get(c.proveedorId!)!.compras12 += c.total;
    return out;
  }, [db, saldos, acps]);
}

export function ProveedoresView() {
  const db = useDb();
  const router = useRouter();
  const res = useResumenProveedores();
  const params = useSearchParams();
  const puedeCrear = usePuede("proveedores.editar");
  const nuevoParam = params.get("nuevo") === "1";
  const [nuevo, setNuevo] = React.useState(nuevoParam);
  const [importar, setImportar] = React.useState(false);
  React.useEffect(() => {
    if (nuevoParam) setNuevo(true);
  }, [nuevoParam]);
  const cerrarNuevo = (v: boolean) => {
    setNuevo(v);
    if (!v && nuevoParam) router.replace("/proveedores", { scroll: false });
  };
  const [tipo, setTipo] = React.useState("");
  const [un, setUn] = React.useState("");
  const [conAcopio, setConAcopio] = React.useState(false);
  const [conVencido, setConVencido] = React.useState(false);
  const [conPendiente, setConPendiente] = React.useState(false);
  const filas = [...res.values()].filter((r) => (!tipo || r.p.tipo === tipo) && (!un || r.p.unidadNegocioIds.includes(un)) && (!conAcopio || r.acopios > 0) && (!conVencido || r.vencido > 0.5) && (!conPendiente || r.pendienteEntrega > 0.5));
  const t = filas.reduce((a, r) => ({ s: a.s + r.saldo, v: a.v + r.vencido, f: a.f + r.faltaRetirar, pe: a.pe + r.pendienteEntrega, c: a.c + r.compras12 }), { s: 0, v: 0, f: 0, pe: 0, c: 0 });
  const columnas: Column<ResumenProveedor>[] = [
    { key: "cod", header: "Código", sortable: true, sortValue: (r) => r.p.codigo, cell: (r) => <span className="font-mono text-[12px]">{r.p.codigo}</span> },
    { key: "rs", header: "Proveedor", sortable: true, sortValue: (r) => r.p.razonSocial, footer: `${filas.length} proveedores`, cell: (r) => <span className="block min-w-[200px] font-medium">{r.p.razonSocial}</span> },
    { key: "t", header: "Tipo", cell: (r) => <span className="whitespace-nowrap text-muted">{TIPO_PROVEEDOR_LABEL[r.p.tipo]}</span>, hideOnMobile: true },
    { key: "cuit", header: "CUIT", cell: (r) => <span className="whitespace-nowrap font-mono text-[12px] text-muted">{r.p.cuit}</span>, hideOnMobile: true },
    { key: "ci", header: "Circuito", cell: (r) => <CircuitoBadge circuito={r.p.circuitoHabitual} corto /> },
    { key: "co", header: "Contacto", cell: (r) => <span className="whitespace-nowrap text-muted">{r.p.contacto}</span>, hideOnMobile: true },
    { key: "pl", header: "Plazo", align: "right", cell: (r) => <span className="text-muted tnum">{r.p.plazoEntregaDias} d</span>, hideOnMobile: true },
    { key: "cp", header: "Condición", cell: (r) => <span className="whitespace-nowrap text-muted">{CONDICION_PAGO_LABEL[r.p.condicionPago]}</span>, hideOnMobile: true },
    { key: "s", header: "Le debemos", align: "right", sortable: true, sortValue: (r) => r.saldo, footer: <span className="tnum">{formatMoney(t.s, { decimals: false })}</span>, cell: (r) => <span className={cn("tnum", r.vencido > 0.5 && "font-medium text-danger")} title={r.vencido > 0.5 ? `${formatMoney(r.vencido)} vencido` : undefined}>{formatMoney(r.saldo, { decimals: false })}</span> },
    { key: "a", header: "Acopios vigentes", align: "right", sortable: true, sortValue: (r) => r.faltaRetirar, footer: <span className="tnum">{formatMoney(t.f, { decimals: false })}</span>, cell: (r) => (r.acopios ? <span className="whitespace-nowrap tnum">{r.acopios} · {formatMoney(r.faltaRetirar, { decimals: false })} por retirar</span> : <span className="text-disabled">—</span>) },
    { key: "pe", header: "Pendiente de entrega", align: "right", sortable: true, sortValue: (r) => r.pendienteEntrega, footer: <span className="tnum">{formatMoney(t.pe, { decimals: false })}</span>, cell: (r) => (r.pendienteEntrega > 0.5 ? <span className="tnum">{formatMoney(r.pendienteEntrega, { decimals: false })}</span> : <span className="text-disabled">—</span>) },
    { key: "c", header: "Compras 12 meses", align: "right", sortable: true, sortValue: (r) => r.compras12, footer: <span className="tnum">{formatMoney(t.c, { decimals: false })}</span>, cell: (r) => <span className="tnum">{formatMoney(r.compras12, { decimals: false })}</span> },
    { key: "ac", header: "Activo", cell: (r) => (r.p.activo ? <Badge variant="success">Activo</Badge> : <Badge>Inactivo</Badge>), hideOnMobile: true },
  ];
  const check = (label: string, v: boolean, set: (b: boolean) => void) => (
    <label className="flex h-8 items-center gap-2 whitespace-nowrap rounded-control border border-border px-2.5 text-[12px] text-muted">
      <Checkbox checked={v} onCheckedChange={(x) => set(!!x)} aria-label={label} /> {label}
    </label>
  );
  return (
    <>
      <PageHeader
        titulo="Proveedores"
        descripcion="Cuánta plata le debemos a cada uno y cuántos materiales nos falta retirar."
        acciones={
          <>
            <Button variant="secondary" onClick={() => descargarArchivo("proveedores.csv", aCSV(["Código", "Razón social", "Tipo", "CUIT", "Circuito", "Le debemos", "Vencido", "Acopios vigentes", "Por retirar $", "Pendiente de entrega $", "Compras 12 meses"], filas.map((r) => [r.p.codigo, r.p.razonSocial, TIPO_PROVEEDOR_LABEL[r.p.tipo], r.p.cuit, `AC${r.p.circuitoHabitual}`, Math.round(r.saldo), Math.round(r.vencido), r.acopios, Math.round(r.faltaRetirar), Math.round(r.pendienteEntrega), Math.round(r.compras12)])))}><Download /> Exportar</Button>
            {puedeCrear && <Button variant="secondary" onClick={() => setImportar(true)}><FileUp /> Importar desde CSV</Button>}
            {puedeCrear && <Button onClick={() => setNuevo(true)}><Plus /> Nuevo proveedor</Button>}
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Le debemos" valor={formatMoney(t.s, { compact: true })} acento subtexto={t.v > 0 ? <span className="text-danger">{formatMoney(t.v, { compact: true })} vencido</span> : "sin deuda vencida"} />
        <KpiCard label="Nos falta retirar" valor={formatMoney(t.f, { compact: true })} subtexto="de acopios con proveedores" onClick={() => router.push("/proveedores/pendientes")} />
        <KpiCard label="Pendiente de entrega" valor={formatMoney(t.pe, { compact: true })} subtexto="OC confirmadas sin recibir" />
        <KpiCard label="Compras últimos 12 meses" valor={formatMoney(t.c, { compact: true })} />
      </div>
      <DataTable
        rows={filas}
        columns={columnas}
        getRowId={(r) => r.p.id}
        onRowClick={(r) => router.push(`/proveedores/${r.p.id}`)}
        searchText={(r) => `${r.p.codigo} ${r.p.razonSocial} ${r.p.cuit} ${r.p.contacto}`}
        initialSort={{ key: "rs", dir: "asc" }}
        showFooter
        empty={
          db.proveedores.length ? (
            { icono: Factory, titulo: "No hay proveedores para el filtro" }
          ) : (
            <VacioGuiado pagina="proveedores" icono={Factory} puedeAccion={puedeCrear} onAccion={() => setNuevo(true)} extra={puedeCrear ? <Button size="sm" variant="secondary" onClick={() => setImportar(true)}><FileUp /> Importar desde CSV</Button> : undefined} />
          )
        }
        filters={
          <>
            <div className="w-[170px]"><Select size="sm" aria-label="Tipo" value={tipo} onValueChange={setTipo} options={[{ value: "", label: "Todos los tipos" }, ...opciones(TIPO_PROVEEDOR_LABEL)]} /></div>
            <div className="w-[170px]"><Select size="sm" aria-label="Unidad de negocio" value={un} onValueChange={setUn} options={[{ value: "", label: "Todas las unidades" }, ...db.unidadesNegocio.map((u) => ({ value: u.id, label: u.nombre }))]} /></div>
            {check("Con acopio vigente", conAcopio, setConAcopio)}
            {check("Con deuda vencida", conVencido, setConVencido)}
            {check("Con pendiente de entrega", conPendiente, setConPendiente)}
          </>
        }
      />
      <ProveedorDialog open={nuevo} onOpenChange={cerrarNuevo} />
      <ImportarCsvDialog tipo="proveedores" open={importar} onOpenChange={setImportar} />
    </>
  );
}

export function ProveedorFicha({ id }: { id: string }) {
  const db = useDb();
  const router = useRouter();
  const r = useResumenProveedores().get(id);
  const puedeAcopio = usePuede("acopiosProveedor.editar");
  const puedeOC = usePuede("compras.editar");
  const puedePagar = usePuede("ctacte.pagar");
  const puedeEditar = usePuede("proveedores.editar");
  const [editar, setEditar] = React.useState(false);
  const [pagar, setPagar] = React.useState(false);
  const adjuntos = useAdjuntos("PROVEEDOR", id);
  if (!r)
    return (
      <Card>
        <EmptyState titulo="Proveedor inexistente" accion={<Button onClick={() => router.push("/proveedores")}>Volver</Button>} />
      </Card>
    );
  const p = r.p;
  const ocs = db.ordenesCompra.filter((o) => o.proveedorId === id);
  return (
    <div>
      <Link href="/proveedores" className="mb-3 inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Proveedores
      </Link>
      <PageHeader
        titulo={p.razonSocial}
        descripcion={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono">{p.codigo}</span>· {TIPO_PROVEEDOR_LABEL[p.tipo]} · CUIT {p.cuit} · <CircuitoBadge circuito={p.circuitoHabitual} /> · {p.contacto} · {p.telefono}
            <ClipContador cantidad={adjuntos.length} />
          </span>
        }
        acciones={
          <>
            {puedeAcopio && <Button onClick={() => router.push(`/proveedores/acopios/nuevo?proveedor=${id}`)}><Boxes /> Nuevo acopio con proveedor</Button>}
            {puedeOC && <Button variant="secondary" onClick={() => router.push(`/compras/oc/nueva?proveedor=${id}`)}><ShoppingCart /> Nueva orden de compra</Button>}
            {puedePagar && <Button variant="secondary" onClick={() => setPagar(true)}><Wallet /> Registrar pago</Button>}
            {puedeEditar && <Button variant="ghost" onClick={() => setEditar(true)}><Pencil /> Editar</Button>}
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4" data-tour="proveedor-kpis">
        <KpiCard label="Le debemos" valor={formatMoney(r.saldo, { compact: Math.abs(r.saldo) >= 1_000_000 })} acento subtexto={r.vencido > 0.5 ? <span className="font-medium text-danger">{formatMoney(r.vencido, { compact: true })} vencido</span> : "sin deuda vencida"} />
        <KpiCard label="Nos falta retirar" valor={formatMoney(r.faltaRetirar, { compact: r.faltaRetirar >= 1_000_000 })} subtexto={`${r.acopios} acopio${r.acopios === 1 ? "" : "s"} vigente${r.acopios === 1 ? "" : "s"} · a costo congelado`} />
        <KpiCard label="Pendiente de entrega" valor={formatMoney(r.pendienteEntrega, { compact: r.pendienteEntrega >= 1_000_000 })} subtexto="OC confirmadas sin recibir" />
        <KpiCard label="Compras 12 meses" valor={formatMoney(r.compras12, { compact: true })} />
      </div>
      <Tabs defaultValue="resumen">
        <TabsList className="mb-3 flex-wrap">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="compras">Compras ({ocs.length})</TabsTrigger>
          <TabsTrigger value="acopios">Acopios</TabsTrigger>
          <TabsTrigger value="pendiente">Pendiente de entrega</TabsTrigger>
          <TabsTrigger value="ctacte">Cuenta corriente</TabsTrigger>
          <TabsTrigger value="remitos">Remitos del proveedor</TabsTrigger>
          <TabsTrigger value="adjuntos">Adjuntos ({adjuntos.length})</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>
        <TabsContent value="resumen"><ResumenProveedorTab p={p} /></TabsContent>
        <TabsContent value="compras"><ComprasProveedor id={id} /></TabsContent>
        <TabsContent value="acopios">
          <AcopiosProveedorTabla
            filtro={(a) => a.acopio.proveedorId === id}
            vacio={
              <EmptyState
                icono={Boxes}
                titulo="Sin acopios con este proveedor"
                descripcion="Plata adelantada (o en cuenta corriente) a cambio de costo congelado: después retirás con órdenes de compra sin pagar de nuevo."
                accion={puedeAcopio ? <Button size="sm" onClick={() => router.push(`/proveedores/acopios/nuevo?proveedor=${id}`)}><Plus /> Nuevo acopio con proveedor</Button> : undefined}
              />
            }
          />
        </TabsContent>
        <TabsContent value="pendiente"><PendienteProveedor id={id} /></TabsContent>
        <TabsContent value="ctacte"><EstadoCuenta tipo="proveedor" id={id} embebido /></TabsContent>
        <TabsContent value="remitos"><RemitosProveedor id={id} /></TabsContent>
        <TabsContent value="adjuntos"><Card className="p-4"><AdjuntosPanel entidadTipo="PROVEEDOR" entidadId={id} /></Card></TabsContent>
        <TabsContent value="historial"><Card className="p-4"><HistorialEntidad ids={[id, ...ocs.map((o) => o.id), ...db.acopiosProveedor.filter((a) => a.proveedorId === id).map((a) => a.id)]} /></Card></TabsContent>
      </Tabs>
      <ProveedorDialog proveedor={p} open={editar} onOpenChange={setEditar} />
      <PagoDialog open={pagar} onOpenChange={setPagar} proveedorId={id} />
    </div>
  );
}

function ResumenProveedorTab({ p }: { p: Proveedor }) {
  const db = useDb();
  const verCostos = usePuede("margenes.ver");
  const prods = db.productos.filter((x) => x.proveedorHabitualId === p.id);
  const variacion = (pid: string) => {
    const movs = db.movimientos.filter((m) => m.productoId === pid && m.tipo === "INGRESO_COMPRA").sort((a, b) => a.fecha.localeCompare(b.fecha));
    return movs.length >= 2 ? variacionCosto(movs.at(-2)!.costoUnitario, movs.at(-1)!.costoUnitario) : null;
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <Card className="p-4 text-[13px]">
        <dl className="space-y-2">
          {[
            ["Email", p.email],
            ["Dirección", p.direccion],
            ["Plazo de entrega", `${p.plazoEntregaDias} días`],
            ["Condición de pago", CONDICION_PAGO_LABEL[p.condicionPago]],
            ["Unidades de negocio", db.unidadesNegocio.filter((u) => p.unidadNegocioIds.includes(u.id)).map((u) => u.nombre).join(", ")],
          ].map(([l, v]) => (
            <div key={l} className="grid grid-cols-[130px_1fr] gap-2"><dt className="text-muted">{l}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        {p.notas && <p className="mt-3 border-t border-border pt-3 text-muted">{p.notas}</p>}
      </Card>
      <Card>
        <div className="border-b border-border px-4 py-3 text-[14px] font-semibold">Productos que provee ({prods.length})</div>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-table">
            <thead className="sticky top-0 bg-[#FAFAF8] text-[12px] text-muted">
              <tr><th className="h-9 px-3 text-left font-medium">Artículo</th>{verCostos && <th className="h-9 px-3 text-right font-medium">Último costo</th>}<th className="h-9 px-3 text-right font-medium">Fecha</th><th className="h-9 px-3 text-right font-medium">Variación</th></tr>
            </thead>
            <tbody>
              {!prods.length && (
                <tr><td colSpan={verCostos ? 4 : 3} className="px-3 py-6 text-center text-[13px] text-muted">Ningún artículo tiene a este proveedor como habitual. Se asigna en la ficha del artículo y sirve para sugerir reposición en las órdenes de compra.</td></tr>
              )}
              {prods.map((x) => {
                const v = variacion(x.id);
                return (
                  <tr key={x.id} className="h-9 border-t border-border">
                    <td className="px-3"><Link href={`/productos?id=${x.id}`} className="hover:underline"><span className="mr-2 font-mono text-[11px] text-muted">{x.codigo}</span>{x.nombre}</Link></td>
                    {verCostos && <td className="px-3 text-right tnum">{formatMoney(x.costoUltimo)}</td>}
                    <td className="px-3 text-right text-muted">{formatDate(x.fechaUltimoCosto)}</td>
                    <td className={cn("px-3 text-right tnum", v !== null && v > 0.03 ? "text-danger" : "text-muted")}>{v === null ? "—" : formatPercent(v, { signo: true })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

const pctRecibido = (o: OrdenCompra) => {
  const tot = o.items.reduce((a, i) => a + i.cantidadPedida, 0);
  return tot ? o.items.reduce((a, i) => a + Math.min(i.cantidadPedida, i.cantidadRecibida), 0) / tot : 0;
};

function ComprasProveedor({ id }: { id: string }) {
  const db = useDb();
  const router = useRouter();
  const puedeOC = usePuede("compras.editar");
  const ocs = db.ordenesCompra.filter((o) => o.proveedorId === id);
  const recs = db.recepciones.filter((r) => ocs.some((o) => o.id === r.ordenCompraId));
  const columnas: Column<OrdenCompra>[] = [
    { key: "n", header: "Número", sortable: true, sortValue: (o) => o.numero, cell: (o) => <span className="whitespace-nowrap font-mono text-[12px]">{o.numero}</span> },
    { key: "f", header: "Fecha", sortable: true, sortValue: (o) => o.fechaEmision, cell: (o) => <span className="text-muted">{formatDate(o.fechaEmision)}</span> },
    { key: "o", header: "Origen", cell: (o) => (o.origen === "ACOPIO" ? <Badge variant="accent">Acopio</Badge> : <Badge>Nueva</Badge>) },
    { key: "d", header: "Depósito", cell: (o) => <span className="text-muted">{db.depositos.find((d) => d.id === o.depositoDestinoId)?.nombre}</span> },
    { key: "t", header: "Total", align: "right", cell: (o) => <span className="tnum">{formatMoney(o.total, { decimals: false })}</span> },
    { key: "r", header: "Recibido", cell: (o) => <div className="flex items-center gap-2"><Progress value={pctRecibido(o)} className="w-14" /><span className="text-[11px] text-muted tnum">{Math.round(pctRecibido(o) * 100)} %</span></div> },
    { key: "e", header: "Estado", cell: (o) => <StatusBadge tipo="OC" estado={o.estado} /> },
    { key: "c", header: "Comprobante", cell: (o) => <span className="font-mono text-[11px] text-muted">{recs.filter((r) => r.ordenCompraId === o.id).map((r) => db.comprobantes.find((c) => c.id === r.comprobanteId)?.numero).filter(Boolean).join(", ") || (o.origen === "ACOPIO" ? "En acopio" : "—")}</span> },
  ];
  return (
    <div className="space-y-4">
      <DataTable
        rows={ocs}
        columns={columnas}
        getRowId={(o) => o.id}
        onRowClick={(o) => router.push(`/compras/oc/${o.id}`)}
        initialSort={{ key: "f", dir: "desc" }}
        empty={{
          icono: ShoppingCart,
          titulo: "Todavía no le hiciste órdenes de compra",
          descripcion: "Con una orden de compra le pedís mercadería; al registrar su ingreso sube el stock y nace la deuda con el proveedor.",
          accion: puedeOC ? <Button size="sm" onClick={() => router.push(`/compras/oc/nueva?proveedor=${id}`)}><Plus /> Nueva orden de compra</Button> : undefined,
        }}
      />
      <Card>
        <div className="border-b border-border px-4 py-3 text-[14px] font-semibold">Recepciones ({recs.length})</div>
        {!recs.length && <p className="px-4 py-6 text-center text-[13px] text-muted">Sin ingresos de mercadería todavía. Aparecen cuando registrás la recepción de una orden de compra confirmada.</p>}
        <ul className="divide-y divide-border">
          {recs.sort((a, b) => b.fecha.localeCompare(a.fecha)).map((r) => (
            <li key={r.id}>
              <Link href={`/compras/recepciones?id=${r.id}`} className="flex items-center gap-3 px-4 py-2 text-[13px] hover:bg-subtle">
                <span className="font-mono text-[12px]">{r.numero}</span>
                <span className="flex-1 text-muted">{formatDate(r.fecha)} · remito {r.remitoProveedor} · {db.ordenesCompra.find((o) => o.id === r.ordenCompraId)?.numero}</span>
                <span className="text-muted">{r.items.length} ítems</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

interface LineaPendOC {
  key: string;
  oc: OrdenCompra;
  productoId: string;
  pendiente: number;
  costo: number;
}

function PendienteProveedor({ id }: { id: string }) {
  const db = useDb();
  const router = useRouter();
  const puedeRecibir = usePuede("compras.recibir");
  const puedeEditar = usePuede("compras.editar");
  const [recibir, setRecibir] = React.useState<string | null>(null);
  const [reclamo, setReclamo] = React.useState<OrdenCompra | null>(null);
  const hoy = diaLocal(new Date());
  const lineas: LineaPendOC[] = db.ordenesCompra
    .filter((o) => o.proveedorId === id && ABIERTAS.has(o.estado))
    .flatMap((o) => o.items.filter((i) => i.cantidadPedida > i.cantidadRecibida).map((i) => ({ key: i.id, oc: o, productoId: i.productoId, pendiente: i.cantidadPedida - i.cantidadRecibida, costo: i.costoUnitario })));
  const prod = (pid: string) => db.productos.find((p) => p.id === pid);
  const columnas: Column<LineaPendOC>[] = [
    { key: "p", header: "Artículo", cell: (l) => <span><span className="mr-1.5 font-mono text-[11px] text-muted">{prod(l.productoId)?.codigo}</span>{prod(l.productoId)?.nombre}</span> },
    { key: "q", header: "Pendiente", align: "right", cell: (l) => <span className="font-medium tnum">{formatQty(l.pendiente, prod(l.productoId)?.unidad ?? "UN")}</span> },
    { key: "oc", header: "OC", cell: (l) => <Link href={`/compras/oc/${l.oc.id}`} className="font-mono text-[12px] hover:underline">{l.oc.numero}</Link> },
    { key: "f", header: "Fecha estimada", cell: (l) => <span className={cn(diaLocal(l.oc.fechaEntregaEstimada) < hoy ? "font-medium text-danger" : "text-muted")}>{formatDate(l.oc.fechaEntregaEstimada)}</span> },
    { key: "d", header: "Depósito destino", cell: (l) => <span className="text-muted">{db.depositos.find((d) => d.id === l.oc.depositoDestinoId)?.nombre}</span> },
    { key: "r", header: "Reclamos", align: "right", cell: (l) => <span className="text-muted tnum">{l.oc.reclamos?.length || "—"}</span> },
    {
      key: "x",
      header: "",
      cell: (l) => (
        <div className="flex justify-end gap-1">
          {puedeRecibir && <Button size="sm" variant="secondary" onClick={() => setRecibir(l.oc.id)}><PackageCheck /> Registrar recepción</Button>}
          {puedeEditar && <Button size="sm" variant="ghost" onClick={() => setReclamo(l.oc)}><Mail /> Reclamar</Button>}
        </div>
      ),
    },
  ];
  return (
    <>
      <DataTable rows={lineas} columns={columnas} getRowId={(l) => l.key} empty={{
          icono: PackageCheck,
          titulo: "El proveedor no tiene entregas pendientes",
          descripcion: "Acá aparece lo que falta recibir de las órdenes de compra confirmadas, con su fecha estimada, para registrar el ingreso o reclamar.",
          accion: puedeEditar ? <Button size="sm" variant="secondary" onClick={() => router.push(`/compras/oc/nueva?proveedor=${id}`)}><Plus /> Nueva orden de compra</Button> : undefined,
        }} />
      <RecepcionDialog ordenCompraId={recibir} open={!!recibir} onOpenChange={(v) => !v && setRecibir(null)} />
      {reclamo && <ReclamoDialog oc={reclamo} onClose={() => setReclamo(null)} />}
    </>
  );
}

function ReclamoDialog({ oc, onClose }: { oc: OrdenCompra; onClose: () => void }) {
  const db = useDb();
  const prov = db.proveedores.find((p) => p.id === oc.proveedorId);
  const [texto, setTexto] = React.useState(`Hola ${prov?.contacto ?? ""}, te escribimos por la orden de compra ${oc.numero} con entrega estimada el ${formatDate(oc.fechaEntregaEstimada)}: todavía no la recibimos completa. ¿Nos confirmás una fecha de entrega? Gracias. ${db.config.empresa.empresa}`);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="md" title={`Reclamar ${oc.numero}`} description={`Para: ${prov?.email ?? ""} · queda registrado en el historial`} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={async () => { const r = await medir("reclamarOC", { proveedorId: oc.proveedorId }, () => useStore.getState().reclamarOC(oc.id, texto)); if (r.ok) { toast.success("Reclamo registrado", { description: "Plantilla lista para enviar por mail." }); onClose(); } else toast.error(r.error); }}><Mail /> Registrar reclamo</Button></>}>
        <Textarea aria-label="Mensaje del reclamo" rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} />
      </DialogContent>
    </Dialog>
  );
}

function RemitosProveedor({ id }: { id: string }) {
  const db = useDb();
  const router = useRouter();
  const recs = db.recepciones.filter((r) => db.ordenesCompra.find((o) => o.id === r.ordenCompraId)?.proveedorId === id);
  const columnas: Column<RecepcionMercaderia>[] = [
    { key: "n", header: "Recepción", cell: (r) => <span className="font-mono text-[12px]">{r.numero}</span> },
    { key: "rem", header: "Remito del proveedor", cell: (r) => <span className="font-mono text-[12px]">{r.remitoProveedor}</span> },
    { key: "f", header: "Fecha", sortable: true, sortValue: (r) => r.fecha, cell: (r) => <span className="text-muted">{formatDate(r.fecha)}</span> },
    { key: "fc", header: "Factura", cell: (r) => <span className="font-mono text-[11px] text-muted">{db.comprobantes.find((c) => c.id === r.comprobanteId)?.numero ?? "Acopio"}</span> },
    { key: "a", header: "Adjuntos", cell: (r) => <ClipContador cantidad={db.adjuntos.filter((a) => a.entidadTipo === "RECEPCION" && a.entidadId === r.id).length} /> },
  ];
  return <DataTable rows={recs} columns={columnas} getRowId={(r) => r.id} onRowClick={(r) => router.push(`/compras/recepciones?id=${r.id}`)} initialSort={{ key: "f", dir: "desc" }} empty={{ icono: PackageCheck, titulo: "Sin remitos del proveedor", descripcion: "Cada ingreso de mercadería guarda el número de remito del proveedor y su foto o PDF adjunto." }} />;
}

