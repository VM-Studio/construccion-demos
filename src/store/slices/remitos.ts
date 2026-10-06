import type { Adjunto, CategoriaAdjunto, EntidadAdjunto } from "@/domain/types";
import { puede } from "@/domain/permisos";
import { newId } from "@/lib/utils";
import { ErrorNegocio, ejecutar, exigir } from "../helpers";
import { actualizarEstadoNP, marcarHecho, pasarAPicking } from "../ops";
import type { GetFn, SetFn } from "../types";

export interface AdjuntoInput {
  id?: string;
  entidadTipo: EntidadAdjunto;
  entidadId: string;
  nombre: string;
  tamanoBytes: number;
  tipoMime: string;
  categoria: CategoriaAdjunto;
  blobKey: string;
  url?: string;
}

/** Remitos (picking → hecho, anulación) y metadata de adjuntos (los blobs viven en IndexedDB). */
export function crearSliceRemitos(set: SetFn, get: GetFn) {
  return {
    iniciarPicking: (remitoId: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "remitos.operar");
        pasarAPicking(tx, remitoId);
        const r = tx.must("remitos", remitoId);
        const d = r.despachoId ? tx.find("despachos", r.despachoId) : undefined;
        if (d && d.estado === "ESPERA") tx.patch("despachos", d.id, { estado: "PREPARACION", fechaInicioPreparacion: tx.ahora, operarioId: tx.usuarioId });
      }),

    /** PICKING → HECHO: egreso de stock y entregados en la NP. */
    marcarRemitoHecho: (remitoId: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "remitos.operar");
        const r = tx.must("remitos", remitoId);
        if (r.estado === "INICIAL") pasarAPicking(tx, remitoId);
        else if (r.estado !== "PICKING") throw new ErrorNegocio("El remito no está en picking.");
        marcarHecho(tx, remitoId);
        const d = r.despachoId ? tx.find("despachos", r.despachoId) : tx.get("despachos").find((x) => x.remitoId === remitoId);
        if (d && (d.estado === "ESPERA" || d.estado === "PREPARACION"))
          tx.patch("despachos", d.id, { estado: "FINALIZADO", fechaInicioPreparacion: d.fechaInicioPreparacion ?? tx.ahora, fechaFin: tx.ahora, fechaEntrega: d.modalidad === "RETIRA" ? tx.ahora : undefined });
        return r.numero;
      }),

    anularRemito: (remitoId: string, motivo: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.anular");
        const r = tx.must("remitos", remitoId);
        if (r.estado === "HECHO") throw new ErrorNegocio("El remito ya está hecho: registrá una devolución.");
        if (r.estado === "ANULADO") throw new ErrorNegocio("El remito ya está anulado.");
        tx.patch("remitos", remitoId, { estado: "ANULADO", comentario: [r.comentario, `Anulado: ${motivo}`].filter(Boolean).join(" · ") });
        const d = tx.get("despachos").find((x) => x.remitoId === remitoId && (x.estado === "ESPERA" || x.estado === "PREPARACION"));
        if (d) tx.patch("despachos", d.id, { estado: "CANCELADO" });
        if (r.notaPedidoId) actualizarEstadoNP(tx, r.notaPedidoId);
        tx.auditar("Anuló remito", "Remito", remitoId, `${r.numero} · ${motivo}`);
      }),

    comentarRemito: (remitoId: string, comentario: string) =>
      ejecutar(get, set, (tx) => {
        tx.patch("remitos", remitoId, { comentario });
      }),

    /** Registra la metadata de un adjunto ya guardado en IndexedDB. */
    registrarAdjunto: (data: AdjuntoInput) =>
      ejecutar(get, set, (tx) => {
        const maxMB = tx.config.tamanoMaxAdjuntoMB || 10;
        if (data.tamanoBytes > maxMB * 1024 * 1024) throw new ErrorNegocio(`El archivo supera el máximo de ${maxMB} MB.`);
        const a: Adjunto = {
          id: data.id ?? newId("adj"),
          entidadTipo: data.entidadTipo,
          entidadId: data.entidadId,
          nombre: data.nombre,
          tamanoBytes: data.tamanoBytes,
          tipoMime: data.tipoMime,
          categoria: data.categoria,
          subidoPor: tx.usuarioId,
          subidoEn: tx.ahora,
          blobKey: data.blobKey,
          url: data.url,
          ...tx.meta(),
        };
        tx.insert("adjuntos", a);
        if (a.entidadTipo === "REMITO" && a.categoria === "REMITO_FIRMADO") {
          tx.patch("remitos", a.entidadId, { firmadoAdjuntoId: a.id });
          tx.auditar("Subió remito firmado", "Remito", a.entidadId, a.nombre);
        } else tx.auditar("Adjuntó archivo", a.entidadTipo, a.entidadId, a.nombre);
        return a.id;
      }),

    /** Elimina la metadata (el blob lo borra `lib/adjuntos`). Solo quien lo subió o DUENO/ADMIN. */
    eliminarAdjuntoMeta: (id: string) =>
      ejecutar(get, set, (tx) => {
        const a = tx.must("adjuntos", id);
        const u = tx.find("usuarios", tx.usuarioId);
        if (a.subidoPor !== tx.usuarioId && !puede(u, "acopios.autorizar")) throw new ErrorNegocio("Solo quien subió el archivo, el dueño o administración pueden eliminarlo.", "PERMISO");
        tx.remove("adjuntos", id);
        if (a.entidadTipo === "REMITO") {
          const r = tx.find("remitos", a.entidadId);
          if (r?.firmadoAdjuntoId === id) {
            const otro = tx.get("adjuntos").find((x) => x.entidadId === r.id && x.categoria === "REMITO_FIRMADO");
            tx.patch("remitos", r.id, { firmadoAdjuntoId: otro?.id });
          }
        }
        tx.auditar("Eliminó adjunto", a.entidadTipo, a.entidadId, a.nombre);
        return a.blobKey;
      }),
  };
}
