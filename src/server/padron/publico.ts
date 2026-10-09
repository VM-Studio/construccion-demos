/**
 * Fuente no oficial; reemplazada por ARCA cuando hay certificado.
 *
 * Consulta pública del padrón en cuitonline.com (la búsqueda por CUIT trae nombre, tipo de persona
 * y condición frente al IVA; la ficha, el domicilio). Si el sitio cambia el formato, pide captcha o
 * no responde, devuelve null y el formulario sigue manual: nunca rompe nada ni insiste.
 * (El servicio que pedía el plan, afip.tangofactura.com, ya no funciona: "Sistema desactualizado".)
 */
import * as cheerio from "cheerio";
import type { CondicionPadron, DatosPadron } from "@/domain/padron";

const BASE = "https://www.cuitonline.com";
const UA = "Mozilla/5.0 (compatible; AcerosRNF/1.0)";

const limpiar = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
const titulo = (s: string) => limpiar(s).toLowerCase().replace(/(^|[\s(/-])([a-záéíóúñü])/g, (_, a: string, b: string) => a + b.toUpperCase());

export interface ResultadoBusqueda {
  razonSocial: string;
  tipoPersona: "FISICA" | "JURIDICA";
  condicionIVA?: CondicionPadron;
  detalle?: string;
}

/** Busca el resultado del CUIT en la página de búsqueda. null si no hay (o pidió captcha). */
export function parsearBusqueda(html: string, cuit: string): ResultadoBusqueda | null {
  const $ = cheerio.load(html);
  const d = cuit.replace(/\D/g, "");
  const hit = $("div.hit")
    .toArray()
    .map((h) => $(h))
    .find((h) => h.find(".cuit").text().replace(/\D/g, "") === d);
  if (!hit) return null;
  const razonSocial = limpiar(hit.find("h2.denominacion").text());
  if (!razonSocial) return null;
  const texto = limpiar(hit.find(".doc-facets").text());
  const tipoPersona = /Persona\s+Jur[ií]dica/i.test(texto) ? "JURIDICA" : "FISICA";
  let condicionIVA: CondicionPadron | undefined;
  if (/Monotributo/i.test(texto)) condicionIVA = "MONOTRIBUTO";
  else if (/IVA:\s*Iva Inscripto/i.test(texto)) condicionIVA = "RI";
  else if (/IVA:\s*(Iva\s+)?Exento/i.test(texto)) condicionIVA = "EXENTO";
  else if (/IVA:\s*No Inscripto|IVA:\s*No Alcanzado/i.test(texto) || tipoPersona === "FISICA") condicionIVA = "NO_INSCRIPTO";
  const href = hit.find("a.denominacion").attr("href");
  return { razonSocial, tipoPersona, condicionIVA, detalle: href ? new URL(href, `${BASE}/`).toString() : undefined };
}

/** Domicilio de la ficha: el JSON (base64) del mapa trae dirección, localidad y provincia. */
export function parsearDetalle(html: string): Pick<DatosPadron, "domicilio" | "localidad" | "provincia"> {
  const $ = cheerio.load(html);
  const out: Pick<DatosPadron, "domicilio" | "localidad" | "provincia"> = {};
  const src = $("iframe.map-iframe").attr("src") ?? "";
  const b64 = src.match(/-(eyJ[A-Za-z0-9+/=]+)(?:-|$)/)?.[1];
  if (b64) {
    try {
      const j = JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as { direccion?: string; localidad?: string; provincia?: string };
      if (j.direccion) out.domicilio = titulo(j.direccion);
      if (j.localidad) out.localidad = titulo(j.localidad);
      if (j.provincia) out.provincia = titulo(j.provincia);
    } catch {
      /* formato inesperado: se usa lo visible */
    }
  }
  out.domicilio ??= limpiar($('[itemprop="streetAddress"]').first().text()) ? titulo($('[itemprop="streetAddress"]').first().text()) : undefined;
  out.localidad ??= limpiar($('[itemprop="addressLocality"]').first().text()) || undefined;
  return out;
}

async function pedir(url: string, ms: number): Promise<string | null> {
  for (let intento = 0; intento < 2; intento++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(ms), redirect: "follow", cache: "no-store" });
      if (r.ok) return await r.text();
      if (r.status < 500) return null;
    } catch {
      /* reintento */
    }
  }
  return null;
}

/** Consulta pública con timeout de 6 s por pedido y un reintento. null si no se pudo. */
export async function consultarPublico(cuit: string): Promise<DatosPadron | null> {
  try {
    const d = cuit.replace(/\D/g, "");
    const html = await pedir(`${BASE}/search.php?q=${d}`, 6000);
    if (!html) return null;
    const b = parsearBusqueda(html, d);
    if (!b) return null;
    const detalle = b.detalle ? await pedir(b.detalle, 6000) : null;
    const dom = detalle ? parsearDetalle(detalle) : {};
    return { cuit: d, razonSocial: b.razonSocial, tipoPersona: b.tipoPersona, condicionIVA: b.condicionIVA, ...dom, estado: "ACTIVO", fuente: "PUBLICO", obtenidoEn: new Date().toISOString() };
  } catch (e) {
    console.warn("[padron] fuente pública", e instanceof Error ? e.message : e);
    return null;
  }
}
