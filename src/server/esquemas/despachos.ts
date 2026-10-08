/** Esquemas de entrada (tupla de argumentos) de las acciones del módulo despachos (entregas y hojas de ruta). */
import { z } from "zod";
import { cantidad, fecha, fechaOpcional, id, lineaEntrega, lista, modalidadEntrega, ref, texto } from "./comunes";

const despachoInput = z.object({
  notaPedidoId: id,
  lineas: lista(lineaEntrega).optional(),
  modalidad: modalidadEntrega.optional(),
  fechaProgramada: fechaOpcional,
  posicion: texto.optional(),
  direccionEntrega: texto.optional(),
  observaciones: texto.optional(),
});

const vehiculoInput = z.object({
  patente: texto,
  descripcion: texto,
  capacidadKg: cantidad,
  choferId: ref.optional(),
  activo: z.boolean(),
});

const choferInput = z.object({
  nombre: texto,
  telefono: texto,
  activo: z.boolean(),
});

export const crearDespacho = z.tuple([despachoInput]);
export const programarEntregas = z.tuple([
  lista(z.object({ notaPedidoId: id, itemId: id, cantidad })),
  z.object({ fechaProgramada: fechaOpcional, modalidad: modalidadEntrega.optional() }).optional(),
]);
export const iniciarPreparacion = z.tuple([id, texto.optional()]);
export const finalizarDespacho = z.tuple([id]);
export const asignarPosicion = z.tuple([id, texto]);
export const reprogramarDespacho = z.tuple([id, fecha, texto.optional()]);
export const cancelarDespacho = z.tuple([id]);
export const marcarEntregado = z.tuple([id, texto.optional()]);
export const asignarAHojaRuta = z.tuple([id, id, fecha]);
export const quitarDeHojaRuta = z.tuple([id]);
export const moverEnHojaRuta = z.tuple([id, id, z.union([z.literal(-1), z.literal(1)])]);
export const cambiarChoferHoja = z.tuple([id, id]);
export const iniciarRecorrido = z.tuple([id]);
export const cerrarHojaRuta = z.tuple([id]);
export const guardarVehiculo = z.tuple([vehiculoInput, id.optional()]);
export const guardarChofer = z.tuple([choferInput, id.optional()]);
