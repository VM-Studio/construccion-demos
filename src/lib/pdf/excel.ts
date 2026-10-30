/** Planilla simple (exceljs, import dinámico): título, encabezado, filas y totales. */
import ExcelJS from "exceljs";

export async function generarExcel(o: { hoja: string; titulo: string[]; columnas: { titulo: string; ancho?: number; dinero?: boolean }[]; filas: (string | number | null)[][]; totales?: (string | number | null)[] }): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(o.hoja.slice(0, 31));
  for (const t of o.titulo) ws.addRow([t]).font = { bold: o.titulo.indexOf(t) === 0, size: o.titulo.indexOf(t) === 0 ? 14 : 10 };
  ws.addRow([]);
  const enc = ws.addRow(o.columnas.map((c) => c.titulo));
  enc.font = { bold: true };
  enc.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0EC" } }));
  for (const f of o.filas) ws.addRow(f);
  if (o.totales) ws.addRow(o.totales).font = { bold: true };
  o.columnas.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = c.ancho ?? 16;
    if (c.dinero) col.numFmt = '"$" #,##0.00;[Red]-"$" #,##0.00';
  });
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
