/** Servicios del módulo clientes: cada función recibe el actor y corre la acción en el motor transaccional. */
import { servicio } from "./base";

export const guardarCliente = servicio("guardarCliente");
export const guardarObra = servicio("guardarObra");
export const importarClientes = servicio("importarClientes");
