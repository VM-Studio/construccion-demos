/**
 * Excel del estado de desacopio (exceljs): hoja "Detalle" (encabezado + tabla agrupada con
 * números reales y formatos) y hoja "Articulos". Se carga con import dinámico.
 */
import ExcelJS from "exceljs";
import type { DocDesacopio } from "./datos";

const FMT_CANT = "#,##0.000";
const FMT_ENT = "0";
const FMT_PESOS = '"$" #,##0.00;-"$" #,##0.00';
const GRIS = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE1E1E1" } };
const GRIS_CLARO = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF4F4F4" } };

export async function generarExcelDesacopio(doc: DocDesacopio): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Aceros RNF";
  wb.created = new Date();

  // ── Detalle ──
  const ws = wb.addWorksheet("Detalle");
  ws.columns = [
    { width: 10 }, { width: 44 }, { width: 24 }, { width: 12 }, { width: 11 }, { width: 9 },
    { width: 30 }, { width: 30 }, { width: 14 }, { width: 15 }, { width: 17 },
  ];
  doc.encabezado.slice(0, 12).forEach((l, i) => (ws.getCell(i + 1, 1).value = l));
  let fila = Math.max(12, doc.encabezado.length) + 2;
  const filaHeader = fila;
  const head = ws.getRow(fila);
  doc.columnas.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c;
    cell.font = { bold: true };
    cell.fill = GRIS;
    cell.alignment = { horizontal: i >= 3 && i <= 5 ? "right" : i >= 8 ? "right" : "left" };
  });
  fila++;
  for (const g of doc.grupos) {
    ws.mergeCells(fila, 1, fila, 11);
    const c = ws.getCell(fila, 1);
    c.value = g.titulo;
    c.font = { bold: true };
    c.fill = GRIS_CLARO;
    fila++;
    for (const l of g.lineas) {
      const r = ws.getRow(fila);
      r.values = [l.codigo ? Number(l.codigo) || l.codigo : "", l.descripcion, l.obra, l.cantidad, l.entregados, l.saldo, l.remitos.join(", "), l.facturas.join(", "), l.precio, l.subtotal, l.saldoDisponible];
      r.getCell(4).numFmt = FMT_CANT;
      r.getCell(5).numFmt = FMT_ENT;
      r.getCell(6).numFmt = FMT_ENT;
      for (const k of [9, 10, 11]) r.getCell(k).numFmt = FMT_PESOS;
      r.getCell(2).alignment = { wrapText: true, vertical: "top" };
      r.getCell(7).alignment = { wrapText: true, vertical: "top" };
      r.getCell(8).alignment = { wrapText: true, vertical: "top" };
      fila++;
    }
  }
  ws.views = [{ state: "frozen", ySplit: filaHeader }];
  ws.autoFilter = { from: { row: filaHeader, column: 1 }, to: { row: fila - 1, column: 11 } };

  // ── Articulos ──
  const wa = wb.addWorksheet("Articulos");
  wa.columns = [{ width: 10 }, { width: 56 }, { width: 18 }, { width: 13 }, { width: 18 }, { width: 13 }];
  const ha = wa.getRow(1);
  doc.columnasArticulos.forEach((c, i) => {
    const cell = ha.getCell(i + 1);
    cell.value = c;
    cell.font = { bold: true };
    cell.fill = GRIS;
  });
  doc.articulos.forEach((a, i) => {
    const r = wa.getRow(i + 2);
    r.values = [Number(a.codigo) || a.codigo, a.articulo, a.precio, a.cantidad, a.bajas, a.saldo];
    r.getCell(3).numFmt = FMT_PESOS;
    for (const k of [4, 5, 6]) r.getCell(k).numFmt = FMT_CANT;
  });
  wa.views = [{ state: "frozen", ySplit: 1 }];
  wa.autoFilter = { from: { row: 1, column: 1 }, to: { row: doc.articulos.length + 1, column: 6 } };

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
