/** Servicios del módulo configuracion: cada función recibe el actor y corre la acción en el motor transaccional. */
import { servicio } from "./base";

export const actualizarConfig = servicio("actualizarConfig");
export const actualizarEmpresa = servicio("actualizarEmpresa");
export const guardarSucursal = servicio("guardarSucursal");
export const guardarUsuario = servicio("guardarUsuario");
export const guardarUnidadNegocio = servicio("guardarUnidadNegocio");
export const establecerNumeroInicial = servicio("establecerNumeroInicial");
export const guardarMotivosAjuste = servicio("guardarMotivosAjuste");
export const registrarEvento = servicio("registrarEvento");

import { Prisma } from "@prisma/client";
import { prisma } from "../db-base";
import { insertar } from "../datos/mapeo";
import { invalidarCache } from "../estado";
import type { Usuario } from "@/domain/types";

/**
 * Registro del primer dueño (base sin usuarios). Transacción con lock sobre la fila de
 * Configuracion: si dos personas se registran a la vez, solo una queda como primer dueño.
 */
export async function registrarPrimerDueno(datos: { nombre: string; email: string }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const id = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Configuracion" WHERE "id" = 'config' FOR UPDATE`;
        if ((await tx.usuario.count()) > 0) return null;
        const ahora = new Date().toISOString();
        const iniciales = datos.nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "D";
        const u: Usuario = { id: `usr_${Date.now().toString(36)}`, nombre: datos.nombre, email: datos.email.toLowerCase(), rol: "DUENO", activo: true, avatarIniciales: iniciales, creadoEn: ahora, actualizadoEn: ahora };
        await insertar(tx, "usuarios", u);
        await insertar(tx, "auditoria", { id: `aud_${Date.now().toString(36)}`, fecha: ahora, usuarioId: u.id, accion: "Registro del primer dueño", entidad: "Usuario", entidadId: u.id, detalle: u.email, creadoEn: ahora, actualizadoEn: ahora });
        await tx.cambio.create({ data: { tipos: ["Usuario"], entidadIds: [u.id], usuarioId: u.id, resumen: "se registró como primer dueño" } });
        return u.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    invalidarCache();
    return id ? { ok: true, id } : { ok: false, error: "Ya existe un dueño registrado: pedile que te cree un usuario." };
  } catch {
    return { ok: false, error: "No se pudo registrar. Probá de nuevo." };
  }
}
