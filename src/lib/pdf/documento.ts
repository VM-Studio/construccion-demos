/**
 * PDF de documentos comerciales (cotización, estado de cuenta) con jsPDF + autotable: logo,
 * datos de la empresa, recuadro de título, datos del cliente, tabla, totales y pie.
 * Se carga con import dinámico (no entra en el bundle inicial).
 */
import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import type { DatosEmpresa } from "@/domain/types";

const M = 14;
const TINTA: [number, number, number] = [20, 20, 19];
const GRIS: [number, number, number] = [110, 110, 105];
const LINEA: [number, number, number] = [215, 215, 210];
const ACENTO: [number, number, number] = [183, 121, 31];

export interface DocumentoPdf {
  empresa: DatosEmpresa;
  titulo: string;
  numero?: string;
  fecha: string;
  /** Líneas debajo del número (ej. "Válida hasta 05/11/2026"). */
  extras?: string[];
  /** Recuadro "Cliente": título y líneas. */
  destinatario?: { titulo: string; lineas: string[] };
  columnas: { titulo: string; ancho?: number; derecha?: boolean }[];
  filas: (string | number)[][];
  totales?: { etiqueta: string; valor: string; destacado?: boolean }[];
  observaciones?: string;
  pie?: string;
  apaisado?: boolean;
}

/** Marca de la empresa dibujada en vectores (misma que LogoEmpresa). */
function logo(pdf: jsPDF, x: number, y: number, nombre: string) {
  pdf.setFillColor(...TINTA);
  pdf.roundedRect(x, y, 15, 15, 2, 2, "F");
  pdf.setFillColor(...ACENTO);
  pdf.rect(x, y + 12.4, 15, 2.6, "F");
  pdf.setFillColor(...TINTA);
  pdf.rect(x, y + 11.2, 15, 1.2, "F");
  pdf.setTextColor(247, 247, 245);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("RNF", x + 7.5, y + 8.6, { align: "center" });
  pdf.setTextColor(...TINTA);
  pdf.setFontSize(15);
  pdf.text(nombre.toUpperCase(), x + 18, y + 7);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.5);
  pdf.setTextColor(...GRIS);
  pdf.text("CORRALÓN · FERRETERÍA", x + 18, y + 11.5, { charSpace: 0.6 });
}

export function generarPdfDocumento(d: DocumentoPdf): Blob {
  const pdf = new jsPDF({ orientation: d.apaisado ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const ancho = pdf.internal.pageSize.getWidth();
  const alto = pdf.internal.pageSize.getHeight();
  logo(pdf, M, M, d.empresa.empresa);
  pdf.setFontSize(7.5);
  pdf.setTextColor(...GRIS);
  const datos = [`${d.empresa.razonSocial} · CUIT ${d.empresa.cuit}`, d.empresa.direccion, [d.empresa.telefono, d.empresa.email].filter(Boolean).join(" · ")].filter(Boolean);
  datos.forEach((l, i) => pdf.text(l, M, M + 20 + i * 3.6));

  // Recuadro del documento.
  const bx = ancho - M - 70;
  pdf.setDrawColor(...TINTA);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(bx, M, 70, 26 + (d.extras?.length ?? 0) * 3.8, 1.5, 1.5, "S");
  pdf.setTextColor(...TINTA);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text(d.titulo.toUpperCase(), bx + 5, M + 8);
  pdf.setFontSize(10);
  if (d.numero) pdf.text(d.numero, bx + 5, M + 14);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(`Fecha: ${d.fecha}`, bx + 5, M + 20);
  (d.extras ?? []).forEach((l, i) => pdf.text(l, bx + 5, M + 24 + i * 3.8));

  let y = M + 36 + Math.max(0, (d.extras?.length ?? 0) - 1) * 3.8;
  pdf.setDrawColor(...TINTA);
  pdf.setLineWidth(0.6);
  pdf.line(M, y, ancho - M, y);
  y += 6;
  if (d.destinatario) {
    pdf.setFontSize(7);
    pdf.setTextColor(...GRIS);
    pdf.text(d.destinatario.titulo.toUpperCase(), M, y);
    pdf.setTextColor(...TINTA);
    pdf.setFontSize(9);
    d.destinatario.lineas.forEach((l, i) => {
      pdf.setFont("helvetica", i === 0 ? "bold" : "normal");
      pdf.text(l, M, y + 4.5 + i * 4);
    });
    y += 6 + d.destinatario.lineas.length * 4;
  }

  const estilos = Object.fromEntries(d.columnas.map((c, i) => [i, { ...(c.ancho ? { cellWidth: c.ancho } : {}), ...(c.derecha ? { halign: "right" as const } : {}) }]));
  autoTable(pdf, {
    startY: y + 2,
    margin: { left: M, right: M, top: M, bottom: M + 8 },
    theme: "plain",
    head: [d.columnas.map((c) => ({ content: c.titulo, styles: c.derecha ? { halign: "right" as const } : {} }))],
    body: d.filas.map((f) => f.map((x) => String(x))) as RowInput[],
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: { top: 1.8, bottom: 1.8, left: 1.5, right: 1.5 }, textColor: TINTA, lineColor: LINEA, lineWidth: { bottom: 0.15 } },
    headStyles: { fillColor: [244, 244, 241], fontStyle: "bold", fontSize: 8, lineWidth: { bottom: 0.4 }, lineColor: TINTA },
    columnStyles: estilos,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = ((pdf as any).lastAutoTable?.finalY ?? y) + 4;

  if (d.totales?.length) {
    const tx = ancho - M - 75;
    for (const t of d.totales) {
      if (y > alto - M - 20) {
        pdf.addPage();
        y = M;
      }
      if (t.destacado) {
        pdf.setFillColor(...TINTA);
        pdf.rect(tx, y - 1, 75, 8, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10.5);
        pdf.text(t.etiqueta, tx + 3, y + 4.4);
        pdf.text(t.valor, ancho - M - 3, y + 4.4, { align: "right" });
        y += 10;
      } else {
        pdf.setTextColor(...TINTA);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.text(t.etiqueta, tx + 3, y + 3.5);
        pdf.text(t.valor, ancho - M - 3, y + 3.5, { align: "right" });
        y += 6;
      }
    }
  }
  if (d.observaciones) {
    y += 3;
    pdf.setFontSize(7);
    pdf.setTextColor(...GRIS);
    pdf.text("OBSERVACIONES", M, y);
    pdf.setFontSize(8.5);
    pdf.setTextColor(...TINTA);
    const lineas = pdf.splitTextToSize(d.observaciones, ancho - 2 * M);
    pdf.text(lineas, M, y + 4.5);
  }
  // Pie en todas las páginas.
  const paginas = pdf.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(...LINEA);
    pdf.setLineWidth(0.2);
    pdf.line(M, alto - M, ancho - M, alto - M);
    pdf.setFontSize(7);
    pdf.setTextColor(...GRIS);
    if (d.pie) pdf.text(d.pie, M, alto - M + 4);
    pdf.text(`Página ${i} de ${paginas}`, ancho - M, alto - M + 4, { align: "right" });
  }
  return pdf.output("blob");
}

/** Descarga un Blob con nombre. */
export function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
