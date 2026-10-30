/**
 * QR de la factura electrónica (RG 4892): URL de ARCA con los datos del comprobante en JSON
 * codificado en base64. Sirve en el navegador y en el servidor.
 */
export interface DatosQrArca {
  /** Fecha del comprobante (ISO o yyyy-mm-dd). */
  fecha: string;
  cuitEmisor: string;
  puntoVenta: number;
  /** Tipo de comprobante de ARCA (1 FA, 3 NC A, 6 FB, 8 NC B). */
  tipo: number;
  numero: number;
  importe: number;
  docTipo: number;
  docNro: string;
  cae: string;
}

const digitos = (s: string) => Number(String(s ?? "").replace(/\D/g, "") || 0);

/** Fecha yyyy-mm-dd en hora de Argentina (UTC−3) a partir de un ISO con hora; si ya es yyyy-mm-dd, igual. */
function fechaQr(f: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(f)) return f;
  const d = new Date(f);
  if (Number.isNaN(d.getTime())) return f.slice(0, 10);
  return new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

export function urlQrArca(c: DatosQrArca): string {
  const datos = {
    ver: 1,
    fecha: fechaQr(c.fecha),
    cuit: digitos(c.cuitEmisor),
    ptoVta: c.puntoVenta,
    tipoCmp: c.tipo,
    nroCmp: c.numero,
    importe: Math.round(c.importe * 100) / 100,
    moneda: "PES",
    ctz: 1,
    tipoDocRec: c.docTipo,
    nroDocRec: digitos(c.docNro),
    tipoCodAut: "E",
    codAut: digitos(c.cae),
  };
  // Todo el JSON es ASCII, así que btoa alcanza (existe en el navegador y en Node).
  return `https://www.afip.gob.ar/fe/qr/?p=${btoa(JSON.stringify(datos))}`;
}
