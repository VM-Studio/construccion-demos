/** Esquemas de entrada (tupla de argumentos) de las acciones del módulo finanzas. */
import { z } from "zod";
import { circuito, estadoCheque, fecha, fechaOpcional, id, imputacion, lista, medioCobro, moneda, monto, ref, texto } from "./comunes";

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
export const anularCobranza = z.tuple([id, texto]);
export const anularPagoProveedor = z.tuple([id, texto]);
export const cargarSaldoInicial = z.tuple([saldoInicialInput]);
export const cambiarEstadoCheque = z.tuple([id, estadoCheque]);

export const aplicarSaldoAFavor = z.tuple([id, lista(imputacion)]);
export const guardarCaja = z.tuple([z.object({ nombre: texto, descripcion: texto.optional(), sucursalId: ref.optional(), activa: z.boolean() }), id.optional()]);
export const registrarMovimientoCaja = z.tuple([
  z.object({ cajaId: id, fecha, tipo: z.enum(["INGRESO", "EGRESO", "APERTURA"]), moneda, importe: monto, concepto: texto, categoria: texto.optional(), observaciones: texto.optional() }),
]);
export const transferirEntreCajas = z.tuple([
  z.object({ origenId: id, destinoId: id, fecha, moneda, importe: monto, tipo: z.enum(["TRANSFERENCIA", "PRESTAMO", "DEVOLUCION_PRESTAMO"]), concepto: texto.optional() }),
]);
export const anularMovimientoCaja = z.tuple([id, texto]);
export const registrarArqueo = z.tuple([
  z.object({
    cajaId: id,
    moneda,
    contado: monto,
    billetes: lista(z.object({ denominacion: monto, cantidad: z.number().int().nonnegative() }), 30).optional(),
    observaciones: texto.optional(),
    ajustar: z.boolean().optional(),
  }),
]);
