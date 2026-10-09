/** Todas las server actions de negocio, por nombre (las usa el cliente del store). */
import * as catalogo from "./catalogo";
import * as clientes from "./clientes";
import * as proveedores from "./proveedores";
import * as compras from "./compras";
import * as stock from "./stock";
import * as ventas from "./ventas";
import * as remitos from "./remitos";
import * as acopios from "./acopios";
import * as despachos from "./despachos";
import * as finanzas from "./finanzas";
import * as configuracion from "./configuracion";

export const ACCIONES_SERVIDOR = { ...catalogo, ...clientes, ...proveedores, ...compras, ...stock, ...ventas, ...remitos, ...acopios, ...despachos, ...finanzas, ...configuracion };
