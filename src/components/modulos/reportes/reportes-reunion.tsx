"use client";
/** Reportes pedidos en la reunión con los dueños: últimas modificaciones y hierros en toneladas. */
import * as React from "react";
import { useAuditoria } from "@/lib/datos/hooks";
import { useDb, usePosiciones } from "@/store/selectors";
import type { Auditoria } from "@/domain/types";
import { equivalenteAlternativa, esBarraDeHierro, barrasPorTonelada, diametroDe } from "@/domain/unidades";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KpiCard } from "@/components/shared/kpi-card";
import { Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/tabs";
import { formatDate, formatNumber } from "@/lib/format";
import { enPeriodo } from "@/lib/periodos";
import { nombreUsuario } from "@/lib/referencias";
import { ReporteLayout } from "./reporte-layout";
import { usePeriodoReporte } from "./reportes-ventas";

/** Módulo y sección del sistema de cada entidad auditada (lo que ve el usuario en el menú). */
const SECCIONES: Record<string, [string, string]> = {
  Cotizacion: ["Ventas", "Cotizaciones"],
  NotaPedido: ["Ventas", "Notas de pedido"],
  Comprobante: ["Ventas", "Comprobantes"],
  Cobranza: ["Ventas", "Recibos"],
  DevolucionNP: ["Ventas", "Devoluciones"],
  Cheque: ["Ventas", "Cartera de cheques"],
  Remito: ["Remitos", "Remitos"],
  Cliente: ["Clientes", "Clientes"],
  Obra: ["Clientes", "Obras"],
  Acopio: ["Clientes", "Acopios"],
  AjusteAcopio: ["Clientes", "Acopios"],
  Proveedor: ["Proveedores", "Proveedores"],
  AcopioProveedor: ["Proveedores", "Acopios con proveedores"],
  OrdenCompra: ["Compras", "Órdenes de compra"],
  RecepcionMercaderia: ["Compras", "Ingreso de mercadería"],
  PagoProveedor: ["Compras", "Órdenes de pago"],
  Producto: ["Stock", "Artículos"],
  ListaPrecios: ["Ventas", "Listas de precios"],
  Rubro: ["Stock", "Artículos"],
  TransferenciaStock: ["Stock", "Transferencias"],
  AjusteStock: ["Stock", "Ajustes e inventarios"],
  Despacho: ["Logística", "Despachos"],
  HojaRuta: ["Logística", "Hoja de ruta"],
  Vehiculo: ["Logística", "Vehículos y choferes"],
  Chofer: ["Logística", "Vehículos y choferes"],
  Caja: ["Caja chica", "Caja chica"],
  Usuario: ["Configuración", "Usuarios"],
  Sucursal: ["Configuración", "Sucursales"],
  UnidadNegocio: ["Configuración", "Unidades de negocio"],
  Configuracion: ["Configuración", "Parámetros"],
  Reporte: ["Reportes", "Reportes"],
};

export function seccionDe(a: Pick<Auditoria, "entidad" | "accion">): [string, string] {
  if (a.entidad === "Cliente" && /lista especial|precio especial/i.test(a.accion)) return ["Clientes", "Precios especiales"];
  if (a.entidad === "Configuracion" && /tipos de cliente/i.test(a.accion)) return ["Configuración", "Tipos de cliente"];
  if (a.entidad === "Comprobante" && /saldo a favor|recibo/i.test(a.accion)) return ["Ventas", "Recibos"];
  return SECCIONES[a.entidad] ?? ["Otros", a.entidad];
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });

interface Fila extends Auditoria {
  modulo: string;
  seccion: string;
}

export function ReporteUltimasModificaciones() {
  const dbBase = useDb();
  const { auditoria, cargando } = useAuditoria({ tamano: 2000 });
  const [periodo, setPeriodo] = usePeriodoReporte("30D");
  const [vista, setVista] = React.useState<"ULTIMA" | "TODO">("ULTIMA");
  const [modulo, setModulo] = React.useState("");
  const [seccion, setSeccion] = React.useState("");
  const [usuario, setUsuario] = React.useState("");
  const todas: Fila[] = React.useMemo(() => auditoria.filter((a) => !/^(Exportó reporte|Inició sesión|Ingresó al sistema|Cerró sesión|Actualizó el tipo de cambio)/.test(a.accion) && a.entidad !== "CotizacionUSD").map((a) => { const [m, s] = seccionDe(a); return { ...a, modulo: m, seccion: s }; }), [auditoria]);
  const filtradas = todas.filter((a) => enPeriodo(a.fecha, periodo) && (!modulo || a.modulo === modulo) && (!seccion || a.seccion === seccion) && (!usuario || a.usuarioId === usuario));
  // Último cambio de cada sección.
  const ultimas = React.useMemo(() => {
    const m = new Map<string, Fila>();
    for (const a of filtradas) {
      const k = `${a.modulo}|${a.seccion}`;
      const prev = m.get(k);
      if (!prev || a.fecha > prev.fecha) m.set(k, a);
    }
    return [...m.values()];
  }, [filtradas]);
  const filas = vista === "ULTIMA" ? ultimas : filtradas;
  const modulos = [...new Set(todas.map((a) => a.modulo))].sort();
  const secciones = [...new Set(todas.filter((a) => !modulo || a.modulo === modulo).map((a) => a.seccion))].sort();
  const columnas: Column<Fila>[] = [
    { key: "m", header: "Módulo", sortable: true, sortValue: (a) => a.modulo, cell: (a) => <span className="font-medium">{a.modulo}</span> },
    { key: "s", header: "Sección", sortable: true, sortValue: (a) => a.seccion, cell: (a) => <span>{a.seccion}</span> },
    { key: "u", header: vista === "ULTIMA" ? "Último en modificar" : "Usuario", sortable: true, sortValue: (a) => nombreUsuario(dbBase, a.usuarioId), cell: (a) => <span className="whitespace-nowrap">{nombreUsuario(dbBase, a.usuarioId)}</span> },
    { key: "q", header: "Qué modificó", cell: (a) => <span className="block min-w-[260px]"><span className="font-medium">{a.accion}</span>{a.detalle && <span className="block text-[12px] text-muted">{a.detalle}</span>}</span> },
    { key: "d", header: "Día", sortable: true, sortValue: (a) => a.fecha, cell: (a) => <span className="whitespace-nowrap text-muted">{formatDate(a.fecha)}</span> },
    { key: "h", header: "Hora", cell: (a) => <span className="whitespace-nowrap text-muted tnum">{hora(a.fecha)}</span> },
  ];
  return (
    <ReporteLayout
      slug="ultimas-modificaciones"
      titulo="Últimas modificaciones"
      descripcion="Quién fue el último en modificar cada módulo y sección, qué hizo, qué día y a qué hora."
      periodo={periodo}
      onPeriodo={setPeriodo}
      filtros={
        <>
          <Segmented value={vista} onChange={setVista} options={[{ value: "ULTIMA", label: "Último por sección" }, { value: "TODO", label: "Todos los cambios" }]} />
          <Select size="sm" className="w-[150px]" aria-label="Módulo" value={modulo} onValueChange={(v) => { setModulo(v); setSeccion(""); }} options={[{ value: "", label: "Todos los módulos" }, ...modulos.map((m) => ({ value: m, label: m }))]} />
          <Select size="sm" className="w-[180px]" aria-label="Sección" value={seccion} onValueChange={setSeccion} options={[{ value: "", label: "Todas las secciones" }, ...secciones.map((m) => ({ value: m, label: m }))]} />
          <Select size="sm" className="w-[160px]" aria-label="Usuario" value={usuario} onValueChange={setUsuario} options={[{ value: "", label: "Todos los usuarios" }, ...dbBase.usuarios.map((u) => ({ value: u.id, label: u.nombre }))]} />
        </>
      }
      filtrosTexto={[vista === "ULTIMA" ? "Último por sección" : "Todos los cambios", modulo, seccion].filter(Boolean).join(" · ")}
      kpis={
        <>
          <KpiCard label="Cambios en el período" valor={String(filtradas.length)} acento />
          <KpiCard label="Usuarios que modificaron" valor={String(new Set(filtradas.map((a) => a.usuarioId)).size)} />
          <KpiCard label="Anulaciones" valor={String(filtradas.filter((a) => /Anuló/.test(a.accion)).length)} />
          <KpiCard label="Último cambio" valor={filtradas[0] ? formatDate(filtradas[0].fecha) : "—"} subtexto={filtradas[0] ? `${hora(filtradas[0].fecha)} · ${nombreUsuario(dbBase, filtradas[0].usuarioId)}` : undefined} />
        </>
      }
      exportar={() => ({ head: ["Módulo", "Sección", "Usuario", "Qué modificó", "Detalle", "Día", "Hora"], rows: filas.map((a) => [a.modulo, a.seccion, nombreUsuario(dbBase, a.usuarioId), a.accion, a.detalle, formatDate(a.fecha), hora(a.fecha)]) })}
    >
      <DataTable rows={filas} columns={columnas} getRowId={(a) => a.id} searchText={(a) => `${a.modulo} ${a.seccion} ${a.accion} ${a.detalle}`} initialSort={{ key: vista === "ULTIMA" ? "m" : "d", dir: vista === "ULTIMA" ? "asc" : "desc" }} pageSize={50} empty={{ titulo: cargando ? "Cargando…" : "Sin modificaciones en el período" }} />
    </ReporteLayout>
  );
}

interface FilaHierro {
  id: string;
  nombre: string;
  diametro: number;
  bpt: number;
  ingresadoTn: number;
  vendidas: number;
  vendidoTn: number;
  stockBarras: number;
  stockTn: number;
}

/** Hierros: se ingresan por tonelada y se venden por barra; acá todo llevado a toneladas. */
export function ReporteHierrosToneladas() {
  const db = useDb();
  const posiciones = usePosiciones();
  const [periodo, setPeriodo] = usePeriodoReporte("MES");
  const filas: FilaHierro[] = db.productos
    .filter((p) => esBarraDeHierro(p, db.rubros))
    .map((p) => {
      const bpt = barrasPorTonelada(p) ?? 0;
      // Cantidades en la unidad base del artículo: barras (UN) o toneladas (TN).
      const enTn = p.unidad === "TN";
      const tn = (q: number) => (enTn ? q : bpt ? q / bpt : (equivalenteAlternativa(q, p) ?? 0));
      const barras = (q: number) => (enTn ? (bpt ? q * bpt : 0) : q);
      const vendidas = db.notasPedido.filter((n) => n.estado !== "BORRADOR" && n.estado !== "ANULADA" && enPeriodo(n.fecha, periodo)).flatMap((n) => n.items).filter((i) => i.productoId === p.id).reduce((a, i) => a + i.cantidad - (i.devueltos ?? 0), 0);
      const ingresadas = db.recepciones.filter((r) => enPeriodo(r.fecha, periodo)).flatMap((r) => r.items).filter((i) => i.productoId === p.id).reduce((a, i) => a + i.cantidadRecibida, 0);
      const stock = posiciones.get(p.id)?.fisico ?? 0;
      return { id: p.id, nombre: p.nombre, diametro: diametroDe(p.nombre) ?? 0, bpt, ingresadoTn: tn(ingresadas), vendidas: barras(vendidas), vendidoTn: tn(vendidas), stockBarras: barras(stock), stockTn: tn(stock) };
    })
    .sort((a, b) => a.diametro - b.diametro);
  const tot = filas.reduce((a, f) => ({ ing: a.ing + f.ingresadoTn, ven: a.ven + f.vendidoTn, st: a.st + f.stockTn, b: a.b + f.vendidas }), { ing: 0, ven: 0, st: 0, b: 0 });
  const t3 = (n: number) => formatNumber(n, 3);
  const columnas: Column<FilaHierro>[] = [
    { key: "n", header: "Hierro", sortable: true, sortValue: (f) => f.diametro, cell: (f) => <span>{f.nombre}</span>, footer: "Total" },
    { key: "b", header: "Barras por TN", align: "right", cell: (f) => <span className="text-muted tnum">{f.bpt || "—"}</span> },
    { key: "i", header: "Ingresado (TN)", align: "right", cell: (f) => <span className="tnum">{t3(f.ingresadoTn)}</span>, footer: <span className="tnum">{t3(tot.ing)}</span> },
    { key: "v", header: "Vendido (barras)", align: "right", cell: (f) => <span className="tnum">{formatNumber(f.vendidas, 0)}</span>, footer: <span className="tnum">{formatNumber(tot.b, 0)}</span> },
    { key: "vt", header: "Vendido (TN)", align: "right", cell: (f) => <span className="font-medium tnum">{t3(f.vendidoTn)}</span>, footer: <span className="tnum">{t3(tot.ven)}</span> },
    { key: "s", header: "Stock (barras)", align: "right", cell: (f) => <span className="tnum">{formatNumber(f.stockBarras, 0)}</span> },
    { key: "st", header: "Stock (TN)", align: "right", cell: (f) => <span className="font-medium tnum">{t3(f.stockTn)}</span>, footer: <span className="tnum">{t3(tot.st)}</span> },
  ];
  return (
    <ReporteLayout
      slug="hierros-toneladas"
      titulo="Hierros en toneladas"
      descripcion="Ingresos por tonelada, ventas por barra y stock: todo llevado a toneladas."
      periodo={periodo}
      onPeriodo={setPeriodo}
      kpis={
        <>
          <KpiCard label="Ingresado" valor={`${t3(tot.ing)} TN`} />
          <KpiCard label="Vendido" valor={`${t3(tot.ven)} TN`} acento subtexto={`${formatNumber(tot.b, 0)} barras`} />
          <KpiCard label="Stock actual" valor={`${t3(tot.st)} TN`} />
        </>
      }
      exportar={() => ({ head: ["Hierro", "Barras por TN", "Ingresado TN", "Vendido barras", "Vendido TN", "Stock barras", "Stock TN"], rows: filas.map((f) => [f.nombre, f.bpt, Number(t3(f.ingresadoTn).replace(",", ".")), f.vendidas, Number(f.vendidoTn.toFixed(3)), f.stockBarras, Number(f.stockTn.toFixed(3))]) })}
    >
      <DataTable rows={filas} columns={columnas} getRowId={(f) => f.id} showFooter empty={{ titulo: "No hay hierros cargados" }} />
    </ReporteLayout>
  );
}
