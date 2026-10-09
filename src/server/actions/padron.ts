"use server";
/**
 * Consulta del padrón desde los formularios (nunca desde el navegador directo): exige sesión y
 * permiso de crear clientes o proveedores; máximo 30 consultas por minuto por usuario.
 */
import { z } from "zod";
import { puede } from "@/domain/permisos";
import type { DatosPadron } from "@/domain/padron";
import { exigirActor, ErrorSesion } from "../auth/actor";
import { consultarPadron, estadoPadron } from "../servicios/padron";

type Res<T> = { ok: true; data: T } | { ok: false; error: string; codigo?: string };

const LIMITE = 30;
const ventanas = new Map<string, number[]>();

function dentroDelLimite(usuarioId: string): boolean {
  const ahora = Date.now();
  const v = (ventanas.get(usuarioId) ?? []).filter((t) => ahora - t < 60_000);
  if (v.length >= LIMITE) return false;
  v.push(ahora);
  ventanas.set(usuarioId, v);
  return true;
}

export async function consultarPadronAction(cuit: string, opts: { forzar?: boolean } = {}): Promise<Res<DatosPadron | null>> {
  const e = z.object({ cuit: z.string().max(20), forzar: z.boolean().optional() }).safeParse({ cuit, forzar: opts.forzar });
  if (!e.success) return { ok: false, error: "CUIT inválido." };
  try {
    const actor = await exigirActor();
    if (!puede(actor, "clientes.editar") && !puede(actor, "proveedores.editar")) return { ok: false, error: "No tenés permiso para consultar el padrón.", codigo: "PERMISO" };
    if (!dentroDelLimite(actor.id)) return { ok: false, error: "Hiciste muchas consultas seguidas: esperá un minuto.", codigo: "LIMITE" };
    return { ok: true, data: await consultarPadron(e.data.cuit, { forzar: e.data.forzar }) };
  } catch (err) {
    if (err instanceof ErrorSesion) return { ok: false, error: err.message, codigo: err.codigo };
    console.error("[padron]", err);
    return { ok: true, data: null };
  }
}

export async function estadoPadronAction(): Promise<Res<ReturnType<typeof estadoPadron>>> {
  try {
    await exigirActor();
    return { ok: true, data: estadoPadron() };
  } catch {
    return { ok: false, error: "Tu sesión terminó." };
  }
}
