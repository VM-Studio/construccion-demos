/**
 * Mapeo genérico dominio ↔ base, guiado por la metadata de Prisma (DMMF).
 * Los modelos usan los mismos nombres de campo que `src/domain/types.ts`, así que:
 * - Decimal → number y DateTime → ISO al leer; null → ausente (como los opcionales del dominio).
 * - Los ítems embebidos son relaciones lista (tablas hijas con `orden`).
 * - Al escribir, cada entidad se guarda completa (los opcionales ausentes quedan en null).
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import type { Configuracion, EstadoInicial, Numeradores } from "@/domain/types";
import { esDecimal } from "@/lib/decimal";

export type Cliente = PrismaClient | Prisma.TransactionClient;

/** Colecciones del estado de negocio ↔ modelo de Prisma. */
export const MODELOS = {
  sucursales: "Sucursal",
  depositos: "Deposito",
  usuarios: "Usuario",
  unidadesNegocio: "UnidadNegocio",
  rubros: "Rubro",
  proveedores: "Proveedor",
  productos: "Producto",
  listasPrecios: "ListaPrecios",
  precios: "PrecioProducto",
  stock: "StockDeposito",
  movimientos: "MovimientoStock",
  transferencias: "TransferenciaStock",
  ajustes: "AjusteStock",
  ordenesCompra: "OrdenCompra",
  recepciones: "RecepcionMercaderia",
  acopiosProveedor: "AcopioProveedor",
  clientes: "Cliente",
  obras: "Obra",
  cotizaciones: "Cotizacion",
  notasPedido: "NotaPedido",
  devoluciones: "DevolucionNP",
  ajustesAcopio: "AjusteAcopio",
  acopios: "Acopio",
  remitos: "Remito",
  adjuntos: "Adjunto",
  comprobantes: "Comprobante",
  vehiculos: "Vehiculo",
  choferes: "Chofer",
  despachos: "Despacho",
  hojasRuta: "HojaRuta",
  cobranzas: "Recibo",
  pagosProveedores: "OrdenPago",
  cheques: "Cheque",
  auditoria: "Auditoria",
} as const satisfies Partial<Record<keyof EstadoInicial, string>>;

export type Coleccion = keyof typeof MODELOS;
export const COLECCIONES = Object.keys(MODELOS) as Coleccion[];

/** Hijos cuyo tipo de dominio no tiene id propio (el id de la fila es interno). */
const HIJOS_SIN_ID = new Set([
  "PosicionCarga",
  "ItemTransferencia",
  "ItemAjuste",
  "PrecioCongelado",
  "ItemDP",
  "ItemRemito",
  "ItemDespacho",
  "ItemRecepcion",
  "CostoCongelado",
  "ItemAcopioProveedor",
  "ImputacionComprobante",
  "MedioRecibo",
  "ImputacionRecibo",
  "MedioOrdenPago",
  "ImputacionOrdenPago",
]);

/** Hijos que en el dominio son una lista de strings (Deposito.posiciones). */
const HIJOS_ESCALARES: Record<string, string> = { PosicionCarga: "nombre" };

/** En borrador el número es "" en el dominio y NULL en la base (el número es único). */
const NUMERO_OPCIONAL = new Set(["NotaPedido"]);

type Campo = Prisma.DMMF.Field;
type Modelo = Prisma.DMMF.Model;

const modelos = new Map<string, Modelo>(Prisma.dmmf.datamodel.models.map((m) => [m.name, m as Modelo]));
const modelo = (nombre: string) => {
  const m = modelos.get(nombre);
  if (!m) throw new Error(`Modelo inexistente: ${nombre}`);
  return m;
};
const delegado = (db: Cliente, nombre: string) => (db as unknown as Record<string, Record<string, (args: unknown) => Promise<unknown>>>)[nombre.charAt(0).toLowerCase() + nombre.slice(1)];

/** Relaciones lista (ítems) de un modelo, con el campo FK del hijo. */
function hijosDe(m: Modelo): { campo: Campo; hijo: Modelo; fk: string; atras: string }[] {
  return m.fields
    .filter((f) => f.kind === "object" && f.isList)
    .map((f) => {
      const hijo = modelo(f.type);
      const atras = hijo.fields.find((x) => x.kind === "object" && x.relationName === f.relationName)!;
      return { campo: f, hijo, fk: atras.relationFromFields![0], atras: atras.name };
    });
}

/** `include` para traer los ítems ordenados. */
export function include(nombreModelo: string): Record<string, unknown> | undefined {
  const hs = hijosDe(modelo(nombreModelo));
  if (!hs.length) return undefined;
  return Object.fromEntries(hs.map((h) => [h.campo.name, { orderBy: { orden: "asc" } }]));
}

function valorADominio(v: unknown): unknown {
  if (v === null || v === undefined) return undefined;
  if (v instanceof Date) return v.toISOString();
  if (esDecimal(v)) return v.toNumber();
  if (typeof v === "bigint") return Number(v);
  return v;
}

function filaADominio(m: Modelo, fila: Record<string, unknown>, esHijo?: { fk: string; atras: string }): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of m.fields) {
    if (f.kind === "object") {
      if (!f.isList) continue;
      const h = hijosDe(m).find((x) => x.campo.name === f.name)!;
      const filas = (fila[f.name] as Record<string, unknown>[] | undefined) ?? [];
      const esc = HIJOS_ESCALARES[h.hijo.name];
      out[f.name] = esc ? filas.map((r) => r[esc]) : filas.map((r) => filaADominio(h.hijo, r, h));
      continue;
    }
    if (esHijo && (f.name === esHijo.fk || f.name === "orden" || (f.name === "id" && HIJOS_SIN_ID.has(m.name)))) continue;
    const v = valorADominio(fila[f.name]);
    if (v === undefined) {
      if (f.name === "numero" && NUMERO_OPCIONAL.has(m.name)) out.numero = "";
      continue;
    }
    out[f.name] = v;
  }
  return out;
}

function valorABase(f: Campo, v: unknown): unknown {
  if (v === undefined || v === null) return null;
  if (f.type === "DateTime" && typeof v === "string") return new Date(v);
  if (f.type === "Json") return v as Prisma.InputJsonValue;
  return v;
}

/** Campos escalares (y enums) que el dominio puede traer. */
function escalares(m: Modelo) {
  return m.fields.filter((f) => f.kind === "scalar" || f.kind === "enum");
}

const avisados = new Set<string>();
function avisarCamposDesconocidos(m: Modelo, obj: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  const conocidos = new Set(m.fields.map((f) => f.name));
  for (const k of Object.keys(obj))
    if (!conocidos.has(k) && obj[k] !== undefined && !avisados.has(`${m.name}.${k}`)) {
      avisados.add(`${m.name}.${k}`);
      console.warn(`[mapeo] ${m.name}.${k} no existe en la base: el valor no se guarda`);
    }
}

/** Datos de creación (con ítems anidados) a partir de una entidad del dominio. */
function datosCrear(m: Modelo, obj: Record<string, unknown>, fk?: string): Record<string, unknown> {
  avisarCamposDesconocidos(m, obj);
  const data: Record<string, unknown> = {};
  for (const f of escalares(m)) {
    if (fk && (f.name === fk || f.name === "orden")) continue;
    if (f.name === "id" && HIJOS_SIN_ID.has(m.name)) continue;
    let v = obj[f.name];
    if (f.name === "numero" && NUMERO_OPCIONAL.has(m.name) && v === "") v = undefined;
    if (v === undefined || v === null) {
      if (!f.isRequired) data[f.name] = null;
      continue;
    }
    data[f.name] = valorABase(f, v);
  }
  for (const h of hijosDe(m)) {
    const lista = (obj[h.campo.name] as unknown[] | undefined) ?? [];
    const esc = HIJOS_ESCALARES[h.hijo.name];
    data[h.campo.name] = { create: lista.map((x, i) => ({ ...(esc ? { [esc]: x } : datosCrear(h.hijo, x as Record<string, unknown>, h.fk)), orden: i })) };
  }
  return data;
}

/** Datos de actualización: escalares completos; los ítems se reemplazan solo si cambiaron. */
function datosActualizar(m: Modelo, antes: Record<string, unknown>, ahora: Record<string, unknown>): Record<string, unknown> {
  const data = datosCrear(m, ahora);
  delete data.id;
  for (const h of hijosDe(m)) {
    const igual = JSON.stringify(antes[h.campo.name] ?? []) === JSON.stringify(ahora[h.campo.name] ?? []);
    if (igual) delete data[h.campo.name];
    else data[h.campo.name] = { deleteMany: {}, ...(data[h.campo.name] as object) };
  }
  return data;
}

// ───────────────────────── Lectura ─────────────────────────

export async function leerColeccion<K extends Coleccion>(db: Cliente, k: K, args: { where?: unknown; orderBy?: unknown; skip?: number; take?: number } = {}): Promise<EstadoInicial[K]> {
  const nombre = MODELOS[k];
  const filas = (await delegado(db, nombre).findMany({ ...args, include: include(nombre) })) as Record<string, unknown>[];
  const m = modelo(nombre);
  return filas.map((f) => filaADominio(m, f)) as unknown as EstadoInicial[K];
}

export async function contarColeccion(db: Cliente, k: Coleccion, where?: unknown): Promise<number> {
  return (await delegado(db, MODELOS[k]).count({ where })) as number;
}

export async function leerConfig(db: Cliente): Promise<Configuracion> {
  const [c, motivos] = await Promise.all([db.configuracion.findUnique({ where: { id: "config" } }), db.motivoAjuste.findMany({ orderBy: { orden: "asc" } })]);
  if (!c) throw new Error("La configuración no está inicializada (correr db:seed)");
  const d = filaADominio(modelo("Configuracion"), c as unknown as Record<string, unknown>);
  delete d.id;
  delete d.creadoEn;
  delete d.actualizadoEn;
  return { ...(d as unknown as Configuracion), motivosAjuste: motivos.map((x) => ({ codigo: x.codigo, nombre: x.nombre, activo: x.activo })) };
}

export async function leerNumeradores(db: Cliente): Promise<Numeradores> {
  const filas = await db.contador.findMany();
  return Object.fromEntries(filas.map((f) => [f.tipo, f.ultimo]));
}

/**
 * Estado completo (o sin las colecciones excluidas, que quedan vacías).
 * `paralelo`: consultas en paralelo (fuera de una transacción interactiva).
 */
export async function leerEstado(db: Cliente, opts: { excluir?: Coleccion[]; paralelo?: boolean } = {}): Promise<EstadoInicial> {
  const excluir = new Set(opts.excluir ?? []);
  const out: Record<string, unknown> = {};
  const tareas: [string, () => Promise<unknown>][] = [
    ...COLECCIONES.map((k): [string, () => Promise<unknown>] => [k, () => (excluir.has(k) ? Promise.resolve([]) : leerColeccion(db, k))]),
    ["config", () => leerConfig(db)],
    ["numeradores", () => leerNumeradores(db)],
  ];
  if (opts.paralelo) {
    const valores = await Promise.all(tareas.map(([, f]) => f()));
    tareas.forEach(([k], i) => (out[k] = valores[i]));
  } else for (const [k, f] of tareas) out[k] = await f();
  return out as unknown as EstadoInicial;
}

// ───────────────────────── Escritura ─────────────────────────

export async function insertar(db: Cliente, k: Coleccion, obj: object) {
  const nombre = MODELOS[k];
  await delegado(db, nombre).create({ data: datosCrear(modelo(nombre), obj as Record<string, unknown>) });
}

/** Alta masiva (seeds e importaciones): un createMany por tabla en vez de una consulta por fila. */
export async function insertarMuchos(db: Cliente, k: Coleccion, objs: object[], lote = 500) {
  if (!objs.length) return;
  const nombre = MODELOS[k];
  const m = modelo(nombre);
  const hs = hijosDe(m);
  const padres: Record<string, unknown>[] = [];
  const hijos = new Map<string, Record<string, unknown>[]>(hs.map((h) => [h.hijo.name, []]));
  for (const o of objs as Record<string, unknown>[]) {
    const d = datosCrear(m, o);
    for (const h of hs) {
      delete d[h.campo.name];
      const esc = HIJOS_ESCALARES[h.hijo.name];
      ((o[h.campo.name] as unknown[] | undefined) ?? []).forEach((x, i) =>
        hijos.get(h.hijo.name)!.push({ ...(esc ? { [esc]: x } : datosCrear(h.hijo, x as Record<string, unknown>, h.fk)), [h.fk]: o.id, orden: i }),
      );
    }
    padres.push(d);
  }
  for (let i = 0; i < padres.length; i += lote) await delegado(db, nombre).createMany({ data: padres.slice(i, i + lote) });
  for (const [hijo, filas] of hijos) for (let i = 0; i < filas.length; i += lote) await delegado(db, hijo).createMany({ data: filas.slice(i, i + lote) });
}

export async function actualizar(db: Cliente, k: Coleccion, antes: object, ahora: object) {
  if (k === "movimientos") throw new Error("MovimientoStock es insert-only");
  const nombre = MODELOS[k];
  const a = ahora as Record<string, unknown>;
  await delegado(db, nombre).update({ where: { id: a.id }, data: datosActualizar(modelo(nombre), antes as Record<string, unknown>, a) });
}

export async function eliminar(db: Cliente, k: Coleccion, id: string) {
  if (k === "movimientos") throw new Error("MovimientoStock es insert-only");
  await delegado(db, MODELOS[k]).delete({ where: { id } });
}

export async function guardarConfig(db: Cliente, c: Configuracion) {
  const { motivosAjuste, ...resto } = c;
  const data = datosCrear(modelo("Configuracion"), { ...resto, id: "config" } as Record<string, unknown>);
  await db.configuracion.upsert({ where: { id: "config" }, create: data as Prisma.ConfiguracionCreateInput, update: { ...(data as object), id: undefined } as Prisma.ConfiguracionUpdateInput });
  const existentes = await db.motivoAjuste.findMany();
  for (const [i, mo] of motivosAjuste.entries()) {
    const e = existentes.find((x) => x.codigo === mo.codigo);
    if (!e) await db.motivoAjuste.create({ data: { ...mo, orden: i } });
    else if (e.nombre !== mo.nombre || e.activo !== mo.activo || e.orden !== i) await db.motivoAjuste.update({ where: { id: e.id }, data: { nombre: mo.nombre, activo: mo.activo, orden: i } });
  }
}

/**
 * Persiste las diferencias entre dos estados (antes = lo leído en la transacción,
 * después = lo que dejó la acción de negocio). Solo toca lo que cambió:
 * altas, bajas y entidades reemplazadas (el Tx del dominio reemplaza por referencia).
 */
export async function persistirDiferencias(db: Cliente, antes: EstadoInicial, despues: EstadoInicial, colecciones: Iterable<string>): Promise<{ coleccion: Coleccion; id: string; op: "alta" | "cambio" | "baja" }[]> {
  const cambios: { coleccion: Coleccion; id: string; op: "alta" | "cambio" | "baja" }[] = [];
  for (const k of colecciones) {
    if (!(k in MODELOS)) continue;
    const col = k as Coleccion;
    const a = antes[col] as unknown as { id: string }[];
    const d = despues[col] as unknown as { id: string }[];
    if (a === d) continue;
    const previo = new Map(a.map((x) => [x.id, x]));
    const nuevos = new Set(d.map((x) => x.id));
    for (const x of a) if (!nuevos.has(x.id)) {
      await eliminar(db, col, x.id);
      cambios.push({ coleccion: col, id: x.id, op: "baja" });
    }
    for (const x of d) {
      const p = previo.get(x.id);
      if (!p) {
        await insertar(db, col, x);
        cambios.push({ coleccion: col, id: x.id, op: "alta" });
      } else if (p !== x) {
        await actualizar(db, col, p, x);
        cambios.push({ coleccion: col, id: x.id, op: "cambio" });
      }
    }
  }
  if (antes.config !== despues.config) await guardarConfig(db, despues.config);
  return cambios;
}

/**
 * Numeración con concurrencia optimista: cada contador que avanzó se actualiza solo si
 * nadie lo movió desde que se leyó; si no, la transacción falla y se reintenta.
 */
export async function persistirNumeradores(db: Cliente, antes: Numeradores, despues: Numeradores) {
  for (const [tipo, ultimo] of Object.entries(despues)) {
    const previo = antes[tipo];
    if (previo === ultimo) continue;
    if (previo === undefined) {
      const r = await db.$executeRaw`INSERT INTO "Contador" ("id", "tipo", "ultimo", "actualizadoEn") VALUES (${`cnt_${tipo}`}, ${tipo}, ${ultimo}, now()) ON CONFLICT ("tipo") DO NOTHING`;
      if (r !== 1) throw new ConflictoNumeracion(tipo);
    } else {
      const r = await db.$executeRaw`UPDATE "Contador" SET "ultimo" = ${ultimo}, "actualizadoEn" = now() WHERE "tipo" = ${tipo} AND "ultimo" = ${previo}`;
      if (r !== 1) throw new ConflictoNumeracion(tipo);
    }
  }
}

/** Otro usuario tomó el mismo número al mismo tiempo: se reintenta la transacción. */
export class ConflictoNumeracion extends Error {
  constructor(readonly tipo: string) {
    super(`Conflicto de numeración en ${tipo}`);
  }
}

/** Reserva atómica de un número (para usos fuera de las acciones de negocio). */
export async function siguienteNumero(db: Cliente, tipo: string): Promise<number> {
  const r = await db.$queryRaw<{ ultimo: number }[]>`INSERT INTO "Contador" ("id", "tipo", "ultimo", "actualizadoEn") VALUES (${`cnt_${tipo}`}, ${tipo}, 1, now()) ON CONFLICT ("tipo") DO UPDATE SET "ultimo" = "Contador"."ultimo" + 1, "actualizadoEn" = now() RETURNING "ultimo"`;
  return Number(r[0].ultimo);
}
