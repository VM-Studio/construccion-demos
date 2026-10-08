/**
 * Motor de escritura del servidor. Toda acción de negocio pasa por acá:
 * 1. Lee el estado vigente (caché por versión) y corre la acción del dominio (src/store/negocio.ts,
 *    reglas de src/domain/) en memoria, con el actor de la sesión como usuario.
 * 2. Mide los efectos reales (modo capacitación) comparando antes y después.
 * 3. En una transacción Serializable: lock global de escritura, verificación de que nadie escribió
 *    desde la lectura (si no, reintenta), FOR UPDATE de las filas de stock / acopio involucradas,
 *    persistencia de SOLO lo que cambió, numeración con concurrencia optimista, auditoría con
 *    efectos y una fila de Cambio para la sincronización en vivo.
 * 4. Reintenta hasta 3 veces ante conflictos (P2034 / numeración / versión) con backoff 50/150/400 ms.
 */
import { Prisma } from "@prisma/client";
import type { Auditoria, EstadoInicial, Usuario } from "@/domain/types";
import { crearAccionesNegocio, type AccionesNegocio, type NombreAccion } from "@/store/negocio";
import { CAPACITACION_INICIAL } from "@/capacitacion/slice";
import { comparar, foto } from "@/capacitacion/efectos";
import type { Diferencia } from "@/capacitacion/slice";
import type { StoreBase } from "@/store/types";
import { prisma } from "./db-base";
import { COLECCIONES, ConflictoNumeracion, MODELOS, persistirDiferencias, persistirNumeradores, type Cliente, type Coleccion } from "./datos/mapeo";
import { actualizarCache, obtenerEstado, versionActual } from "./estado";
import { aDominio, obtenerVigente } from "./servicios/tipoCambio";

/**
 * Tipo de cambio vigente para las reglas del dominio: se inyecta como `config.tipoCambioVigente`
 * antes de correr la acción y se quita del resultado (no es un campo de la base).
 */
async function conTipoCambio(db: EstadoInicial): Promise<EstadoInicial> {
  try {
    const v = aDominio(await obtenerVigente(db.config));
    return v ? { ...db, config: { ...db.config, tipoCambioVigente: v } } : db;
  } catch (e) {
    console.warn("[motor] no se pudo obtener el tipo de cambio", e);
    return db;
  }
}

/** Saca el tipo de cambio inyectado: si la acción no tocó la configuración, vuelve la original. */
function sinTipoCambio(original: EstadoInicial, inyectado: EstadoInicial, despues: EstadoInicial): EstadoInicial {
  if (despues.config === inyectado.config) return { ...despues, config: original.config };
  const { tipoCambioVigente: _tc, ...config } = despues.config;
  void _tc;
  return { ...despues, config };
}

export interface Bloqueos {
  /** Filas de StockDeposito a bloquear (se crean si faltan). */
  stock?: { productoIds: string[]; depositoIds: string[] };
  acopioIds?: string[];
}

export interface Contexto {
  actor: Usuario;
  ip?: string;
  userAgent?: string;
}

export type ResultadoServidor<T = unknown> = { ok: true; data: T; efectos: Diferencia[]; tipos: string[] } | { ok: false; error: string; codigo?: string };

class ConflictoVersion extends Error {}

const BACKOFF = [50, 150, 400];
const esReintentable = (e: unknown) =>
  e instanceof ConflictoVersion ||
  e instanceof ConflictoNumeracion ||
  (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2034" || e.code === "P2002")) ||
  /could not serialize|deadlock detected|40001/i.test(String((e as Error)?.message ?? ""));

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Corre la acción del dominio en memoria sobre `antes`. */
function correrEnMemoria(antes: EstadoInicial, actor: Usuario, nombre: NombreAccion, args: unknown[]) {
  let despues = antes;
  const base = (): StoreBase => ({
    db: despues,
    ui: { usuarioId: actor.id, sucursalActivaId: null, unidadNegocioId: null, moduloActivo: null, favoritosModulos: {}, favoritosPaginas: {}, sidebarColapsado: false, tourVisto: {}, tourAbierto: false, guiaOculta: {} },
    hidratado: true,
    capacitacion: CAPACITACION_INICIAL,
  });
  const acciones = crearAccionesNegocio(
    (p) => {
      const parche = typeof p === "function" ? p(base()) : p;
      if (parche.db) despues = parche.db;
    },
    base,
  );
  const fn = acciones[nombre] as unknown as (...a: unknown[]) => { ok: boolean; data?: unknown; error?: string; codigo?: string };
  const r = fn(...args);
  return { r, despues };
}

async function bloquear(tx: Cliente, b: Bloqueos | undefined) {
  if (b?.stock?.productoIds.length && b.stock.depositoIds.length) {
    const { productoIds, depositoIds } = b.stock;
    for (const d of depositoIds)
      for (const p of productoIds)
        await tx.$executeRaw`INSERT INTO "StockDeposito" ("id", "productoId", "depositoId", "cantidadFisica", "actualizadoEn") VALUES (${`stk_${p}_${d}`}, ${p}, ${d}, 0, now()) ON CONFLICT ("productoId", "depositoId") DO NOTHING`;
    await tx.$queryRaw`SELECT "id" FROM "StockDeposito" WHERE "productoId" = ANY(${productoIds}) AND "depositoId" = ANY(${depositoIds}) ORDER BY "id" FOR UPDATE`;
  }
  if (b?.acopioIds?.length) await tx.$queryRaw`SELECT "id" FROM "Acopio" WHERE "id" = ANY(${b.acopioIds}) ORDER BY "id" FOR UPDATE`;
}

const ACCION_A_VERBO = (a: Auditoria) => `${a.accion.charAt(0).toLowerCase()}${a.accion.slice(1)} ${a.detalle.split(" · ")[0]}`.trim();

/** Link a la pantalla de la entidad principal de una acción (para el aviso a los demás usuarios). */
export function hrefEntidad(entidad: string, id: string): string | undefined {
  const m: Record<string, (id: string) => string> = {
    NotaPedido: (x) => `/ventas/notas-pedido/${x}`,
    Acopio: (x) => `/acopios/${x}`,
    Remito: (x) => `/remitos/${x}`,
    OrdenCompra: (x) => `/compras/oc/${x}`,
    AcopioProveedor: (x) => `/proveedores/acopios/${x}`,
    Cliente: (x) => `/clientes/${x}`,
    Proveedor: (x) => `/proveedores/${x}`,
    Producto: (x) => `/productos?id=${x}`,
    Despacho: (x) => `/despachos?despacho=${x}`,
    Cobranza: () => "/ventas/recibos",
    PagoProveedor: () => "/compras/ordenes-pago",
    Comprobante: (x) => `/ventas/comprobantes?id=${x}`,
    TransferenciaStock: (x) => `/stock/transferencias?id=${x}`,
    AjusteStock: (x) => `/stock/ajustes?id=${x}`,
  };
  return m[entidad]?.(id);
}

/**
 * Ejecuta una acción de negocio en el servidor. `accionId` es la clave del diccionario de
 * impactos (modo capacitación); `nombre` la acción del dominio.
 */
export async function ejecutarAccion<N extends NombreAccion>(
  ctx: Contexto,
  nombre: N,
  args: Parameters<AccionesNegocio[N]>,
  opts: { accionId?: string; bloqueos?: Bloqueos } = {},
): Promise<ResultadoServidor> {
  for (let intento = 0; intento <= BACKOFF.length; intento++) {
    const { version, db: antes } = await obtenerEstado();
    const inyectado = await conTipoCambio(antes);
    const corrida = correrEnMemoria(inyectado, ctx.actor, nombre, args as unknown[]);
    const r = corrida.r;
    const despues = corrida.despues === inyectado ? antes : sinTipoCambio(antes, inyectado, corrida.despues);
    if (!r.ok) return { ok: false, error: r.error ?? "No se pudo completar la acción.", codigo: r.codigo };
    if (despues === antes) return { ok: true, data: r.data, efectos: [], tipos: [] };

    // Efectos reales (modo capacitación), medidos sobre el estado leído y el resultante.
    let efectos: Diferencia[] = [];
    try {
      efectos = comparar(foto(antes, ctx.actor.id), foto(despues, ctx.actor.id), despues);
    } catch (e) {
      console.warn("[motor] no se pudieron medir los efectos", e);
    }
    // La auditoría de esta acción guarda los efectos, el id de acción, IP y navegador.
    const nuevasAud = despues.auditoria.filter((a) => !antes.auditoria.some((b) => b.id === a.id));
    const final: EstadoInicial = {
      ...despues,
      auditoria: despues.auditoria.map((a, i) => (nuevasAud.includes(a) ? { ...a, accionId: opts.accionId ?? nombre, efectos: i === despues.auditoria.length - 1 ? efectos : undefined, ip: ctx.ip, userAgent: ctx.userAgent } : a)),
    };

    try {
      const { idCambio, tipos } = await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(42424242)`;
          if ((await versionActual(tx)) !== version) throw new ConflictoVersion();
          await bloquear(tx, opts.bloqueos);
          const cambios = await persistirDiferencias(tx, antes, final, COLECCIONES);
          await persistirNumeradores(tx, antes.numeradores, final.numeradores);
          const tipos: string[] = [...new Set(cambios.filter((c) => c.coleccion !== "auditoria").map((c) => MODELOS[c.coleccion as Coleccion] as string))];
          if (final.config !== antes.config) tipos.push("Configuracion");
          if (final.numeradores !== antes.numeradores) tipos.push("Contador");
          const principal = nuevasAud.at(-1);
          const cambio = await tx.cambio.create({
            data: {
              tipos,
              entidadIds: [...new Set(cambios.filter((c) => c.coleccion !== "auditoria" && c.coleccion !== "movimientos").map((c) => c.id))].slice(0, 100),
              usuarioId: ctx.actor.id,
              resumen: principal ? ACCION_A_VERBO(principal) : null,
              href: principal ? (hrefEntidad(principal.entidad, principal.entidadId) ?? null) : null,
            },
          });
          return { idCambio: cambio.id, tipos };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 },
      );
      actualizarCache(idCambio, final);
      return { ok: true, data: r.data, efectos, tipos };
    } catch (e) {
      if (esReintentable(e) && intento < BACKOFF.length) {
        await espera(BACKOFF[intento]);
        continue;
      }
      console.error(`[motor] ${nombre} falló`, e);
      return { ok: false, error: "No se pudo guardar. Probá de nuevo en unos segundos.", codigo: "ERROR_SERVIDOR" };
    }
  }
  return { ok: false, error: "Otro usuario estaba guardando lo mismo: probá de nuevo.", codigo: "CONFLICTO" };
}
