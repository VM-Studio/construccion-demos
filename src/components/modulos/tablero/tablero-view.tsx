"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowRight, Boxes, ChevronRight, DollarSign, Factory, Landmark, PackageCheck, PackageX, Percent, ShoppingCart, Timer, Truck, Warehouse } from "lucide-react";
import { useDb, usePuede, useSucursalActiva, useSaldosClientes, useAcopiosResumen, useAcopiosProveedorResumen, usePendientes, usePosiciones, useUnidadNegocio, useUsuario, useVeCircuito2 } from "@/store/selectors";
import { minutosPreparacion, promedio } from "@/domain/despachos";
import { useAlertas } from "@/store/alertas";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { DateRangePicker } from "@/components/shared/filter-bar";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { MoneyText } from "@/components/shared/money-text";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Segmented } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { VentasMargenChart, BarrasAgrupadasChart, COLORES } from "@/components/charts";
import { periodoAnterior, periodoDesdePreset, variacion, diaLocal, type Periodo } from "@/lib/periodos";
import { margenPeriodo, rankingProductos, serieVentasMargen, ventasFacturadas, type Agrupacion, type FiltroMetricas } from "@/domain/metricas";
import { formatMoney, formatPercent, formatQty, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const ETIQUETA_PERIODO: Record<string, string> = { HOY: "ayer", "7D": "7 días previos", MES: "mes pasado", MES_ANTERIOR: "mes previo", PERSONALIZADO: "período anterior" };

export function TableroView() {
  const router = useRouter();
  const db = useDb();
  const usuario = useUsuario();
  const sucursalId = useSucursalActiva();
  const un = useUnidadNegocio();
  const veC2 = useVeCircuito2();
  const filtro: FiltroMetricas = React.useMemo(() => ({ sucursalId, unidadNegocioId: un, circuito2: veC2 }), [sucursalId, un, veC2]);
  const [periodo, setPeriodo] = React.useState<Periodo>(() => periodoDesdePreset("MES"));
  const anterior = React.useMemo(() => periodoAnterior(periodo), [periodo]);
  const verMargen = usePuede("margenes.ver");
  const verCtaCte = usePuede("ctacte.ver");
  const verVentas = usePuede("ventas.ver");
  const verAcopios = usePuede("acopios.ver");
  const alertas = useAlertas();
  const saldos = useSaldosClientes();
  const acopios = useAcopiosResumen();
  const acopiosProv = useAcopiosProveedorResumen();
  const verProveedores = usePuede("proveedores.ver");

  const ventas = React.useMemo(() => ventasFacturadas(db, periodo, filtro), [db, periodo, filtro]);
  const ventasAnt = React.useMemo(() => ventasFacturadas(db, anterior, filtro), [db, anterior, filtro]);
  const margen = React.useMemo(() => margenPeriodo(db, periodo, filtro), [db, periodo, filtro]);
  const margenAnt = React.useMemo(() => margenPeriodo(db, anterior, filtro), [db, anterior, filtro]);
  const prov = React.useMemo(() => {
    const vig = acopiosProv.filter((a) => a.estado === "VIGENTE" || a.estado === "VENCIDO");
    return { retirar: vig.reduce((s, a) => s + a.pendientePesos, 0), deuda: vig.reduce((s, a) => s + a.deuda, 0), n: vig.length };
  }, [acopiosProv]);

  const porCobrar = React.useMemo(() => {
    let total = 0;
    let vencido = 0;
    for (const c of db.clientes) {
      if (sucursalId && c.sucursalPreferidaId !== sucursalId) continue;
      const s = saldos.get(c.id);
      if (!s) continue;
      total += s.saldo;
      vencido += s.vencido;
    }
    return { total, vencido };
  }, [db.clientes, saldos, sucursalId]);

  const deudaMercaderia = React.useMemo(() => {
    const activos = acopios.filter((a) => (a.estado === "VIGENTE" || a.estado === "VENCIDO") && (!sucursalId || a.acopio.sucursalId === sucursalId) && (!un || a.acopio.unidadNegocioId === un) && (veC2 || a.acopio.circuito !== 2));
    return { total: activos.reduce((s, a) => s + Math.max(0, a.saldo), 0), n: activos.length };
  }, [acopios, sucursalId, un, veC2]);

  const etiqueta = ETIQUETA_PERIODO[periodo.preset] ?? "período anterior";
  const esOperativo = !verVentas; // Depósito

  return (
    <div className="space-y-5">
      <PageHeader
        titulo={`Hola, ${usuario?.nombre.split(" ")[0] ?? ""}`}
        descripcion={`Resumen de ${db.config.empresa.empresa} al ${formatDate(new Date(), "EEEE d 'de' MMMM 'de' yyyy")} · ${sucursalId ? db.sucursales.find((s) => s.id === sucursalId)?.nombre : "todas las sucursales"}${un ? ` · ${db.unidadesNegocio.find((u) => u.id === un)?.nombre}` : ""}`}
        acciones={<DateRangePicker value={periodo} onChange={setPeriodo} />}
      />

      {/* Fila 1 — KPIs */}
      {esOperativo ? (
        <KpisOperativos />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-tour="kpis">
          <KpiCard
            label="Ventas del período"
            valor={formatMoney(ventas, { compact: Math.abs(ventas) >= 1_000_000 })}
            variacion={{ valor: variacion(ventas, ventasAnt), periodo: etiqueta }}
            acento
            icono={DollarSign}
            subtexto="facturado neto de IVA"
            onClick={() => router.push("/reportes/ventas")}
          />
          {verMargen ? (
            <KpiCard
              label="Margen bruto"
              valor={formatMoney(margen.margen, { compact: Math.abs(margen.margen) >= 1_000_000 })}
              variacion={{ valor: variacion(margen.margen, margenAnt.margen), periodo: etiqueta }}
              icono={Percent}
              subtexto={`${formatPercent(margen.margenPct)} sobre ${margen.pedidos} pedidos`}
              onClick={() => router.push("/reportes/rentabilidad-pedidos")}
            />
          ) : (
            <KpiCard label="Pedidos vendidos" valor={String(margen.pedidos)} icono={ShoppingCart} subtexto="facturados o despachados" />
          )}
          {verCtaCte && (
            <KpiCard
              label="Por cobrar"
              valor={formatMoney(porCobrar.total, { compact: Math.abs(porCobrar.total) >= 1_000_000 })}
              icono={Landmark}
              subtexto={porCobrar.vencido > 0 ? <span className="font-medium text-danger">{formatMoney(porCobrar.vencido, { compact: true })} vencido</span> : "sin deuda vencida"}
              onClick={() => router.push("/cuentas-corrientes")}
            />
          )}
          {verAcopios && (
            <KpiCard
              label="Deuda de mercadería (acopios)"
              valor={formatMoney(deudaMercaderia.total, { compact: Math.abs(deudaMercaderia.total) >= 1_000_000 })}
              icono={Boxes}
              subtexto={`saldo disponible de ${deudaMercaderia.n} acopios vigentes`}
              onClick={() => router.push("/acopios")}
            />
          )}
          {verProveedores && (
            <KpiCard
              label="Acopios con proveedores"
              valor={formatMoney(prov.retirar, { compact: Math.abs(prov.retirar) >= 1_000_000 })}
              icono={Factory}
              subtexto={<span>nos falta retirar · <span className={prov.deuda > 0 ? "font-medium text-danger" : ""}>le debemos {formatMoney(prov.deuda, { compact: true })}</span></span>}
              onClick={() => router.push("/proveedores/acopios")}
            />
          )}
        </div>
      )}

      {/* Fila 2 */}
      <div className="grid gap-3 lg:grid-cols-12">
        {verVentas ? <GraficoVentas periodo={periodo} filtro={filtro} verMargen={verMargen} /> : <div className="lg:col-span-8"><DespachosHoy grande /></div>}
        <Card className="lg:col-span-4" data-tour="alertas">
          <CardHeader>
            <CardTitle>Alertas</CardTitle>
            <Badge variant={alertas.length ? "danger" : "success"}>{alertas.length ? `${alertas.reduce((a, x) => a + x.cantidad, 0)} pendientes` : "Todo en orden"}</Badge>
          </CardHeader>
          {alertas.length === 0 ? (
            <EmptyState icono={PackageCheck} titulo="Sin alertas" descripcion="No hay stock crítico, vencimientos ni atrasos." />
          ) : (
            <ul className="divide-y divide-border">
              {alertas.map((a) => (
                <li key={a.id}>
                  <Link href={a.href} className="group flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAF8]">
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-control border", a.severidad === "alta" ? "border-danger/20 bg-danger-soft text-danger" : a.severidad === "media" ? "border-warning/20 bg-warning-soft text-warning" : "border-border bg-subtle text-muted")}>
                      <a.icono className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium leading-tight text-ink">{a.titulo}</span>
                      <span className="block text-[12px] leading-tight text-muted">{a.detalle}</span>
                    </span>
                    <span className="text-[15px] font-semibold tnum">{a.cantidad}</span>
                    <ChevronRight className="size-4 text-disabled group-hover:text-ink" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Fila 3 */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {verVentas && <DespachosHoy />}
        {verVentas && <PendientesEntregaCard />}
        {verVentas && <TopProductos periodo={periodo} filtro={filtro} verMargen={verMargen} />}
        <ComprasPendientes />
      </div>

      {/* Fila 4 */}
      <StockPorRubro />
    </div>
  );
}

function etiquetaClave(g: Agrupacion) {
  return (v: string) => {
    if (g === "mes") return format(parseISO(v + "-01"), "MMM yy", { locale: es });
    const d = parseISO(v);
    return g === "semana" ? `Sem ${format(d, "dd/MM")}` : format(d, "dd/MM");
  };
}

function GraficoVentas({ periodo, filtro, verMargen }: { periodo: Periodo; filtro: FiltroMetricas; verMargen: boolean }) {
  const db = useDb();
  const [agr, setAgr] = React.useState<Agrupacion>("dia");
  const [vista, setVista] = React.useState<"total" | "sucursal">("total");
  const [unGrafico, setUnGrafico] = React.useState<string>(filtro.unidadNegocioId ?? "todas");
  React.useEffect(() => setUnGrafico(filtro.unidadNegocioId ?? "todas"), [filtro.unidadNegocioId]);
  const dias = (new Date(periodo.hasta).getTime() - new Date(periodo.desde).getTime()) / 86_400_000;
  const agrEfectiva: Agrupacion = dias > 120 && agr === "dia" ? "semana" : agr;
  const filtroGrafico = React.useMemo(() => ({ ...filtro, unidadNegocioId: unGrafico === "todas" ? null : unGrafico }), [filtro, unGrafico]);
  const serie = React.useMemo(() => serieVentasMargen(db, periodo, filtroGrafico, agrEfectiva), [db, periodo, filtroGrafico, agrEfectiva]);
  const hayDatos = serie.some((s) => s.ventas !== 0);
  return (
    <Card className="lg:col-span-8">
      <CardHeader className="flex-wrap">
        <CardTitle>{verMargen ? "Ventas y margen" : "Ventas"} por {agrEfectiva === "dia" ? "día" : agrEfectiva === "semana" ? "semana" : "mes"}</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Segmented value={unGrafico} onChange={setUnGrafico} options={[{ value: "todas", label: "Todas" }, ...db.unidadesNegocio.map((u) => ({ value: u.id, label: u.nombre }))]} />
          <Segmented value={agr} onChange={setAgr} options={[{ value: "dia", label: "Por día" }, { value: "semana", label: "Por semana" }]} />
          <Segmented value={vista} onChange={setVista} options={[{ value: "total", label: "Total" }, { value: "sucursal", label: "Por sucursal" }]} />
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        {!hayDatos ? (
          <EmptyState titulo="Sin ventas en el período" descripcion="Elegí otro rango de fechas para ver la evolución." />
        ) : vista === "total" && unGrafico === "todas" ? (
          <BarrasAgrupadasChart
            data={serie.map((s) => Object.fromEntries([["clave", s.clave], ...db.unidadesNegocio.map((u) => [u.codigo, Math.round(s.porUN[u.id] ?? 0)])]))}
            etiquetaX={etiquetaClave(agrEfectiva)}
            series={db.unidadesNegocio.map((u, i) => ({ key: u.codigo, nombre: u.nombre, color: i === 0 ? COLORES.barra : COLORES.barraAlt }))}
          />
        ) : vista === "total" ? (
          <VentasMargenChart data={serie.map((s) => ({ clave: s.clave, ventas: s.ventas, margen: verMargen ? s.margen : 0 }))} etiquetaX={etiquetaClave(agrEfectiva)} />
        ) : (
          <BarrasAgrupadasChart
            data={serie.map((s) => ({ clave: s.clave, central: s.porSucursal.suc_central ?? 0, s2: s.porSucursal.suc_2 ?? 0 }))}
            etiquetaX={etiquetaClave(agrEfectiva)}
            series={[
              { key: "central", nombre: "Casa Central", color: COLORES.barraAlt },
              { key: "s2", nombre: "Sucursal 2", color: COLORES.barra },
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}

function DespachosHoy({ grande }: { grande?: boolean }) {
  const db = useDb();
  const sucursalId = useSucursalActiva();
  const hoy = diaLocal(new Date());
  const cliente = (id: string) => db.clientes.find((c) => c.id === id);
  const lista = db.despachos.filter((d) => diaLocal(d.fechaEspera) === hoy && d.estado !== "CANCELADO" && (!sucursalId || d.sucursalId === sucursalId));
  const espera = lista.filter((d) => d.estado === "ESPERA");
  const prep = lista.filter((d) => d.estado === "PREPARACION");
  const fin = lista.filter((d) => d.estado === "FINALIZADO" || d.estado === "EN_VIAJE" || d.estado === "ENTREGADO");
  const prom = promedio(lista.map((d) => minutosPreparacion(d)));
  const orden = [...prep, ...espera, ...fin];
  return (
    <Card className="flex flex-col" data-tour="despachos-hoy">
      <CardHeader>
        <CardTitle>Despachos de hoy</CardTitle>
        <Link href="/despachos" className="inline-flex items-center gap-1 text-[12px] font-medium text-muted hover:text-ink">
          Ver despachos <ArrowRight className="size-3.5" />
        </Link>
      </CardHeader>
      <div className="grid grid-cols-3 border-y border-border text-center">
        {[
          ["En espera", espera.length],
          ["En preparación", prep.length],
          ["Finalizados", fin.length],
        ].map(([l, n]) => (
          <div key={l as string} className="border-r border-border px-2 py-2.5 last:border-r-0">
            <div className="text-[18px] font-semibold tnum">{n}</div>
            <div className="text-[11px] text-muted">{l}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 px-4 py-2 text-[12px] text-muted">
        <Timer className="size-3.5" /> Preparación promedio: <span className="font-medium text-ink tnum">{prom === null ? "—" : `${prom} min`}</span>
      </div>
      {orden.length === 0 ? (
        <EmptyState icono={Truck} titulo="Sin despachos hoy" />
      ) : (
        <ul className={cn("divide-y divide-border overflow-y-auto border-t border-border", grande ? "max-h-[420px]" : "max-h-[220px]")}>
          {orden.map((d) => (
            <li key={d.id}>
              <Link href={`/despachos?despacho=${d.id}`} className="flex items-center gap-3 px-4 py-2 hover:bg-[#FAFAF8]">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink">{cliente(d.clienteId)?.nombreFantasia ?? cliente(d.clienteId)?.razonSocial}</span>
                  <span className="block truncate text-[11px] text-muted">{d.numero} · {d.posicion}</span>
                </span>
                <StatusBadge tipo="DESPACHO" estado={d.estado} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function PendientesEntregaCard() {
  const db = useDb();
  const sucursalId = useSucursalActiva();
  const pendientes = usePendientes();
  const np = new Map(db.notasPedido.map((n) => [n.id, n]));
  const lineas = pendientes.filter((l) => !sucursalId || np.get(l.notaPedidoId)?.sucursalId === sucursalId);
  const pesos = lineas.reduce((a, l) => a + l.pendiente * l.precio, 0);
  const programadas = new Set(db.despachos.filter((d) => d.estado === "ESPERA" || d.estado === "PREPARACION").map((d) => d.notaPedidoId));
  const sinProgramar = lineas.filter((l) => !programadas.has(l.notaPedidoId)).length;
  const porCliente = new Map<string, number>();
  for (const l of lineas) porCliente.set(l.clienteId, (porCliente.get(l.clienteId) ?? 0) + l.pendiente * l.precio);
  const top = [...porCliente.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Pendientes de entrega</CardTitle>
        <Link href="/pendientes-entrega" className="inline-flex items-center gap-1 text-[12px] font-medium text-muted hover:text-ink">
          Ver todo <ArrowRight className="size-3.5" />
        </Link>
      </CardHeader>
      <div className="grid grid-cols-2 border-y border-border">
        <div className="border-r border-border px-4 py-2.5">
          <div className="text-[18px] font-semibold tnum">{formatMoney(pesos, { compact: true })}</div>
          <div className="text-[11px] text-muted">a entregar · {lineas.length} líneas</div>
        </div>
        <div className="px-4 py-2.5">
          <div className={cn("text-[18px] font-semibold tnum", sinProgramar > 0 && "text-warning")}>{sinProgramar}</div>
          <div className="text-[11px] text-muted">líneas sin programar</div>
        </div>
      </div>
      <ul className="divide-y divide-border">
        {top.map(([cid, v]) => {
          const c = db.clientes.find((x) => x.id === cid);
          return (
            <li key={cid}>
              <Link href={`/clientes/${cid}`} className="flex items-center gap-3 px-4 py-2 text-[13px] hover:bg-[#FAFAF8]">
                <span className="min-w-0 flex-1 truncate">{c?.nombreFantasia ?? c?.razonSocial}</span>
                <span className="tnum text-muted">{formatMoney(v, { compact: true })}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function TopProductos({ periodo, filtro, verMargen }: { periodo: Periodo; filtro: FiltroMetricas; verMargen: boolean }) {
  const db = useDb();
  const [orden, setOrden] = React.useState<"margen" | "facturado">(verMargen ? "margen" : "facturado");
  const ranking = React.useMemo(() => rankingProductos(db, periodo, filtro), [db, periodo, filtro]);
  const top = [...ranking].sort((a, b) => b[orden] - a[orden]).slice(0, 10);
  const prod = (id: string) => db.productos.find((p) => p.id === id);
  return (
    <Card>
      <CardHeader className="flex-wrap">
        <CardTitle>Top 10 productos</CardTitle>
        {verMargen && <Segmented value={orden} onChange={setOrden} options={[{ value: "margen", label: "Por margen" }, { value: "facturado", label: "Por facturación" }]} />}
      </CardHeader>
      {top.length === 0 ? (
        <EmptyState titulo="Sin ventas en el período" />
      ) : (
        <table className="w-full text-table">
          <thead>
            <tr className="text-[11px] text-muted">
              <th className="px-4 py-2 text-left font-medium">Producto</th>
              <th className="px-2 py-2 text-right font-medium">Unid.</th>
              <th className="px-2 py-2 text-right font-medium">{orden === "margen" ? "Margen" : "Facturado"}</th>
              {verMargen && <th className="px-4 py-2 text-right font-medium">%</th>}
            </tr>
          </thead>
          <tbody>
            {top.map((r) => {
              const p = prod(r.productoId);
              return (
                <tr key={r.productoId} className="border-t border-border">
                  <td className="max-w-0 px-4 py-1.5">
                    <Link href={`/productos?id=${r.productoId}`} className="block truncate hover:underline">{p?.nombre}</Link>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right text-muted tnum">{p ? formatQty(r.unidades, p.unidad).split(" ")[0] : r.unidades}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right tnum">{formatMoney(r[orden], { compact: true })}</td>
                  {verMargen && <td className="whitespace-nowrap px-4 py-1.5 text-right text-muted tnum">{formatPercent(r.margenPct, { decimals: 0 })}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function ComprasPendientes() {
  const db = useDb();
  const sucursalId = useSucursalActiva();
  const hoy = diaLocal(new Date());
  const lista = db.ordenesCompra
    .filter((o) => (o.estado === "CONFIRMADA" || o.estado === "RECIBIDA_PARCIAL") && (!sucursalId || o.sucursalId === sucursalId))
    .sort((a, b) => a.fechaEntregaEstimada.localeCompare(b.fechaEntregaEstimada));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Compras pendientes de ingreso</CardTitle>
        <Link href="/compras/ordenes" className="text-[12px] font-medium text-muted hover:text-ink">Ver todo</Link>
      </CardHeader>
      {lista.length === 0 ? (
        <EmptyState icono={ShoppingCart} titulo="No hay compras en camino" />
      ) : (
        <ul className="max-h-[300px] divide-y divide-border overflow-y-auto">
          {lista.map((o) => {
            const atrasada = diaLocal(o.fechaEntregaEstimada) < hoy;
            return (
              <li key={o.id}>
                <Link href={`/compras/oc/${o.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#FAFAF8]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-ink">{db.proveedores.find((p) => p.id === o.proveedorId)?.razonSocial}</span>
                    <span className="block text-[11px] text-muted">{o.numero} · llega {formatDate(o.fechaEntregaEstimada)}</span>
                  </span>
                  <span className="text-right">
                    <MoneyText valor={o.total} compact className="block text-[13px]" />
                    {atrasada ? <Badge variant="danger">Atrasada</Badge> : <StatusBadge tipo="OC" estado={o.estado} />}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function StockPorRubro() {
  const db = useDb();
  const posiciones = usePosiciones();
  const filas = db.rubros
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .map((r) => {
      let norte = 0, sur = 0, bajo = 0;
      for (const pos of posiciones.values()) {
        if (pos.producto.rubroId !== r.id) continue;
        norte += Math.max(0, pos.porDeposito.dep_central?.fisico ?? 0) * pos.producto.costoPromedio;
        sur += Math.max(0, pos.porDeposito.dep_2?.fisico ?? 0) * pos.producto.costoPromedio;
        if (pos.estado !== "OK") bajo++;
      }
      return { id: r.id, nombre: r.nombre, norte, sur, total: norte + sur, bajo };
    });
  const total = filas.reduce((a, f) => a + f.total, 0);
  const tN = filas.reduce((a, f) => a + f.norte, 0);
  const tS = filas.reduce((a, f) => a + f.sur, 0);
  const tB = filas.reduce((a, f) => a + f.bajo, 0);
  return (
    <Card data-tour="stock-rubro">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Warehouse className="size-4 text-muted" />
          <CardTitle>Stock por rubro y depósito · valorizado a costo promedio</CardTitle>
        </div>
        <Link href="/reportes/valorizacion" className="text-[12px] font-medium text-muted hover:text-ink">Ver valorización</Link>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-table">
          <thead className="bg-[#FAFAF8]">
            <tr className="text-[12px] text-muted">
              <th className="h-9 px-4 text-left font-medium">Rubro</th>
              <th className="h-9 px-3 text-right font-medium">Casa Central</th>
              <th className="h-9 px-3 text-right font-medium">Sucursal 2</th>
              <th className="h-9 px-3 text-right font-medium">Total</th>
              <th className="h-9 px-3 text-right font-medium">% del total</th>
              <th className="h-9 px-4 text-right font-medium">Bajo mínimo</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id} className="h-10 border-t border-border hover:bg-[#FAFAF8]">
                <td className="px-4">{f.nombre}</td>
                <td className="px-3 text-right tnum">{formatMoney(f.norte, { decimals: false })}</td>
                <td className="px-3 text-right tnum">{formatMoney(f.sur, { decimals: false })}</td>
                <td className="px-3 text-right font-medium tnum">{formatMoney(f.total, { decimals: false })}</td>
                <td className="px-3 text-right text-muted tnum">
                  <div className="flex items-center justify-end gap-2">
                    <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-subtle sm:block">
                      <div className="h-full bg-border-strong" style={{ width: `${total ? (f.total / total) * 100 : 0}%` }} />
                    </div>
                    {formatPercent(total ? f.total / total : 0)}
                  </div>
                </td>
                <td className="px-4 text-right">
                  {f.bajo ? (
                    <Link href="/stock?filtro=bajo-minimo"><Badge variant="danger"><PackageX className="size-3" />{f.bajo}</Badge></Link>
                  ) : (
                    <span className="text-disabled">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="h-10 border-t border-border-strong bg-[#FAFAF8] font-semibold">
              <td className="px-4">Total</td>
              <td className="px-3 text-right tnum">{formatMoney(tN, { decimals: false })}</td>
              <td className="px-3 text-right tnum">{formatMoney(tS, { decimals: false })}</td>
              <td className="px-3 text-right text-accent tnum">{formatMoney(total, { decimals: false })}</td>
              <td className="px-3 text-right tnum">100 %</td>
              <td className="px-4 text-right tnum">{tB}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

/** KPIs operativos para el rol Depósito (sin montos de venta ni márgenes). */
function KpisOperativos() {
  const db = useDb();
  const posiciones = usePosiciones();
  const sucursalId = useSucursalActiva();
  const hoy = diaLocal(new Date());
  const despHoy = db.despachos.filter((d) => (d.estado === "ESPERA" || d.estado === "PREPARACION") && diaLocal(d.fechaProgramada) <= hoy && (!sucursalId || d.sucursalId === sucursalId)).length;
  const enViaje = db.despachos.filter((d) => d.estado === "EN_VIAJE" && (!sucursalId || d.sucursalId === sucursalId)).length;
  const ocPend = db.ordenesCompra.filter((o) => (o.estado === "CONFIRMADA" || o.estado === "RECIBIDA_PARCIAL") && (!sucursalId || o.sucursalId === sucursalId)).length;
  const bajo = [...posiciones.values()].filter((p) => p.estado !== "OK").length;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-tour="kpis">
      <KpiCard label="Despachos pendientes hoy" valor={String(despHoy)} acento icono={Truck} subtexto="incluye atrasados" />
      <KpiCard label="En viaje" valor={String(enViaje)} icono={Truck} />
      <KpiCard label="Compras por recibir" valor={String(ocPend)} icono={PackageCheck} subtexto="órdenes confirmadas" />
      <KpiCard label="Productos bajo mínimo" valor={String(bajo)} icono={PackageX} />
    </div>
  );
}
