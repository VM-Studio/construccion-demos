/** Servicios del módulo catalogo: cada función recibe el actor y corre la acción en el motor transaccional. */
import { servicio } from "./base";

export const guardarProducto = servicio("guardarProducto");
export const actualizarPrecio = servicio("actualizarPrecio");
export const aplicarCambiosPrecios = servicio("aplicarCambiosPrecios");
export const guardarLista = servicio("guardarLista");
export const guardarRubro = servicio("guardarRubro");
export const importarArticulos = servicio("importarArticulos");
