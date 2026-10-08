import type { Circuito, CodigoDoc, Numeradores } from "./types";

/** Clave del numerador: numeración independiente por código, circuito y punto de venta. */
export function claveNumerador(codigo: CodigoDoc, circuito: Circuito | null, puntoVenta: string): string {
  return `${codigo}|${circuito ?? 0}|${puntoVenta}`;
}

/**
 * Formatea el número de un documento: `${codigo}${circuito} ${puntoVenta}-${correlativo}`.
 * Ej. `NP2 0001-00067299`, `RM2 00016-00013536`, `F1 0001-00088073`.
 * Los documentos internos sin circuito (TRF, AJU, DES, RCP) no llevan sufijo.
 */
export function formatearDoc(codigo: CodigoDoc, circuito: Circuito | null, puntoVenta: string, n: number): string {
  return `${codigo}${circuito ?? ""} ${puntoVenta}-${String(n).padStart(8, "0")}`;
}

/** Reserva el siguiente número y devuelve [numero, numeradoresActualizados]. */
export function reservarNumeroDoc(
  numeradores: Numeradores,
  codigo: CodigoDoc,
  circuito: Circuito | null,
  puntoVenta: string,
): [string, Numeradores] {
  const k = claveNumerador(codigo, circuito, puntoVenta);
  const n = (numeradores[k] ?? 0) + 1;
  return [formatearDoc(codigo, circuito, puntoVenta, n), { ...numeradores, [k]: n }];
}

/** Descompone un número de documento. */
export function parsearNumeroDoc(numero: string): { codigo: string; circuito: Circuito | null; puntoVenta: string; correlativo: number } | null {
  const m = numero.match(/^([A-Z]+?)([12])?\s+(\d+)-(\d+)/);
  if (!m) return null;
  return { codigo: m[1], circuito: m[2] ? (Number(m[2]) as Circuito) : null, puntoVenta: m[3], correlativo: Number(m[4]) };
}

/** Número corto para mostrar en espacios reducidos: "NP2 67299". */
export function numeroCorto(numero: string): string {
  const p = parsearNumeroDoc(numero);
  return p ? `${p.codigo}${p.circuito ?? ""} ${p.correlativo}` : numero;
}

/** Actualiza los numeradores a partir de una lista de números existentes (para el seed). */
export function numeradoresDesde(numeros: string[]): Numeradores {
  const out: Numeradores = {};
  for (const num of numeros) {
    const p = parsearNumeroDoc(num);
    if (!p) continue;
    const k = `${p.codigo}|${p.circuito ?? 0}|${p.puntoVenta}`;
    out[k] = Math.max(out[k] ?? 0, p.correlativo);
  }
  return out;
}

/** Documentos con numeración propia y de qué punto de venta toman el número. */
export const DOCUMENTOS_NUMERADOS: { codigo: CodigoDoc; nombre: string; conCircuito: boolean; puntoVenta: "sucursal" | "remito" | "central" }[] = [
  { codigo: "NP", nombre: "Nota de pedido", conCircuito: true, puntoVenta: "sucursal" },
  { codigo: "AC", nombre: "Acopio", conCircuito: true, puntoVenta: "sucursal" },
  { codigo: "ACD", nombre: "Ajuste / traspaso de acopio", conCircuito: true, puntoVenta: "sucursal" },
  { codigo: "COT", nombre: "Cotización", conCircuito: true, puntoVenta: "sucursal" },
  { codigo: "F", nombre: "Factura", conCircuito: true, puntoVenta: "sucursal" },
  { codigo: "NC", nombre: "Nota de crédito", conCircuito: true, puntoVenta: "sucursal" },
  { codigo: "RC", nombre: "Recibo", conCircuito: true, puntoVenta: "sucursal" },
  { codigo: "SI", nombre: "Saldo inicial", conCircuito: true, puntoVenta: "sucursal" },
  { codigo: "RM", nombre: "Remito", conCircuito: true, puntoVenta: "remito" },
  { codigo: "RD", nombre: "Remito de devolución", conCircuito: true, puntoVenta: "sucursal" },
  { codigo: "OC", nombre: "Orden de compra", conCircuito: true, puntoVenta: "central" },
  { codigo: "OP", nombre: "Orden de pago", conCircuito: true, puntoVenta: "central" },
  { codigo: "ACP", nombre: "Acopio con proveedor", conCircuito: true, puntoVenta: "central" },
  { codigo: "DES", nombre: "Despacho", conCircuito: false, puntoVenta: "sucursal" },
  { codigo: "RCP", nombre: "Recepción de mercadería", conCircuito: false, puntoVenta: "central" },
  { codigo: "TRF", nombre: "Transferencia", conCircuito: false, puntoVenta: "central" },
  { codigo: "AJU", nombre: "Ajuste de stock", conCircuito: false, puntoVenta: "central" },
];

/**
 * Todas las combinaciones código × circuito × punto de venta que el sistema puede numerar,
 * con el último número usado (0 si todavía no se usó). Incluye claves existentes no previstas.
 */
export function filasNumeracion(numeradores: Numeradores, sucursales: { puntoVenta: string; puntoVentaRemito: string }[]) {
  const filas = new Map<string, { clave: string; codigo: CodigoDoc; nombre: string; circuito: Circuito | null; puntoVenta: string; ultimo: number }>();
  for (const d of DOCUMENTOS_NUMERADOS) {
    const pvs = d.puntoVenta === "central" ? ["0001"] : [...new Set(sucursales.map((s) => (d.puntoVenta === "remito" ? s.puntoVentaRemito : s.puntoVenta)))];
    for (const circuito of d.conCircuito ? ([1, 2] as Circuito[]) : [null])
      for (const pv of pvs) {
        const clave = claveNumerador(d.codigo, circuito, pv);
        filas.set(clave, { clave, codigo: d.codigo, nombre: d.nombre, circuito, puntoVenta: pv, ultimo: numeradores[clave] ?? 0 });
      }
  }
  for (const [clave, ultimo] of Object.entries(numeradores))
    if (!filas.has(clave)) {
      const [codigo, circ, pv] = clave.split("|");
      filas.set(clave, { clave, codigo: codigo as CodigoDoc, nombre: DOCUMENTOS_NUMERADOS.find((d) => d.codigo === codigo)?.nombre ?? codigo, circuito: Number(circ) ? (Number(circ) as Circuito) : null, puntoVenta: pv, ultimo });
    }
  return [...filas.values()];
}
