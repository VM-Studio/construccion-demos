/** Servicios del módulo despachos: cada función recibe el actor y corre la acción en el motor transaccional. */
import { servicio } from "./base";

export const crearDespacho = servicio("crearDespacho");
export const programarEntregas = servicio("programarEntregas");
export const iniciarPreparacion = servicio("iniciarPreparacion");
export const finalizarDespacho = servicio("finalizarDespacho");
export const asignarPosicion = servicio("asignarPosicion");
export const reprogramarDespacho = servicio("reprogramarDespacho");
export const cancelarDespacho = servicio("cancelarDespacho");
export const marcarEntregado = servicio("marcarEntregado");
export const asignarAHojaRuta = servicio("asignarAHojaRuta");
export const quitarDeHojaRuta = servicio("quitarDeHojaRuta");
export const moverEnHojaRuta = servicio("moverEnHojaRuta");
export const cambiarChoferHoja = servicio("cambiarChoferHoja");
export const iniciarRecorrido = servicio("iniciarRecorrido");
export const cerrarHojaRuta = servicio("cerrarHojaRuta");
export const guardarVehiculo = servicio("guardarVehiculo");
export const guardarChofer = servicio("guardarChofer");
