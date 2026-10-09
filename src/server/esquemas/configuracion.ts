/** Esquemas de entrada (tupla de argumentos) de las acciones del módulo configuración. */
import { z } from "zod";
import { categoriaAdjunto, codigoUnidadNegocio, enteroNoNegativo, id, lista, porcentaje, ref, rol, texto } from "./comunes";

const datosEmpresa = z.object({
  empresa: texto,
  razonSocial: texto,
  cuit: texto,
  direccion: texto,
  telefono: texto,
  email: texto,
});

const motivoAjuste = z.object({ codigo: z.string().min(1).max(100), nombre: texto, activo: z.boolean() });

/** `Partial<Omit<Configuracion, "empresa">>`. */
const configPatch = z
  .object({
    ivaPct: porcentaje,
    validezPresupuestoDias: enteroNoNegativo,
    diasVencimientoAcopio: enteroNoNegativo,
    alicuotaIIBBPct: porcentaje,
    alertaStockMinimo: z.boolean(),
    umbralSubaCostoPct: porcentaje,
    tipoCambioUSD: z.number().finite().nonnegative().optional(),
    tipoCambioModo: z.enum(["AUTO", "MANUAL"]).optional(),
    tipoCambioManual: z.number().finite().nonnegative().optional(),
    tamanoMaxAdjuntoMB: z.number().finite().positive().max(1000),
    categoriasAdjunto: lista(z.object({ codigo: categoriaAdjunto, nombre: texto }), 20),
    motivosAjuste: lista(motivoAjuste, 200),
  })
  .partial();

const sucursalInput = z.object({
  nombre: texto,
  direccion: texto,
  telefono: texto,
  puntoVenta: z.string().max(20),
  puntoVentaRemito: z.string().max(20),
  depositoNombre: texto,
  depositoDireccion: texto,
  posiciones: lista(texto, 200),
});

const usuarioInput = z.object({
  nombre: texto,
  apellido: texto.optional(),
  email: texto,
  rol,
  sucursalId: ref.optional(),
  activo: z.boolean(),
  avatarIniciales: z.string().max(10),
});

const unidadNegocioInput = z.object({ nombre: texto, codigo: codigoUnidadNegocio, rubroIds: lista(id, 500) });

export const actualizarConfig = z.tuple([configPatch]);
export const actualizarEmpresa = z.tuple([datosEmpresa]);
export const guardarSucursal = z.tuple([sucursalInput, id.optional()]);
export const guardarUsuario = z.tuple([usuarioInput, id.optional()]);
export const guardarUnidadNegocio = z.tuple([unidadNegocioInput, id.optional()]);
export const establecerNumeroInicial = z.tuple([z.string().min(1).max(200), z.number().int().nonnegative().max(99_999_999)]);
export const guardarMotivosAjuste = z.tuple([lista(motivoAjuste, 200)]);
export const registrarEvento = z.tuple([texto, texto, texto, texto.optional()]);
