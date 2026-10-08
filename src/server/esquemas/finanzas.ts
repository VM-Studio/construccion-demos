/** Esquemas de entrada (tupla de argumentos) de las acciones del módulo finanzas. */
import { z } from "zod";
import { circuito, estadoCheque, fecha, fechaOpcional, id, imputacion, lista, medioCobro, monto, ref, texto } from "./comunes";

const cobranzaInput = z.object({
  clienteId: ref,
  circuito,
  fecha,
  sucursalId: ref.optional(),
  medios: lista(medioCobro, 50),
  imputaciones: lista(imputacion),
  observaciones: texto.optional(),
});

const pagoInput = z.object({
  proveedorId: ref,
  circuito,
  fecha,
  medios: lista(medioCobro, 50),
  imputaciones: lista(imputacion),
  observaciones: texto.optional(),
});

const saldoInicialInput = z.object({
  tipo: z.enum(["cliente", "proveedor"]),
  entidadId: id,
  importe: monto,
  fecha,
  circuito,
  aFavor: z.boolean().optional(),
  vencimiento: fechaOpcional,
  observaciones: texto.optional(),
});

export const registrarCobranza = z.tuple([cobranzaInput]);
export const registrarPagoProveedor = z.tuple([pagoInput]);
export const cargarSaldoInicial = z.tuple([saldoInicialInput]);
export const cambiarEstadoCheque = z.tuple([id, estadoCheque]);
