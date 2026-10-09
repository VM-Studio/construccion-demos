/**
 * Consulta del padrón oficial de ARCA:
 * - ws_sr_padron_a13 `getPersona`: nombre/razón social, tipo de persona, domicilio fiscal y estado.
 * - ws_sr_padron_a5 `getPersona_v2`: condición frente al IVA. Si A5 no está habilitado para el
 *   certificado, se usa solo A13 y la condición queda en blanco para elegirla a mano.
 * SOAP con fetch + fast-xml-parser (sin librerías SOAP).
 */
import { XMLParser } from "fast-xml-parser";
import { condicionDesdeA5, type DatosPadron, mapearA13, type PersonaA13, type PersonaA5 } from "@/domain/padron";
import { type ConfigArca, ErrorArca, errorDesdeFault, URLS } from "./config";
import { obtenerTicket } from "./wsaa";

const xml = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, parseTagValue: false, isArray: (n) => n === "domicilio" || n === "impuesto" });

function sobre(ns: string, metodo: string, t: { token: string; sign: string }, cuitRepresentada: string, idPersona: string) {
  return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a="${ns}"><soapenv:Header/><soapenv:Body><a:${metodo}><token>${t.token}</token><sign>${t.sign}</sign><cuitRepresentada>${cuitRepresentada}</cuitRepresentada><idPersona>${idPersona}</idPersona></a:${metodo}></soapenv:Body></soapenv:Envelope>`;
}

/** Cuerpo SOAP → `personaReturn`. Lanza ErrorArca si hay fault. */
export function leerPersonaReturn(texto: string): Record<string, unknown> {
  const env = xml.parse(texto) as { Envelope?: { Body?: Record<string, unknown> & { Fault?: { faultstring?: string } } } };
  const body = env.Envelope?.Body;
  if (!body) throw new ErrorArca("OTRO", "Respuesta inesperada de ARCA (padrón).");
  if (body.Fault) throw errorDesdeFault(String(body.Fault.faultstring ?? "Error del padrón"));
  const resp = Object.values(body).find((v) => v && typeof v === "object") as { personaReturn?: Record<string, unknown> } | undefined;
  if (!resp?.personaReturn) throw new ErrorArca("INEXISTENTE", "El CUIT no existe en el padrón de ARCA.");
  return resp.personaReturn;
}

/** Mapea la respuesta A13 (+ A5 opcional) a DatosPadron. */
export function datosDesdeRespuestas(a13: Record<string, unknown>, a5?: Record<string, unknown> | null): DatosPadron {
  const persona = (a13.persona ?? a13) as PersonaA13;
  const base = mapearA13(persona);
  return { ...base, condicionIVA: a5 ? condicionDesdeA5(a5 as PersonaA5) : undefined };
}

async function llamar(url: string, cuerpo: string, ms: number): Promise<string> {
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: '""' }, body: cuerpo, signal: AbortSignal.timeout(ms), cache: "no-store" });
    return await r.text();
  } catch {
    throw new ErrorArca("CAIDO", "ARCA no responde en este momento.");
  }
}

export async function consultarArca(cfg: ConfigArca, cuit: string, ms = 7000): Promise<DatosPadron> {
  const d = cuit.replace(/\D/g, "");
  const t13 = await obtenerTicket(cfg, "ws_sr_padron_a13", ms);
  const a13 = leerPersonaReturn(await llamar(URLS.a13[cfg.entorno], sobre("http://a13.soap.ws.server.puc.sr/", "getPersona", t13, cfg.cuit, d), ms));
  let a5: Record<string, unknown> | null = null;
  try {
    const t5 = await obtenerTicket(cfg, "ws_sr_padron_a5", ms);
    a5 = leerPersonaReturn(await llamar(URLS.a5[cfg.entorno], sobre("http://a5.soap.ws.server.puc.sr/", "getPersona_v2", t5, cfg.cuit, d), ms));
  } catch (e) {
    if (!(e instanceof ErrorArca) || e.tipo === "INEXISTENTE") throw e;
    console.warn("[arca] A5 no disponible, solo A13:", e.message);
  }
  return datosDesdeRespuestas(a13, a5);
}
