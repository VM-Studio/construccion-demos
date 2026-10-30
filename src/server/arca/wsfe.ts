/**
 * WSFEv1 de ARCA: factura electrónica (CAE) para los comprobantes del circuito 1.
 * - `ultimoAutorizado`: FECompUltimoAutorizado (último número autorizado por punto de venta y tipo).
 * - `solicitarCAE`: FECAESolicitar con un solo comprobante (CantReg 1).
 * SOAP con fetch + fast-xml-parser, igual que el padrón. `armarFECAESolicitar` y
 * `leerRespuestaCAE` son puras para poder probarlas sin red.
 */
import { XMLParser } from "fast-xml-parser";
import type { CondicionIVA } from "@/domain/types";
import { type ConfigArca, ErrorArca, errorDesdeFault, URLS } from "./config";
import { obtenerTicket } from "./wsaa";

const NS = "http://ar.gov.afip.dif.FEV1/";
const xml = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, parseTagValue: false, isArray: (n) => n === "Obs" || n === "Err" || n === "Evt" || n === "FECAEDetResponse" });

/** Códigos de comprobante de ARCA. */
export const TIPOS_CBTE = { FACTURA_A: 1, NOTA_CREDITO_A: 3, FACTURA_B: 6, NOTA_CREDITO_B: 8 } as const;

/** Tipo de comprobante de ARCA a partir del tipo y la letra del sistema; null si no se factura electrónicamente. */
export function tipoCbteArca(tipo: string, letra: string | undefined): number | null {
  const l = letra ?? "B";
  if (tipo === "FACTURA") return l === "A" ? TIPOS_CBTE.FACTURA_A : TIPOS_CBTE.FACTURA_B;
  if (tipo === "NOTA_CREDITO") return l === "A" ? TIPOS_CBTE.NOTA_CREDITO_A : TIPOS_CBTE.NOTA_CREDITO_B;
  return null;
}

/** Condición frente al IVA del receptor (RG 5616). */
export const CONDICION_IVA_RECEPTOR: Record<CondicionIVA, number> = { RI: 1, EXENTO: 4, CF: 5, MONOTRIBUTO: 6 };

/** Tipo y número de documento del receptor: 80 CUIT (11 dígitos), 96 DNI (7–8), 99 consumidor final (0). */
export function documentoReceptor(doc: string | undefined | null): { docTipo: number; docNro: string } {
  const d = (doc ?? "").replace(/\D/g, "");
  if (d.length === 11) return { docTipo: 80, docNro: d };
  if (d.length === 7 || d.length === 8) return { docTipo: 96, docNro: d };
  return { docTipo: 99, docNro: "0" };
}

/** yyyymmdd de una fecha ISO, en hora de Argentina (UTC−3, sin horario de verano). */
export function fechaArca(iso: string | Date): string {
  const d = new Date(typeof iso === "string" ? iso : iso.getTime());
  const ar = new Date(d.getTime() - 3 * 3_600_000);
  return ar.toISOString().slice(0, 10).replace(/-/g, "");
}

/** yyyymmdd → "yyyy-mm-dd". */
export function fechaDesdeArca(f: string | undefined | null): string | undefined {
  const s = String(f ?? "").trim();
  return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : undefined;
}

const imp = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

/** Alícuota de IVA según la proporción iva/neto: 21 % (5) por defecto, 10,5 % (4), 27 % (6), 0 % (3). */
export function alicuotaIva(neto: number, iva: number): number {
  if (iva === 0) return 3;
  const p = neto ? iva / neto : 0.21;
  if (Math.abs(p - 0.105) < 0.005) return 4;
  if (Math.abs(p - 0.27) < 0.005) return 6;
  return 5;
}

export interface CbteAsociado {
  tipo: number;
  puntoVenta: number;
  numero: number;
  cuit?: string;
  fecha?: string; // yyyymmdd
}

export interface SolicitudCAE {
  puntoVenta: number;
  cbteTipo: number;
  numero: number;
  /** ISO; se convierte a yyyymmdd en hora de Argentina. */
  fecha: string;
  docTipo: number;
  docNro: string;
  condicionIVAReceptor: number;
  neto: number;
  iva: number;
  asociados?: CbteAsociado[];
}

export type ResultadoCAE =
  | { ok: true; resultado: "A"; cae: string; caeVencimiento: string; observaciones: string[] }
  | { ok: false; resultado: "R" | "P" | "?"; error: string; observaciones: string[]; errores: string[] };

const auth = (t: { token: string; sign: string }, cuit: string) => `<ar:Auth><ar:Token>${t.token}</ar:Token><ar:Sign>${t.sign}</ar:Sign><ar:Cuit>${cuit}</ar:Cuit></ar:Auth>`;
const envolver = (cuerpo: string) => `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="${NS}"><soapenv:Header/><soapenv:Body>${cuerpo}</soapenv:Body></soapenv:Envelope>`;

/** Sobre SOAP de FECAESolicitar para un comprobante. */
export function armarFECAESolicitar(t: { token: string; sign: string }, cuitEmisor: string, s: SolicitudCAE): string {
  const neto = Math.round(s.neto * 100) / 100;
  const iva = Math.round(s.iva * 100) / 100;
  // El total tiene que ser exactamente la suma de los importes informados.
  const total = neto + iva;
  const asoc = s.asociados?.length
    ? `<ar:CbtesAsoc>${s.asociados
        .map((a) => `<ar:CbteAsoc><ar:Tipo>${a.tipo}</ar:Tipo><ar:PtoVta>${a.puntoVenta}</ar:PtoVta><ar:Nro>${a.numero}</ar:Nro>${a.cuit ? `<ar:Cuit>${a.cuit}</ar:Cuit>` : ""}${a.fecha ? `<ar:CbteFch>${a.fecha}</ar:CbteFch>` : ""}</ar:CbteAsoc>`)
        .join("")}</ar:CbtesAsoc>`
    : "";
  // Con neto gravado el bloque de IVA es obligatorio (0 % si no hay impuesto); sin neto, se omite.
  const bloqueIva = iva !== 0 || neto !== 0 ? `<ar:Iva><ar:AlicIva><ar:Id>${alicuotaIva(neto, iva)}</ar:Id><ar:BaseImp>${imp(neto)}</ar:BaseImp><ar:Importe>${imp(iva)}</ar:Importe></ar:AlicIva></ar:Iva>` : "";
  const det =
    `<ar:Concepto>1</ar:Concepto><ar:DocTipo>${s.docTipo}</ar:DocTipo><ar:DocNro>${s.docNro}</ar:DocNro>` +
    `<ar:CbteDesde>${s.numero}</ar:CbteDesde><ar:CbteHasta>${s.numero}</ar:CbteHasta><ar:CbteFch>${fechaArca(s.fecha)}</ar:CbteFch>` +
    `<ar:ImpTotal>${imp(total)}</ar:ImpTotal><ar:ImpTotConc>0.00</ar:ImpTotConc><ar:ImpNeto>${imp(neto)}</ar:ImpNeto><ar:ImpOpEx>0.00</ar:ImpOpEx><ar:ImpTrib>0.00</ar:ImpTrib><ar:ImpIVA>${imp(iva)}</ar:ImpIVA>` +
    `<ar:MonId>PES</ar:MonId><ar:MonCotiz>1</ar:MonCotiz><ar:CondicionIVAReceptorId>${s.condicionIVAReceptor}</ar:CondicionIVAReceptorId>` +
    asoc +
    bloqueIva;
  return envolver(
    `<ar:FECAESolicitar>${auth(t, cuitEmisor)}<ar:FeCAEReq><ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>${s.puntoVenta}</ar:PtoVta><ar:CbteTipo>${s.cbteTipo}</ar:CbteTipo></ar:FeCabReq><ar:FeDetReq><ar:FECAEDetRequest>${det}</ar:FECAEDetRequest></ar:FeDetReq></ar:FeCAEReq></ar:FECAESolicitar>`,
  );
}

/** Sobre SOAP de FECompUltimoAutorizado. */
export function armarUltimoAutorizado(t: { token: string; sign: string }, cuitEmisor: string, ptoVta: number, cbteTipo: number): string {
  return envolver(`<ar:FECompUltimoAutorizado>${auth(t, cuitEmisor)}<ar:PtoVta>${ptoVta}</ar:PtoVta><ar:CbteTipo>${cbteTipo}</ar:CbteTipo></ar:FECompUltimoAutorizado>`);
}

type Mensaje = { Code?: string; Msg?: string };
const mensajes = (l: Mensaje[] | undefined) => (l ?? []).map((m) => `${m.Code ? `${m.Code}: ` : ""}${String(m.Msg ?? "").trim()}`).filter((m) => m.trim());

/** Body del sobre → resultado del método. Lanza ErrorArca si hay fault. */
function resultado(texto: string, metodo: string): Record<string, unknown> {
  let env: { Envelope?: { Body?: Record<string, unknown> & { Fault?: { faultstring?: string } } } };
  try {
    env = xml.parse(texto);
  } catch {
    throw new ErrorArca("OTRO", "Respuesta inesperada de ARCA (factura electrónica).");
  }
  const body = env.Envelope?.Body;
  if (!body) throw new ErrorArca("OTRO", "Respuesta inesperada de ARCA (factura electrónica).");
  if (body.Fault) {
    const e = errorDesdeFault(String(body.Fault.faultstring ?? "Error de WSFE"));
    if (e.tipo === "NO_HABILITADO") throw new ErrorArca("NO_HABILITADO", "El servicio de factura electrónica (wsfe) no está habilitado para el certificado de ARCA.", e.detalle);
    throw e;
  }
  const r = (body[`${metodo}Response`] as Record<string, unknown> | undefined)?.[`${metodo}Result`] as Record<string, unknown> | undefined;
  if (!r) throw new ErrorArca("OTRO", "Respuesta inesperada de ARCA (factura electrónica).");
  return r;
}

/** Respuesta de FECAESolicitar → resultado tipado. */
export function leerRespuestaCAE(texto: string): ResultadoCAE {
  const r = resultado(texto, "FECAESolicitar") as {
    FeCabResp?: { Resultado?: string };
    FeDetResp?: { FECAEDetResponse?: { Resultado?: string; CAE?: string; CAEFchVto?: string; Observaciones?: { Obs?: Mensaje[] } }[] };
    Errors?: { Err?: Mensaje[] };
  };
  const det = r.FeDetResp?.FECAEDetResponse?.[0];
  const observaciones = mensajes(det?.Observaciones?.Obs);
  const errores = mensajes(r.Errors?.Err);
  const res = String(det?.Resultado ?? r.FeCabResp?.Resultado ?? "").trim();
  const cae = String(det?.CAE ?? "").trim();
  const vto = fechaDesdeArca(det?.CAEFchVto);
  if (res === "A" && cae && vto) return { ok: true, resultado: "A", cae, caeVencimiento: vto, observaciones };
  const motivos = [...errores, ...observaciones];
  return {
    ok: false,
    resultado: res === "R" || res === "P" ? res : "?",
    error: motivos.length ? `ARCA rechazó el comprobante: ${motivos.join(" · ")}` : "ARCA no autorizó el comprobante y no informó el motivo.",
    observaciones,
    errores,
  };
}

/** Respuesta de FECompUltimoAutorizado → último número (0 si no hay ninguno). */
export function leerUltimoAutorizado(texto: string): number {
  const r = resultado(texto, "FECompUltimoAutorizado") as { CbteNro?: string; Errors?: { Err?: Mensaje[] } };
  const errores = mensajes(r.Errors?.Err);
  if (errores.length) throw new ErrorArca("OTRO", `ARCA no informó el último comprobante: ${errores.join(" · ")}`);
  const n = Number(r.CbteNro ?? 0);
  if (!Number.isInteger(n) || n < 0) throw new ErrorArca("OTRO", "Respuesta inesperada de ARCA (último comprobante).");
  return n;
}

async function llamar(cfg: ConfigArca, metodo: string, cuerpo: string, ms: number): Promise<string> {
  try {
    const r = await fetch(URLS.wsfe[cfg.entorno], { method: "POST", headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: `"${NS}${metodo}"` }, body: cuerpo, signal: AbortSignal.timeout(ms), cache: "no-store" });
    return await r.text();
  } catch {
    throw new ErrorArca("CAIDO", "ARCA no responde en este momento.");
  }
}

/** Último número autorizado para el punto de venta y tipo de comprobante. */
export async function ultimoAutorizado(cfg: ConfigArca, ptoVta: number, cbteTipo: number, ms = 10_000): Promise<number> {
  const t = await obtenerTicket(cfg, "wsfe", ms);
  return leerUltimoAutorizado(await llamar(cfg, "FECompUltimoAutorizado", armarUltimoAutorizado(t, cfg.cuit, ptoVta, cbteTipo), ms));
}

/** Pide el CAE de un comprobante. Los rechazos vuelven como `{ ok: false }`; red y faults lanzan ErrorArca. */
export async function solicitarCAE(cfg: ConfigArca, req: SolicitudCAE, ms = 15_000): Promise<ResultadoCAE> {
  const t = await obtenerTicket(cfg, "wsfe", ms);
  return leerRespuestaCAE(await llamar(cfg, "FECAESolicitar", armarFECAESolicitar(t, cfg.cuit, req), ms));
}
