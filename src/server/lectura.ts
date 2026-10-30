/**
 * Lectura de datos de negocio para un actor: parte del estado vigente (caché por versión) y
 * filtra según el rol ANTES de mandar nada al navegador (los campos ocultos se QUITAN del JSON, no
 * se ponen en cero):
 * - VENTAS: sin costos ni márgenes (costos de artículos, snapshots, costos congelados) y sin compras.
 * - DEPOSITO: sin precios de venta ni saldos de dinero (listas, montos, comprobantes, cobros).
 * - Sin "ver circuito 2": se excluyen todos los documentos de circuito 2.
 */
import { puede } from "@/domain/permisos";
import type { EstadoInicial, Usuario } from "@/domain/types";
import { obtenerEstado } from "./estado";
import { vencimientoCertificado } from "./arca/config";
import type { Delta } from "@/lib/sincronizacion/delta";

type Coleccion = Exclude<keyof EstadoInicial, "config" | "numeradores">;

/** Colecciones que el cliente mantiene sincronizadas (las insert-only se leen paginadas). */
export const COLECCIONES_CLIENTE = [
  "sucursales", "depositos", "usuarios", "unidadesNegocio", "rubros", "proveedores", "productos", "listasPrecios", "precios", "stock",
  "transferencias", "ajustes", "ordenesCompra", "recepciones", "acopiosProveedor", "clientes", "obras", "cotizaciones", "notasPedido",
  "devoluciones", "ajustesAcopio", "acopios", "remitos", "adjuntos", "comprobantes", "vehiculos", "choferes", "despachos", "hojasRuta",
  "cobranzas", "pagosProveedores", "cheques", "cajas", "movimientosCaja", "arqueosCaja",
] as const satisfies readonly Coleccion[];
export type ColeccionCliente = (typeof COLECCIONES_CLIENTE)[number] | "config" | "numeradores";

const cache = new Map<string, EstadoInicial>();

const sinCostos = <T extends object>(x: T, campos: string[]): T => {
  const o = { ...x } as Record<string, unknown>;
  for (const c of campos) delete o[c];
  return o as T;
};

/** Estado visible para el actor (memoizado por versión, rol y permiso de circuito 2). */
export async function estadoPara(actor: Usuario): Promise<{ version: bigint; db: EstadoInicial }> {
  const { version, db } = await obtenerEstado();
  const veC2 = puede(actor, "circuito2.ver");
  const verCostos = puede(actor, "margenes.ver");
  const verDinero = puede(actor, "ventas.ver") || puede(actor, "ctacte.ver");
  const verCompras = puede(actor, "compras.ver") || puede(actor, "proveedores.ver");
  const clave = `${version}|${actor.rol}|${veC2}|${verCostos}|${verDinero}|${verCompras}`;
  const enCache = cache.get(clave);
  if (enCache) return { version, db: enCache };

  const c2 = <T extends { circuito?: number }>(xs: T[]) => (veC2 ? xs : xs.filter((x) => x.circuito !== 2));
  const certVence = vencimientoCertificado()?.toISOString();
  let v: EstadoInicial = {
    ...db,
    config: certVence ? { ...db.config, arcaCertVence: certVence } : db.config,
    acopios: c2(db.acopios),
    notasPedido: c2(db.notasPedido),
    devoluciones: c2(db.devoluciones),
    ajustesAcopio: c2(db.ajustesAcopio),
    remitos: c2(db.remitos),
    comprobantes: c2(db.comprobantes),
    cobranzas: c2(db.cobranzas),
    pagosProveedores: c2(db.pagosProveedores),
    ordenesCompra: c2(db.ordenesCompra),
    acopiosProveedor: c2(db.acopiosProveedor),
    cotizaciones: c2(db.cotizaciones),
  };
  if (!verCostos) {
    v = {
      ...v,
      productos: v.productos.map((p) => sinCostos(p, ["costoUltimo", "costoPromedio", "costoUSD"])),
      notasPedido: v.notasPedido.map((n) => ({ ...n, items: n.items.map((i) => sinCostos(i, ["costoUnitarioSnapshot"])) })),
      cotizaciones: v.cotizaciones.map((n) => ({ ...n, items: n.items.map((i) => sinCostos(i, ["costoUnitarioSnapshot"])) })),
      comprobantes: v.comprobantes.map((n) => (n.items ? { ...n, items: n.items.map((i) => sinCostos(i, ["costoUnitarioSnapshot"])) } : n)),
      acopios: v.acopios.map((a) => ({ ...a, preciosCongelados: a.preciosCongelados.map((p) => sinCostos(p, ["costoSnapshot"])) })),
      ordenesCompra: v.ordenesCompra.map((o) => ({ ...sinCostos(o, ["subtotal", "iva", "total"]), items: o.items.map((i) => sinCostos(i, ["costoUnitario", "costoUSD"])) })),
      recepciones: v.recepciones.map((r) => ({ ...r, items: r.items.map((i) => sinCostos(i, ["costoUnitario", "costoUSD"])) })),
      acopiosProveedor: v.acopiosProveedor.map((a) => ({ ...sinCostos(a, ["importe", "pagado"]), preciosCongelados: a.preciosCongelados.map((p) => sinCostos(p, ["costo"])) })),
    };
  }
  if (!verCompras) v = { ...v, ordenesCompra: [], recepciones: [], acopiosProveedor: [], pagosProveedores: [], comprobantes: v.comprobantes.filter((c) => !c.proveedorId) };
  if (!verDinero) {
    v = {
      ...v,
      precios: [],
      comprobantes: [],
      cobranzas: [],
      pagosProveedores: [],
      cheques: [],
      cajas: [],
      movimientosCaja: [],
      arqueosCaja: [],
      devoluciones: v.devoluciones.map((d) => sinCostos(d, ["monto"])),
      ajustesAcopio: v.ajustesAcopio.map((a) => sinCostos(a, ["monto"])),
      notasPedido: v.notasPedido.map((n) => ({ ...sinCostos(n, ["monto", "iva", "total"]), items: n.items.map((i) => sinCostos(i, ["precioUnitario", "subtotal", "costoUnitarioSnapshot"])) })),
      acopios: v.acopios.map((a) => ({ ...sinCostos(a, ["importe", "importeConIIBB"]), preciosCongelados: a.preciosCongelados.map((p) => sinCostos(p, ["precio", "costoSnapshot"])) })),
      cotizaciones: [],
      remitos: v.remitos.map((r) => sinCostos(r, ["valorDeclarado"])),
      clientes: v.clientes.map((c) => sinCostos(c, ["limiteCredito"])),
    };
  }
  if (cache.size > 40) cache.clear();
  cache.set(clave, v);
  return { version, db: v };
}

export function seleccionar(db: EstadoInicial, colecciones: ColeccionCliente[]) {
  return Object.fromEntries(colecciones.map((c) => [c, db[c]]));
}

const DEL_CLIENTE = new Set<string>(COLECCIONES_CLIENTE);

/**
 * Delta para el actor sobre su vista ya filtrada: por cada colección, las filas de `ids` que ve
 * (altas y cambios) y las que no (bajas, o que su rol no puede ver). `"todas"` manda la colección
 * entera (cambios masivos cuya lista de ids no viaja completa).
 */
export async function deltaPara(actor: Usuario, ids: Map<string, Set<string> | "todas">, config = false, numeradores = false): Promise<Delta> {
  const { version, db } = await estadoPara(actor);
  const delta: Delta = { version: String(version), filas: {}, bajas: {}, completas: {} };
  for (const [col, sel] of ids) {
    if (!DEL_CLIENTE.has(col)) continue;
    const vista = db[col as (typeof COLECCIONES_CLIENTE)[number]] as { id: string }[];
    if (sel === "todas") {
      delta.completas[col] = vista;
      continue;
    }
    const porId = new Map(vista.map((x) => [x.id, x]));
    const filas: { id: string }[] = [];
    const bajas: string[] = [];
    for (const id of sel) {
      const x = porId.get(id);
      if (x) filas.push(x);
      else bajas.push(id);
    }
    if (filas.length) delta.filas[col] = filas;
    if (bajas.length) delta.bajas[col] = bajas;
  }
  if (config) delta.completas.config = db.config;
  if (numeradores) delta.completas.numeradores = db.numeradores;
  return delta;
}
