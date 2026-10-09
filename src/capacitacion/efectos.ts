
/**
 * Cálculo de cambios REALES (puro: corre en el servidor dentro de cada acción): foto de métricas antes y después de cada acción y lista de
 * diferencias con números. Es genérica: no tiene lógica por acción, compara el estado completo
 * (stock por artículo y depósito, cuentas, acopios, KPIs del tablero y documentos).
 */
import type { EstadoInicial, Producto } from "@/domain/types";
import { lineasPendientes } from "@/domain/stock";
import { margenPeriodo, ventasFacturadas } from "@/domain/metricas";
import { estadoInfo, type TipoEstado } from "@/domain/estados";
import { periodoDesdePreset } from "@/lib/periodos";
import { formatMoney, formatNumber, formatQty } from "@/lib/format";
import { acopiosProveedorResumenDe, acopiosResumenDe, hoyKey, posicionesDe } from "@/store/calculos";
import { calcularAlertas } from "@/store/alertas-calc";
import type { CambioCampo, Diferencia, TipoCreado } from "./slice";

/** Ids involucrados que la pantalla ya tiene a mano (ordenan el resultado: lo del contexto va primero). */
export interface Contexto {
  productoIds?: string[];
  depositoIds?: string[];
  clienteId?: string;
  proveedorId?: string;
  acopioId?: string;
  acopioProveedorId?: string;
  notaPedidoId?: string;
  remitoId?: string;
  /** Cantidad para los textos con {n} (importaciones, actualización masiva). */
  n?: number;
}

type Num = Record<string, number>;

interface Foto {
  stock: Map<string, Num>;
  costos: Map<string, Num>;
  clientes: Map<string, Num>;
  proveedores: Map<string, Num>;
  acopios: Map<string, Num>;
  acopiosProv: Map<string, Num>;
  global: Num;
  docs: Map<string, Map<string, { numero: string; estado?: string }>>;
  maestros: Map<string, Set<string>>;
  precios: Map<string, number>;
}

// ── Qué se mide y cómo se muestra ──
const CAMPOS_STOCK: [string, string][] = [["fisico", "Físico"], ["pendiente", "Pendiente de entrega"], ["reservado", "Reservado"], ["disponible", "Disponible"], ["enTransito", "En tránsito"]];
const CAMPOS_COSTO: [string, string][] = [["ultimo", "Costo último"], ["promedio", "Costo promedio"]];
const CAMPOS_CLIENTE: [string, string, "$" | "n"][] = [["saldo", "Saldo cta. cte.", "$"], ["pendiente", "Pendiente de entrega", "$"], ["acopios", "Acopios vigentes", "n"]];
const CAMPOS_PROVEEDOR: [string, string, "$"][] = [["debemos", "Le debemos", "$"], ["faltaRetirar", "Nos falta retirar", "$"], ["pendiente", "Pendiente de entrega", "$"]];
const CAMPOS_ACOPIO: [string, string][] = [["saldo", "Saldo disponible"], ["retirado", "Retirado"], ["pendiente", "Pendiente de entrega"]];
const CAMPOS_ACP: [string, string][] = [["saldo", "Saldo"], ["pendiente", "Pendiente de retirar"], ["pagado", "Pagado"]];
const CAMPOS_GLOBAL: [string, string, "$" | "n", string][] = [
  ["ventasMes", "Ventas del mes", "$", "/tablero"],
  ["margenMes", "Margen del mes", "$", "/tablero"],
  ["porCobrar", "Por cobrar", "$", "/cuentas-corrientes/clientes"],
  ["deudaMercaderia", "Deuda de mercadería", "$", "/acopios"],
  ["acopiosProv", "Acopios con proveedores", "$", "/proveedores/acopios"],
  ["pendientesEntrega", "Pendientes de entrega", "$", "/pendientes-entrega"],
  ["remitosSinFirmar", "Remitos sin firmar", "n", "/remitos?firmados=0"],
  ["alertas", "Alertas", "n", "/alertas"],
];

/** Documentos que se cuentan: colección → cómo se nombran, a dónde llevan y qué tipo de alta son. */
const DOCUMENTOS: { k: keyof EstadoInicial; estado?: TipoEstado; href: (id: string, x: Record<string, unknown>) => string; creado?: TipoCreado | ((x: Record<string, unknown>) => TipoCreado | undefined) }[] = [
  { k: "notasPedido", estado: "NP", href: (id) => `/ventas/notas-pedido/${id}`, creado: "venta" },
  { k: "acopios", estado: "ACOPIO", href: (id) => `/acopios/${id}`, creado: "acopio" },
  { k: "remitos", estado: "REMITO", href: (id) => `/remitos/${id}`, creado: "remito" },
  { k: "comprobantes", estado: "COMPROBANTE", href: (id, x) => (x.proveedorId ? `/compras/comprobantes?id=${id}` : `/ventas/comprobantes?id=${id}`), creado: (x) => (x.tipo === "FACTURA" && x.clienteId ? "factura" : undefined) },
  { k: "cobranzas", href: () => "/ventas/recibos", creado: "cobro" },
  { k: "ordenesCompra", estado: "OC", href: (id) => `/compras/oc/${id}`, creado: "oc" },
  { k: "recepciones", href: (id) => `/compras/recepciones?id=${id}`, creado: "ingreso" },
  { k: "pagosProveedores", href: () => "/compras/ordenes-pago", creado: "pago" },
  { k: "acopiosProveedor", estado: "ACOPIO", href: (id) => `/proveedores/acopios/${id}`, creado: "acopioProveedor" },
  { k: "cotizaciones", estado: "COTIZACION", href: () => "/ventas/cotizaciones", creado: "cotizacion" },
  { k: "devoluciones", href: () => "/ventas/devoluciones", creado: "devolucion" },
  { k: "ajustesAcopio", href: () => "/acopios" },
  { k: "despachos", estado: "DESPACHO", href: (id) => `/despachos?despacho=${id}`, creado: "despacho" },
  { k: "transferencias", estado: "TRANSFERENCIA", href: (id) => `/stock/transferencias?id=${id}`, creado: "transferencia" },
  { k: "ajustes", href: (id) => `/stock/ajustes?id=${id}`, creado: "ajuste" },
  { k: "hojasRuta", estado: "HOJA", href: () => "/despachos/hoja-ruta" },
  { k: "cheques", estado: "CHEQUE", href: () => "/cuentas-corrientes/cheques" },
];

/** Maestros: altas que se agrupan ("se crearon 40 artículos"). */
const MAESTROS: { k: "productos" | "clientes" | "proveedores" | "obras" | "vehiculos" | "choferes"; singular: string; plural: string; creado: TipoCreado; nombre: (x: Record<string, unknown>) => string; href: (id: string, x: Record<string, unknown>) => string }[] = [
  { k: "productos", singular: "artículo", plural: "artículos", creado: "articulo", nombre: (x) => `${x.codigo} ${x.nombre}`, href: (id) => `/productos?id=${id}` },
  { k: "clientes", singular: "cliente", plural: "clientes", creado: "cliente", nombre: (x) => String(x.nombreFantasia ?? x.razonSocial), href: (id) => `/clientes/${id}` },
  { k: "proveedores", singular: "proveedor", plural: "proveedores", creado: "proveedor", nombre: (x) => String(x.razonSocial), href: (id) => `/proveedores/${id}` },
  { k: "obras", singular: "obra", plural: "obras", creado: "obra", nombre: (x) => String(x.nombre), href: (_id, x) => `/clientes/${x.clienteId}` },
  { k: "vehiculos", singular: "vehículo", plural: "vehículos", creado: "vehiculo", nombre: (x) => `${x.patente} · ${x.descripcion}`, href: () => "/despachos/vehiculos" },
  { k: "choferes", singular: "chofer", plural: "choferes", creado: "chofer", nombre: (x) => String(x.nombre), href: () => "/despachos/vehiculos" },
];

const r2 = (n: number) => Math.round(n * 100) / 100;
const MINUS = "−";

/** Foto de todas las métricas que se comparan. */
export function foto(db: EstadoInicial, usuarioId?: string | null): Foto {
  const stock = new Map<string, Num>();
  for (const [pid, pos] of posicionesDe(db))
    for (const [dep, d] of Object.entries(pos.porDeposito)) stock.set(`${pid}|${dep}`, { fisico: d.fisico, pendiente: d.pendiente, reservado: d.reservado, disponible: d.disponible, enTransito: d.enTransito });
  const costos = new Map(db.productos.map((p) => [p.id, { ultimo: p.costoUltimo, promedio: p.costoPromedio }]));

  const pendientes = lineasPendientes(db.notasPedido, db.remitos);
  const pendCli = new Map<string, number>();
  for (const l of pendientes) pendCli.set(l.clienteId, (pendCli.get(l.clienteId) ?? 0) + l.pendiente * l.precio);
  const saldoCli = new Map<string, number>();
  const saldoProv = new Map<string, number>();
  let porCobrar = 0;
  for (const c of db.comprobantes) {
    if (c.estado === "ANULADO") continue;
    if (c.clienteId) {
      saldoCli.set(c.clienteId, (saldoCli.get(c.clienteId) ?? 0) + c.saldoPendiente);
      porCobrar += c.saldoPendiente;
    }
    if (c.proveedorId) saldoProv.set(c.proveedorId, (saldoProv.get(c.proveedorId) ?? 0) + c.saldoPendiente);
  }
  const resumen = acopiosResumenDe(db);
  const vigentes = resumen.filter((a) => a.estado === "VIGENTE" || a.estado === "VENCIDO");
  const acopiosCli = new Map<string, number>();
  for (const a of vigentes) acopiosCli.set(a.acopio.clienteId, (acopiosCli.get(a.acopio.clienteId) ?? 0) + 1);
  const clientes = new Map(db.clientes.map((c) => [c.id, { saldo: r2(saldoCli.get(c.id) ?? 0), pendiente: r2(pendCli.get(c.id) ?? 0), acopios: acopiosCli.get(c.id) ?? 0 }]));
  const acopios = new Map(resumen.map((a) => [a.acopio.id, { saldo: r2(a.saldo), retirado: r2(a.retirado), pendiente: r2(a.pendienteEntrega) }]));

  const resumenProv = acopiosProveedorResumenDe(db);
  const faltaProv = new Map<string, number>();
  for (const a of resumenProv) if (a.estado === "VIGENTE" || a.estado === "VENCIDO") faltaProv.set(a.acopio.proveedorId, (faltaProv.get(a.acopio.proveedorId) ?? 0) + a.pendientePesos);
  const pendOC = new Map<string, number>();
  for (const o of db.ordenesCompra)
    if (o.estado === "CONFIRMADA" || o.estado === "RECIBIDA_PARCIAL")
      pendOC.set(o.proveedorId, (pendOC.get(o.proveedorId) ?? 0) + o.items.reduce((s, i) => s + Math.max(0, i.cantidadPedida - i.cantidadRecibida) * i.costoUnitario, 0));
  const proveedores = new Map(db.proveedores.map((p) => [p.id, { debemos: r2(saldoProv.get(p.id) ?? 0), faltaRetirar: r2(faltaProv.get(p.id) ?? 0), pendiente: r2(pendOC.get(p.id) ?? 0) }]));
  const acopiosProv = new Map(resumenProv.map((a) => [a.acopio.id, { saldo: r2(a.saldo), pendiente: r2(a.pendientePesos), pagado: r2(a.acopio.pagado) }]));

  const mes = periodoDesdePreset("MES");
  const usuario = db.usuarios.find((u) => u.id === usuarioId);
  const global: Num = {
    ventasMes: r2(ventasFacturadas(db, mes, null)),
    margenMes: r2(margenPeriodo(db, mes, null).margen),
    porCobrar: r2(porCobrar),
    deudaMercaderia: r2(vigentes.reduce((s, a) => s + Math.max(0, a.saldo), 0)),
    acopiosProv: r2(resumenProv.filter((a) => a.estado === "VIGENTE" || a.estado === "VENCIDO").reduce((s, a) => s + a.pendientePesos, 0)),
    pendientesEntrega: r2(pendientes.reduce((s, l) => s + l.pendiente * l.precio, 0)),
    remitosSinFirmar: db.remitos.filter((r) => r.estado === "HECHO" && !r.firmadoAdjuntoId && (r.tipo === "VENTA" || r.tipo === "DESACOPIO")).length,
    alertas: calcularAlertas(db, null, usuario, hoyKey()).reduce((s, a) => s + a.cantidad, 0),
  };

  const docs = new Map<string, Map<string, { numero: string; estado?: string }>>();
  for (const d of DOCUMENTOS) {
    const m = new Map<string, { numero: string; estado?: string }>();
    for (const x of db[d.k] as unknown as Record<string, unknown>[]) {
      const numero = d.k === "cheques" ? `Cheque ${x.banco} Nº ${x.numero}` : String(x.numero || "Borrador");
      m.set(String(x.id), { numero, estado: x.estado as string | undefined });
    }
    docs.set(d.k, m);
  }
  const maestros = new Map(MAESTROS.map((m) => [m.k, new Set((db[m.k] as { id: string }[]).map((x) => x.id))]));
  const precios = new Map(db.precios.map((p) => [`${p.productoId}|${p.listaPreciosId}`, p.precio]));
  return { stock, costos, clientes, proveedores, acopios, acopiosProv, global, docs, maestros, precios };
}

// ── Formato ──
const signoDe = (d: number): 1 | -1 | 0 => (d > 0 ? 1 : d < 0 ? -1 : 0);
function fmtDelta(d: number, f: (n: number) => string) {
  return d > 0 ? `+${f(d)}` : `${MINUS}${f(-d)}`;
}
const pesos = (n: number) => formatMoney(n);
const conMenos = (s: string) => s.replace(/^-/, MINUS);

/** `fmtDelta` permite mostrar la unidad solo en el delta: "Pendiente 0 → 40 (+40 bolsas)". */
function cambiosNumericos(antes: Num | undefined, despues: Num | undefined, campos: [string, string][], fmt: (n: number) => string, fmtD: (n: number) => string = fmt): CambioCampo[] {
  const out: CambioCampo[] = [];
  for (const [k, label] of campos) {
    const a = antes?.[k] ?? 0;
    const b = despues?.[k] ?? 0;
    const d = r2(b - a);
    if (Math.abs(d) < 0.005) continue;
    out.push({ campo: label, antes: conMenos(fmt(a)), despues: conMenos(fmt(b)), delta: fmtDelta(d, fmtD), signo: signoDe(d) });
  }
  return out;
}

/** Compara dos fotos y arma la lista de diferencias legibles. */
export function comparar(a: Foto, b: Foto, db: EstadoInicial, ctx: Contexto = {}): Diferencia[] {
  const out: Diferencia[] = [];
  const prod = new Map(db.productos.map((p) => [p.id, p]));
  const dep = new Map(db.depositos.map((d) => [d.id, d.nombre.replace(/^Depósito\s+/, "")]));
  const prioridad = new Set([...(ctx.productoIds ?? []), ctx.clienteId, ctx.proveedorId, ctx.acopioId, ctx.acopioProveedorId].filter(Boolean) as string[]);
  const primero = (ids: string[]) => [...ids].sort((x, y) => Number(prioridad.has(y.split("|")[0])) - Number(prioridad.has(x.split("|")[0])));

  // Stock por artículo × depósito
  for (const k of primero([...new Set([...a.stock.keys(), ...b.stock.keys()])])) {
    const [pid, did] = k.split("|");
    const p = prod.get(pid) as Producto | undefined;
    if (!p) continue;
    const cambios = cambiosNumericos(a.stock.get(k), b.stock.get(k), CAMPOS_STOCK, (n) => formatNumber(n, Number.isInteger(n) ? 0 : 2), (n) => formatQty(n, p.unidad));
    if (cambios.length) out.push({ grupo: "Stock", titulo: `${p.nombre} › ${dep.get(did) ?? did}`, cambios, href: `/productos?id=${pid}` });
  }
  // Costos de artículos (solo los que ya existían)
  for (const pid of primero([...b.costos.keys()])) {
    if (!a.costos.has(pid)) continue;
    const cambios = cambiosNumericos(a.costos.get(pid), b.costos.get(pid), CAMPOS_COSTO, pesos);
    if (cambios.length) out.push({ grupo: "Artículo", titulo: prod.get(pid)?.nombre ?? pid, cambios, href: `/productos?id=${pid}` });
  }
  // Precios de artículos que ya existían (los de altas nuevas no se cuentan)
  {
    const existian = a.maestros.get("productos")!;
    let cambiados = 0;
    for (const [k, v] of b.precios) if (existian.has(k.split("|")[0]) && a.precios.get(k) !== v) cambiados++;
    if (cambiados) out.push({ grupo: "Listas de precios", titulo: `${cambiados} ${cambiados === 1 ? "precio actualizado" : "precios actualizados"}`, cambios: [], href: "/ventas/listas-precios" });
  }
  // Clientes
  const cli = new Map(db.clientes.map((c) => [c.id, c]));
  for (const id of primero([...b.clientes.keys()])) {
    const ca = a.clientes.get(id);
    const cb = b.clientes.get(id);
    const cambios = [
      ...cambiosNumericos(ca, cb, CAMPOS_CLIENTE.filter((c) => c[2] === "$").map(([k, l]) => [k, l]), pesos),
      ...cambiosNumericos(ca, cb, CAMPOS_CLIENTE.filter((c) => c[2] === "n").map(([k, l]) => [k, l]), (n) => formatNumber(n, 0)),
    ];
    if (cambios.length) out.push({ grupo: "Cliente", titulo: cli.get(id)?.nombreFantasia ?? cli.get(id)?.razonSocial ?? id, cambios, href: `/cuentas-corrientes/clientes/${id}` });
  }
  // Proveedores
  const prov = new Map(db.proveedores.map((p) => [p.id, p]));
  for (const id of primero([...b.proveedores.keys()])) {
    const cambios = cambiosNumericos(a.proveedores.get(id), b.proveedores.get(id), CAMPOS_PROVEEDOR.map(([k, l]) => [k, l]), pesos);
    if (cambios.length) out.push({ grupo: "Proveedor", titulo: prov.get(id)?.razonSocial ?? id, cambios, href: `/proveedores/${id}` });
  }
  // Acopios de clientes
  const aco = new Map(db.acopios.map((x) => [x.id, x]));
  for (const id of primero([...b.acopios.keys()])) {
    const cambios = cambiosNumericos(a.acopios.get(id), b.acopios.get(id), CAMPOS_ACOPIO, pesos);
    if (cambios.length) out.push({ grupo: "Acopio", titulo: aco.get(id)?.numero ?? id, cambios, href: `/acopios/${id}` });
  }
  // Acopios con proveedores
  const acp = new Map(db.acopiosProveedor.map((x) => [x.id, x]));
  for (const id of primero([...b.acopiosProv.keys()])) {
    const cambios = cambiosNumericos(a.acopiosProv.get(id), b.acopiosProv.get(id), CAMPOS_ACP, pesos);
    if (cambios.length) out.push({ grupo: "Acopio con proveedor", titulo: acp.get(id)?.numero ?? id, cambios, href: `/proveedores/acopios/${id}` });
  }
  // Tablero
  for (const [k, label, tipo, href] of CAMPOS_GLOBAL) {
    const cambios = cambiosNumericos(a.global, b.global, [[k, ""]], tipo === "$" ? pesos : (n) => formatNumber(n, 0));
    if (cambios.length) out.push({ grupo: "Tablero", titulo: label, cambios, href });
  }
  // Documentos creados y cambios de estado
  for (const d of DOCUMENTOS) {
    const ma = a.docs.get(d.k)!;
    const mb = b.docs.get(d.k)!;
    const coleccion = db[d.k] as unknown as Record<string, unknown>[];
    for (const [id, x] of mb) {
      const previo = ma.get(id);
      const item = coleccion.find((y) => y.id === id) ?? {};
      if (!previo) {
        const creado = typeof d.creado === "function" ? d.creado(item) : d.creado;
        out.push({ grupo: "Documentos", titulo: `se creó ${x.numero}`, cambios: [], href: d.href(id, item), creado });
      } else if (d.estado && previo.estado !== x.estado && x.estado) {
        out.push({ grupo: "Documentos", titulo: x.numero, cambios: [{ campo: "Estado", antes: estadoInfo(d.estado, previo.estado ?? "").label, despues: estadoInfo(d.estado, x.estado).label, signo: 0 }], href: d.href(id, item) });
      } else if (previo.numero !== x.numero && previo.numero === "Borrador") {
        out.push({ grupo: "Documentos", titulo: `se numeró ${x.numero}`, cambios: [], href: d.href(id, item) });
      }
    }
  }
  // Altas de maestros (agrupadas)
  for (const m of MAESTROS) {
    const nuevos = [...b.maestros.get(m.k)!].filter((id) => !a.maestros.get(m.k)!.has(id));
    if (!nuevos.length) continue;
    const items = db[m.k] as unknown as Record<string, unknown>[];
    if (nuevos.length <= 3)
      for (const id of nuevos) {
        const x = items.find((y) => y.id === id) ?? {};
        out.push({ grupo: "Altas", titulo: `se creó ${m.singular}: ${m.nombre(x)}`, cambios: [], href: m.href(id, x), creado: m.creado, cantidad: 1 });
      }
    else out.push({ grupo: "Altas", titulo: `se crearon ${nuevos.length} ${m.plural}`, cambios: [], href: m.href(nuevos[0], items.find((y) => y.id === nuevos[0]) ?? {}).split("?")[0], creado: m.creado, cantidad: nuevos.length });
  }
  return out;
}

