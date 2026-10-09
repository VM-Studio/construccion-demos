/**
 * WSAA de ARCA: autenticación para usar los web services. Arma el TRA (loginTicketRequest), lo
 * firma como CMS/PKCS#7 con el certificado y la clave privada (node-forge), lo envía a LoginCms
 * por SOAP y guarda el ticket (token + sign, ~12 h) en memoria y en la tabla ArcaTicket.
 */
import forge from "node-forge";
import { XMLParser } from "fast-xml-parser";
import { type ConfigArca, ErrorArca, errorDesdeFault, URLS } from "./config";

export interface Ticket {
  token: string;
  sign: string;
  expira: Date;
}

const xml = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, parseTagValue: false });
const memoria = new Map<string, Ticket>();
const MARGEN_MS = 5 * 60 * 1000;

/** TRA (Ticket de Requerimiento de Acceso) para un servicio. */
export function armarTRA(servicio: string, ahora = new Date()): string {
  const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
  return `<?xml version="1.0" encoding="UTF-8"?><loginTicketRequest version="1.0"><header><uniqueId>${Math.floor(ahora.getTime() / 1000)}</uniqueId><generationTime>${iso(new Date(ahora.getTime() - 10 * 60_000))}</generationTime><expirationTime>${iso(new Date(ahora.getTime() + 10 * 60_000))}</expirationTime></header><service>${servicio}</service></loginTicketRequest>`;
}

/** Firma el TRA como CMS (SignedData con el contenido incluido), en base64. */
export function firmarTRA(tra: string, certPem: string, keyPem: string): string {
  const cert = forge.pki.certificateFromPem(certPem);
  const key = forge.pki.privateKeyFromPem(keyPem);
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(tra, "utf8");
  p7.addCertificate(cert);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [{ type: forge.pki.oids.contentType, value: forge.pki.oids.data }, { type: forge.pki.oids.messageDigest }, { type: forge.pki.oids.signingTime, value: new Date() as unknown as string }],
  });
  p7.sign();
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

/** Respuesta de LoginCms → ticket. Lanza ErrorArca con el fault si lo hay. */
export function leerRespuestaLogin(respuesta: string): Ticket {
  const env = xml.parse(respuesta) as { Envelope?: { Body?: { Fault?: { faultstring?: string }; loginCmsResponse?: { loginCmsReturn?: string } } } };
  const body = env.Envelope?.Body;
  if (body?.Fault) throw errorDesdeFault(String(body.Fault.faultstring ?? "Error de WSAA"));
  const ret = body?.loginCmsResponse?.loginCmsReturn;
  if (!ret) throw new ErrorArca("OTRO", "Respuesta inesperada de ARCA (WSAA).");
  const tr = xml.parse(ret) as { loginTicketResponse?: { header?: { expirationTime?: string }; credentials?: { token?: string; sign?: string } } };
  const c = tr.loginTicketResponse?.credentials;
  const exp = tr.loginTicketResponse?.header?.expirationTime;
  if (!c?.token || !c?.sign || !exp) throw new ErrorArca("OTRO", "Respuesta incompleta de ARCA (WSAA).");
  return { token: c.token, sign: c.sign, expira: new Date(exp) };
}

const vigente = (t: Ticket | null | undefined): t is Ticket => !!t && t.expira.getTime() - MARGEN_MS > Date.now();

/** Ticket para un servicio: memoria → base → WSAA. */
export async function obtenerTicket(cfg: ConfigArca, servicio: string, ms = 6000): Promise<Ticket> {
  const { prisma } = await import("../db-base");
  const clave = `${cfg.entorno}:${servicio}`;
  const m = memoria.get(clave);
  if (vigente(m)) return m;
  const db = await prisma.arcaTicket.findUnique({ where: { servicio: clave } }).catch(() => null);
  if (vigente(db)) {
    memoria.set(clave, db);
    return db;
  }
  const cms = firmarTRA(armarTRA(servicio), cfg.certPem, cfg.keyPem);
  const sobre = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov"><soapenv:Header/><soapenv:Body><wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`;
  let texto: string;
  try {
    const r = await fetch(URLS.wsaa[cfg.entorno], { method: "POST", headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: '""' }, body: sobre, signal: AbortSignal.timeout(ms), cache: "no-store" });
    texto = await r.text();
  } catch {
    throw new ErrorArca("CAIDO", "ARCA no responde en este momento.");
  }
  try {
    const t = leerRespuestaLogin(texto);
    memoria.set(clave, t);
    await prisma.arcaTicket.upsert({ where: { servicio: clave }, create: { servicio: clave, ...t }, update: t }).catch(() => undefined);
    return t;
  } catch (e) {
    // "Ya posee un TA válido": otra instancia lo pidió; se relee el guardado.
    if (e instanceof ErrorArca && /ya posee un ta valido/i.test(e.detalle ?? "")) {
      const otra = await prisma.arcaTicket.findUnique({ where: { servicio: clave } }).catch(() => null);
      if (vigente(otra)) return otra;
    }
    throw e;
  }
}
