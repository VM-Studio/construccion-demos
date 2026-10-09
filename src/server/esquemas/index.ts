/**
 * Esquemas zod de entrada de cada acción expuesta: validan la TUPLA de argumentos que llega
 * a la server action antes de llamar al servicio (`correr.ts`). Solo estructura, tipos y
 * límites; las reglas de negocio las aplica el dominio.
 *
 * El compilador garantiza que cada esquema produce exactamente los parámetros de su acción
 * (ver `Chequeo` abajo): si cambia la firma de una acción y no su esquema, no compila.
 */
import type { z } from "zod";
import type { AccionesNegocio } from "@/store/negocio";
import type { NombreExpuesto } from "../servicios/registro";
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

type Esquemas = { [N in NombreExpuesto]: z.ZodType<Parameters<AccionesNegocio[N]>> };

const esquemas = {
  ...catalogo,
  ...clientes,
  ...proveedores,
  ...compras,
  ...stock,
  ...ventas,
  ...remitos,
  ...acopios,
  ...despachos,
  ...finanzas,
  ...configuracion,
} satisfies Esquemas;

// ── Igualdad exacta (incluidas claves opcionales) entre la salida del esquema y la firma ──
type Primitivo = string | number | boolean | bigint | symbol | null | undefined;
/** Normaliza la representación (intersecciones, readonly de zod) sin perder claves ni opcionalidad. */
type Normalizar<T> = T extends Primitivo ? T : T extends (...a: never[]) => unknown ? T : { -readonly [K in keyof T]: Normalizar<T[K]> };
type Igual<A, B> = (<T>() => T extends Normalizar<A> ? 1 : 2) extends <T>() => T extends Normalizar<B> ? 1 : 2 ? true : false;
/** Acciones cuyo esquema no coincide exactamente con la firma (el error de compilación las nombra). */
type NoCoinciden = { [N in NombreExpuesto]: Igual<z.output<(typeof esquemas)[N]>, Parameters<AccionesNegocio[N]>> extends true ? never : N }[NombreExpuesto];
/** Esquemas exportados por los módulos que no corresponden a ninguna acción expuesta. */
type Sobrantes = Exclude<keyof typeof esquemas, NombreExpuesto>;
const _coinciden: [NoCoinciden | Sobrantes] extends [never] ? true : NoCoinciden | Sobrantes = true;
void _coinciden;

export const ESQUEMAS: Esquemas = esquemas;
