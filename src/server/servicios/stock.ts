/** Servicios del módulo stock: cada función recibe el actor y corre la acción en el motor transaccional. */
import { servicio } from "./base";

export const crearTransferencia = servicio("crearTransferencia");
export const despacharTransferencia = servicio("despacharTransferencia");
export const recibirTransferencia = servicio("recibirTransferencia");
export const cancelarTransferencia = servicio("cancelarTransferencia");
export const crearAjuste = servicio("crearAjuste");
