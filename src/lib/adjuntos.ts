"use client";

/**
 * Adjuntos: los archivos (blobs) viven en IndexedDB con `idb-keyval`; en el store
 * (localStorage) solo se guarda la metadata. Así no se llena el almacenamiento.
 */
import { del, get, set } from "idb-keyval";
import { nanoid } from "nanoid";
import type { CategoriaAdjunto, EntidadAdjunto, EstadoInicial, Remito } from "@/domain/types";
import { useStore } from "@/store";
import { BRAND } from "@/config/brand";
import { formatDate, formatQty } from "./format";

export const TIPOS_PERMITIDOS = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/heic", "image/gif"];
export const ACCEPT_ADJUNTOS = "image/*,application/pdf";

export function validarArchivo(file: File, maxMB: number): string | null {
  if (!TIPOS_PERMITIDOS.includes(file.type) && !file.type.startsWith("image/")) return `Tipo de archivo no permitido (${file.type || "desconocido"}). Subí una foto o un PDF.`;
  if (file.size > maxMB * 1024 * 1024) return `El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y el máximo es ${maxMB} MB.`;
  return null;
}

/** Guarda el archivo en IndexedDB y registra la metadata en el store. */
export async function guardarAdjunto(
  file: File,
  meta: { entidadTipo: EntidadAdjunto; entidadId: string; categoria: CategoriaAdjunto; nombre?: string },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const maxMB = useStore.getState().db.config.tamanoMaxAdjuntoMB || 10;
  const err = validarArchivo(file, maxMB);
  if (err) return { ok: false, error: err };
  const blobKey = `adj-${nanoid(12)}`;
  try {
    await set(blobKey, file);
  } catch {
    return { ok: false, error: "No se pudo guardar el archivo en este navegador." };
  }
  const r = useStore.getState().registrarAdjunto({ ...meta, nombre: meta.nombre ?? file.name, tamanoBytes: file.size, tipoMime: file.type || "application/octet-stream", blobKey });
  if (!r.ok) {
    await del(blobKey).catch(() => undefined);
    return { ok: false, error: r.error };
  }
  return { ok: true, id: r.data };
}

/** Adjunta un enlace web (sin blob). */
export function adjuntarEnlace(url: string, meta: { entidadTipo: EntidadAdjunto; entidadId: string; categoria: CategoriaAdjunto; nombre?: string }) {
  if (!/^https?:\/\/\S+\.\S+/.test(url)) return { ok: false as const, error: "Ingresá una dirección web válida (https://…)." };
  return useStore.getState().registrarAdjunto({ ...meta, nombre: meta.nombre?.trim() || url, tamanoBytes: 0, tipoMime: "text/uri-list", blobKey: "", url });
}

/** Devuelve una ObjectURL del adjunto (revocar con `revoke` al cerrar el visor). */
export async function obtenerUrl(blobKey: string): Promise<{ url: string; revoke: () => void } | null> {
  if (!blobKey) return null;
  let blob = (await get(blobKey).catch(() => undefined)) as Blob | undefined;
  if (!blob && blobKey.startsWith("demo-firmado-")) {
    await asegurarAdjuntosDemo();
    blob = (await get(blobKey).catch(() => undefined)) as Blob | undefined;
  }
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}

export async function descargarAdjunto(blobKey: string, nombre: string) {
  const r = await obtenerUrl(blobKey);
  if (!r) return false;
  const a = document.createElement("a");
  a.href = r.url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(r.revoke, 1000);
  return true;
}

/** Elimina metadata y blob. */
export async function eliminarAdjunto(id: string) {
  const r = useStore.getState().eliminarAdjuntoMeta(id);
  if (r.ok && r.data) await del(r.data).catch(() => undefined);
  return r;
}

export async function obtenerBlob(blobKey: string): Promise<Blob | undefined> {
  return (await get(blobKey).catch(() => undefined)) as Blob | undefined;
}

let generando: Promise<void> | null = null;

/** Genera en runtime (jsPDF) los remitos firmados de ejemplo del seed que falten en IndexedDB. */
export function asegurarAdjuntosDemo(): Promise<void> {
  if (generando) return generando;
  generando = (async () => {
    const db = useStore.getState().db;
    const faltan: { key: string; remito: Remito }[] = [];
    for (const a of db.adjuntos) {
      if (!a.blobKey.startsWith("demo-firmado-")) continue;
      const existe = await get(a.blobKey).catch(() => undefined);
      if (existe) continue;
      const remito = db.remitos.find((r) => r.id === a.entidadId);
      if (remito) faltan.push({ key: a.blobKey, remito });
    }
    if (!faltan.length) return;
    const { jsPDF } = await import("jspdf");
    for (const f of faltan) {
      const blob = pdfRemitoFirmado(jsPDF, f.remito, db);
      await set(f.key, blob).catch(() => undefined);
    }
  })().finally(() => {
    generando = null;
  });
  return generando;
}

type JsPDFCtor = typeof import("jspdf").jsPDF;

/** PDF simple que simula el remito escaneado con la firma del cliente. */
function pdfRemitoFirmado(JsPDF: JsPDFCtor, r: Remito, db: EstadoInicial): Blob {
  const doc = new JsPDF({ unit: "mm", format: "a4" });
  const cli = db.clientes.find((c) => c.id === r.clienteId);
  const obra = db.obras.find((o) => o.id === r.obraId);
  const prod = new Map(db.productos.map((p) => [p.id, p]));
  doc.setFillColor(248, 247, 243);
  doc.rect(0, 0, 210, 297, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(BRAND.empresa, 16, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${BRAND.razonSocial} · CUIT ${BRAND.cuit}`, 16, 26);
  doc.text(BRAND.direccion, 16, 31);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`REMITO ${r.numero}`, 194, 20, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Fecha: ${formatDate(r.fechaEntrega ?? r.fecha)}`, 194, 26, { align: "right" });
  doc.text(r.circuito === 1 ? "Documento no válido como factura" : "Documento interno", 194, 31, { align: "right" });
  doc.line(16, 36, 194, 36);
  doc.text(`Cliente: ${cli?.razonSocial ?? ""} (${cli?.codigo ?? ""})`, 16, 43);
  doc.text(`Obra: ${obra?.nombre ?? "—"}`, 16, 49);
  doc.text(`Entrega: ${r.direccionEntrega ?? "Retira en mostrador"}`, 16, 55);
  let y = 66;
  doc.setFont("helvetica", "bold");
  doc.text("Código", 16, y);
  doc.text("Artículo", 40, y);
  doc.text("Cantidad", 194, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 3;
  doc.line(16, y, 194, y);
  for (const it of r.items) {
    if (it.cantidad <= 0) continue;
    y += 7;
    const p = prod.get(it.productoId);
    doc.text(p?.codigo ?? "", 16, y);
    doc.text((p?.nombre ?? "").slice(0, 70), 40, y);
    doc.text(formatQty(it.cantidad, p?.unidad ?? "UN"), 194, y, { align: "right" });
  }
  y = Math.max(y + 30, 200);
  doc.line(110, y, 190, y);
  doc.text("Recibí conforme · Firma y aclaración", 150, y + 5, { align: "center" });
  // Firma manuscrita simulada
  doc.setDrawColor(30, 40, 110);
  doc.setLineWidth(0.6);
  const x0 = 118;
  const y0 = y - 6;
  doc.lines(
    [
      [4, -8, 8, 6, 12, -2],
      [3, -4, 6, 8, 10, 0],
      [3, -6, 7, 4, 14, -3],
      [4, 2, 8, 5, 16, 1],
    ],
    x0,
    y0,
  );
  doc.setFont("helvetica", "oblique");
  doc.setTextColor(30, 40, 110);
  doc.text((cli?.contacto ?? cli?.razonSocial ?? "").split(" ").slice(0, 2).join(" "), 150, y + 12, { align: "center" });
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(7);
  doc.text("Copia escaneada · Demo", 105, 290, { align: "center" });
  return doc.output("blob");
}
