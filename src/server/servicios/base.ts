/**
 * Fábrica de servicios: cada acción de negocio expuesta es una función `(actor, ...args)` que
 * verifica el permiso del actor (nunca datos de rol que mande el cliente), calcula las filas a
 * bloquear y corre la acción en el motor transaccional.
 */
import { puede } from "@/domain/permisos";
import type { Usuario } from "@/domain/types";
import type { AccionesNegocio } from "@/store/negocio";
import { ejecutarAccion, type ResultadoServidor } from "../motor";
import { obtenerEstado } from "../estado";
import { REGISTRO, type NombreExpuesto } from "./registro";

export class ErrorPermiso extends Error {
  readonly codigo = "PERMISO";
  constructor() {
    super("No tenés permiso para realizar esta acción.");
  }
}

/** Id del diccionario de impactos según los datos de la acción (variantes de acopio, estados). */
function accionIdDe(nombre: NombreExpuesto, args: unknown[], porDefecto?: string): string | undefined {
  const a0 = args[0] as Record<string, unknown> | string | undefined;
  if (nombre === "crearNotaPedido") return (a0 as { origen?: string })?.origen === "ACOPIO" ? "confirmarNotaPedidoAcopio" : "confirmarNotaPedidoNueva";
  if (nombre === "cambiarEstadoOC") return args[1] === "CONFIRMADA" ? "confirmarOrdenCompra" : args[1] === "ENVIADA" ? "enviarOrdenCompra" : args[1] === "CANCELADA" ? "cancelarOrdenCompra" : "crearOrdenCompra";
  if (nombre === "guardarProducto" && args[1]) return "editarArticulo";
  if (nombre === "guardarCliente" && args[1]) return "editarCliente";
  if (nombre === "guardarProveedor" && args[1]) return "editarProveedor";
  if (nombre === "guardarObra" && args[1]) return "editarObra";
  if (nombre === "cambiarEstadoCotizacion" && args[1] === "RECHAZADA") return "rechazarCotizacion";
  if (nombre === "crearAjuste" && ((a0 as { items?: { motivo: string }[] })?.items ?? []).every((i) => i.motivo === "INVENTARIO_INICIAL")) return "inventarioInicial";
  return porDefecto;
}

/** Actor de la sesión, opcionalmente con IP y navegador para la auditoría. */
export type Actor = Usuario | { actor: Usuario; ip?: string; userAgent?: string };

export function servicio<N extends NombreExpuesto>(nombre: N) {
  return async (quien: Actor, ...args: Parameters<AccionesNegocio[N]>): Promise<ResultadoServidor> => {
    const ctx = "actor" in quien ? quien : { actor: quien };
    const actor = ctx.actor;
    const def = REGISTRO[nombre];
    const permisos = Array.isArray(def.permiso) ? def.permiso : [def.permiso];
    if (!permisos.some((p) => puede(actor, p))) throw new ErrorPermiso();
    const { db } = await obtenerEstado();
    const bloqueos = (def.bloqueos as ((a: unknown, d: unknown) => ReturnType<NonNullable<typeof def.bloqueos>>) | undefined)?.(args, db);
    let accionId = accionIdDe(nombre, args as unknown[], def.accionId);
    if (nombre === "confirmarNotaPedido") accionId = db.notasPedido.find((n) => n.id === args[0])?.origen === "ACOPIO" ? "confirmarNotaPedidoAcopio" : "confirmarNotaPedidoNueva";
    return ejecutarAccion(ctx, nombre, args, { accionId, bloqueos });
  };
}
