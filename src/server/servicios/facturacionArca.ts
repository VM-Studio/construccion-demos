/**
 * Factura electrónica: pide el CAE a ARCA (WSFEv1) para los comprobantes del circuito 1 que
 * quedaron en `arcaEstado: "PENDIENTE"` y registra el resultado con la acción de dominio
 * `registrarResultadoArca` (autorizado con CAE, o rechazado con el motivo para reintentar).
 *
 * Nunca lanza: cualquier error queda registrado en el comprobante como `{ ok: false, error }`.
 * Las solicitudes se serializan por proceso para que dos facturas no tomen el mismo número.
 */
import type { Comprobante, EstadoInicial, Usuario } from "@/domain/types";
import { configArca, ErrorArca } from "../arca/config";
import { type CbteAsociado, CONDICION_IVA_RECEPTOR, documentoReceptor, fechaArca, solicitarCAE, tipoCbteArca, ultimoAutorizado } from "../arca/wsfe";
import { obtenerEstado } from "../estado";
import { ejecutarAccion } from "../motor";

type Contexto = { actor: Usuario; ip?: string; userAgent?: string };
type ResultadoArca = { ok: true; cae: string; caeVencimiento: string; puntoVenta: number; numero: number; tipo: number } | { ok: false; error: string };

const SIN_CERTIFICADO = "Falta configurar el certificado de ARCA para factura electrónica (ver docs/ARCA-FACTURACION.md).";
const SIN_PUNTO_VENTA = "Falta configurar el punto de venta electrónico de ARCA (ARCA_PUNTO_VENTA, ver docs/ARCA-FACTURACION.md).";

/** Punto de venta habilitado para web services (variable ARCA_PUNTO_VENTA). */
function puntoVentaArca(): number | null {
  const n = Number((process.env.ARCA_PUNTO_VENTA ?? "").trim());
  return Number.isInteger(n) && n > 0 && n < 100_000 ? n : null;
}

/** Cola por proceso: cada autorización espera a que termine la anterior. */
let cola: Promise<unknown> = Promise.resolve();
function enCola<T>(fn: () => Promise<T>): Promise<T> {
  const p = cola.then(fn, fn);
  cola = p.catch(() => undefined);
  return p;
}

const mensajeError = (e: unknown) =>
  e instanceof ErrorArca ? (e.tipo === "OTRO" && e.detalle ? `${e.message} ${e.detalle}` : e.message) : `No se pudo pedir el CAE a ARCA: ${e instanceof Error ? e.message : String(e)}`;

/** Arma la solicitud y pide el CAE de un comprobante. Devuelve el resultado a registrar. */
async function autorizar(db: EstadoInicial, c: Comprobante): Promise<ResultadoArca> {
  const cfg = configArca();
  if (!cfg) return { ok: false, error: SIN_CERTIFICADO };
  const puntoVenta = puntoVentaArca();
  if (!puntoVenta) return { ok: false, error: SIN_PUNTO_VENTA };

  const tipo = tipoCbteArca(c.tipo, c.letra);
  if (!tipo) return { ok: false, error: "Este tipo de comprobante no se autoriza en ARCA." };

  const cliente = c.clienteId ? db.clientes.find((x) => x.id === c.clienteId) : undefined;
  const { docTipo, docNro } = documentoReceptor(c.compradorDoc?.trim() || cliente?.cuit);
  // Condición del cliente solo si el documento es su CUIT; si no, consumidor final.
  const esCuitCliente = docTipo === 80 && !!cliente && cliente.cuit.replace(/\D/g, "") === docNro;
  const condicion = esCuitCliente && cliente ? cliente.condicionIVA : "CF";
  if (c.letra === "A" && docTipo !== 80) return { ok: false, error: "La factura A necesita el CUIT del cliente." };

  let asociados: CbteAsociado[] | undefined;
  if (c.tipo === "NOTA_CREDITO") {
    const origen = c.comprobanteOrigenId ? db.comprobantes.find((x) => x.id === c.comprobanteOrigenId) : undefined;
    if (!origen) return { ok: false, error: "La nota de crédito no tiene factura de origen: ARCA la exige." };
    if (!origen.arcaNumero || !origen.arcaPuntoVenta || !origen.arcaTipo) return { ok: false, error: `La factura de origen (${origen.numero}) todavía no tiene CAE: autorizala primero.` };
    asociados = [{ tipo: origen.arcaTipo, puntoVenta: origen.arcaPuntoVenta, numero: origen.arcaNumero, cuit: cfg.cuit, fecha: fechaArca(origen.fecha) }];
  }

  const numero = (await ultimoAutorizado(cfg, puntoVenta, tipo)) + 1;
  const r = await solicitarCAE(cfg, {
    puntoVenta,
    cbteTipo: tipo,
    numero,
    fecha: c.fecha,
    docTipo,
    docNro,
    condicionIVAReceptor: CONDICION_IVA_RECEPTOR[condicion],
    neto: c.subtotal,
    iva: c.iva,
    asociados,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, cae: r.cae, caeVencimiento: r.caeVencimiento, puntoVenta, numero, tipo };
}

async function procesar(ctx: Contexto, id: string): Promise<void> {
  let resultado: ResultadoArca;
  try {
    const { db } = await obtenerEstado();
    const c = db.comprobantes.find((x) => x.id === id);
    if (!c || c.arcaEstado !== "PENDIENTE") return;
    resultado = await autorizar(db, c);
  } catch (e) {
    resultado = { ok: false, error: mensajeError(e) };
  }
  try {
    const r = await ejecutarAccion(ctx, "registrarResultadoArca", [id, resultado], { accionId: "autorizarArca" });
    if (!r.ok) console.error("[arca] no se pudo registrar el resultado de", id, r.error);
  } catch (e) {
    console.error("[arca] no se pudo registrar el resultado de", id, e);
  }
}

/** Pide el CAE de cada comprobante pendiente (de a uno por proceso). Nunca lanza. */
export async function autorizarComprobantesArca(ctx: Contexto, ids: string[]): Promise<void> {
  for (const id of ids) await enCola(() => procesar(ctx, id));
}
