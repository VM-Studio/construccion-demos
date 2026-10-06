/**
 * PDF del estado de desacopio (jsPDF + jspdf-autotable): replica el documento real,
 * A4 vertical, márgenes de 12 mm, Helvetica 9 pt y tablas de 7 pt.
 * Se carga con import dinámico: no entra en el bundle inicial.
 */
import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import { BRAND } from "@/config/brand";
import { formatDate } from "@/lib/format";
import { cantidad3, dinero, type DocDesacopio } from "./datos";

const MARGEN = 12;

export function generarPdfDesacopio(doc: DocDesacopio): Blob {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  let y = MARGEN + 3;
  for (const linea of doc.encabezado) {
    if (linea) pdf.text(linea, MARGEN, y);
    y += 4.2;
  }
  y += 2;

  const gris: [number, number, number] = [225, 225, 225];
  const filas: RowInput[] = [];
  for (const g of doc.grupos) {
    filas.push([{ content: g.titulo, colSpan: 11, styles: { fontStyle: "bold", fontSize: 7, fillColor: [245, 245, 245] } }]);
    for (const l of g.lineas)
      filas.push([
        l.codigo,
        l.descripcion,
        l.obra,
        cantidad3(l.cantidad),
        String(Math.round(l.entregados)),
        String(Math.round(l.saldo)),
        l.remitos.join(","),
        l.facturas.join(","),
        dinero(l.precio),
        dinero(l.subtotal),
        dinero(l.saldoDisponible),
      ]);
  }
  const derecha = { halign: "right" as const };
  autoTable(pdf, {
    startY: y,
    margin: { left: MARGEN, right: MARGEN, top: MARGEN, bottom: MARGEN + 4 },
    theme: "grid",
    head: [doc.columnas],
    body: filas,
    showHead: "everyPage",
    styles: { font: "helvetica", fontSize: 7, cellPadding: 0.9, lineColor: [200, 200, 200], lineWidth: 0.1, textColor: [20, 20, 20], overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: gris, textColor: [20, 20, 20], fontStyle: "normal" },
    columnStyles: {
      0: { cellWidth: 11 },
      1: { cellWidth: 30 },
      2: { cellWidth: 20 },
      3: { cellWidth: 12, ...derecha },
      4: { cellWidth: 13, ...derecha },
      5: { cellWidth: 8, ...derecha },
      6: { cellWidth: 22 },
      7: { cellWidth: 20 },
      8: { cellWidth: 15, ...derecha },
      9: { cellWidth: 17, ...derecha },
      10: { cellWidth: 18, ...derecha },
    },
  });

  const filasArt: RowInput[] = doc.articulos.map((a) => [a.codigo, a.articulo, dinero(a.precio), cantidad3(a.cantidad), cantidad3(a.bajas), cantidad3(a.saldo)]);
  const finY = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const alto = pdf.internal.pageSize.getHeight();
  autoTable(pdf, {
    startY: finY + 30 > alto - MARGEN ? undefined : finY + 8,
    pageBreak: finY + 30 > alto - MARGEN ? "always" : "auto",
    margin: { left: MARGEN, right: MARGEN, top: MARGEN, bottom: MARGEN + 4 },
    theme: "grid",
    head: [doc.columnasArticulos],
    body: filasArt,
    showHead: "everyPage",
    styles: { font: "helvetica", fontSize: 7, cellPadding: 0.9, lineColor: [200, 200, 200], lineWidth: 0.1, textColor: [20, 20, 20] },
    headStyles: { fillColor: gris, textColor: [20, 20, 20], fontStyle: "normal" },
    columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 82 }, 2: { cellWidth: 24, ...derecha }, 3: { cellWidth: 20, ...derecha }, 4: { cellWidth: 22, ...derecha }, 5: { cellWidth: 20, ...derecha } },
  });

  const total = pdf.getNumberOfPages();
  const generado = formatDate(new Date(), "dd/MM/yyyy HH:mm");
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);
    pdf.setTextColor(110, 110, 110);
    pdf.text(`${BRAND.empresa} · ${doc.tipo} · generado el ${generado} · página ${i} de ${total}`, pdf.internal.pageSize.getWidth() / 2, alto - 6, { align: "center" });
  }
  return pdf.output("blob");
}
