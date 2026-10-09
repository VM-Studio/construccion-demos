import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cacheVigente, completarDesdePadron, condicionDesdeA5, condicionSistema, mapearA13, type DatosPadron } from "@/domain/padron";
import { validarCUIT, buscarPorCuit } from "@/domain/cuit";
import { datosDesdeRespuestas, leerPersonaReturn } from "@/server/arca/padron";
import { errorDesdeFault, ErrorArca } from "@/server/arca/config";
import { armarTRA, leerRespuestaLogin } from "@/server/arca/wsaa";
import { parsearBusqueda, parsearDetalle } from "@/server/padron/publico";
import { completarFilaConPadron, filasParaPadron } from "@/domain/importacion";

const fx = (n: string) => fs.readFileSync(path.resolve(__dirname, "../fixtures/padron", n), "utf8");

describe("validación de CUIT/CUIL", () => {
  it("acepta CUIT y CUIL válidos con o sin guiones", () => {
    expect(validarCUIT("30-50001091-2")).toBeNull();
    expect(validarCUIT("30500010912")).toBeNull();
    expect(validarCUIT("20-12345678-6")).toBeNull();
  });
  it("rechaza dígito verificador, prefijo y largo inválidos", () => {
    expect(validarCUIT("30-50001091-3")).toMatch(/verificador/);
    expect(validarCUIT("40-50001091-2")).toMatch(/prefijo/);
    expect(validarCUIT("3050001091")).toMatch(/11 dígitos/);
  });
  it("encuentra duplicados comparando solo dígitos y excluye el propio registro", () => {
    const lista = [{ id: "a", cuit: "30-50001091-2" }, { id: "b", cuit: "20123456786" }];
    expect(buscarPorCuit(lista, "30500010912")?.id).toBe("a");
    expect(buscarPorCuit(lista, "30-50001091-2", "a")).toBeUndefined();
    expect(buscarPorCuit(lista, "")).toBeUndefined();
  });
});

describe("ARCA · ws_sr_padron_a13", () => {
  it("persona física: apellido y nombre, domicilio FISCAL (no el legal) y código postal", () => {
    const d = datosDesdeRespuestas(leerPersonaReturn(fx("a13.xml")));
    expect(d).toMatchObject({ cuit: "20123456786", razonSocial: "Perez Juan Carlos", tipoPersona: "FISICA", domicilio: "Rivadavia 6000 Piso 2", localidad: "Caballito", provincia: "Ciudad Autonoma Buenos Aires", codigoPostal: "1406", estado: "ACTIVO", fuente: "ARCA" });
    expect(d.condicionIVA).toBeUndefined(); // sin A5 se elige a mano
  });
  it("persona jurídica: razón social en mayúsculas y estado inactivo", () => {
    const d = datosDesdeRespuestas(leerPersonaReturn(fx("a13-juridica.xml")));
    expect(d).toMatchObject({ razonSocial: "BANCO DE LA NACION ARGENTINA", tipoPersona: "JURIDICA", estado: "INACTIVO", codigoPostal: "C1036AAB" });
  });
  it("con A5 completa la condición frente al IVA", () => {
    expect(datosDesdeRespuestas(leerPersonaReturn(fx("a13-juridica.xml")), leerPersonaReturn(fx("a5-ri.xml"))).condicionIVA).toBe("RI");
    expect(datosDesdeRespuestas(leerPersonaReturn(fx("a13.xml")), leerPersonaReturn(fx("a5-monotributo.xml"))).condicionIVA).toBe("MONOTRIBUTO");
  });
  it("un fault 'No existe persona' es CUIT inexistente", () => {
    expect(() => leerPersonaReturn(fx("fault-inexistente.xml"))).toThrow(ErrorArca);
    try {
      leerPersonaReturn(fx("fault-inexistente.xml"));
    } catch (e) {
      expect((e as ErrorArca).tipo).toBe("INEXISTENTE");
    }
  });
  it("mapearA13 sin domicilio no inventa campos", () => {
    const d = mapearA13({ idPersona: "20123456786", tipoPersona: "FISICA", nombre: "ANA", apellido: "GOMEZ" });
    expect(d.razonSocial).toBe("Gomez Ana");
    expect(d.domicilio).toBeUndefined();
  });
});

describe("ARCA · condición frente al IVA (A5)", () => {
  it("impuesto 30 → RI; 32 → exento; solo ganancias → no inscripto; monotributo → MONOTRIBUTO", () => {
    expect(condicionDesdeA5({ datosRegimenGeneral: { impuesto: [{ idImpuesto: 10 }, { idImpuesto: 30 }] } })).toBe("RI");
    expect(condicionDesdeA5({ datosRegimenGeneral: { impuesto: { idImpuesto: 32 } } })).toBe("EXENTO");
    expect(condicionDesdeA5({ datosRegimenGeneral: { impuesto: [{ idImpuesto: 20 }] } })).toBe("NO_INSCRIPTO");
    expect(condicionDesdeA5({ datosMonotributo: { categoriaMonotributo: { idCategoria: 27 } } })).toBe("MONOTRIBUTO");
    expect(condicionDesdeA5({})).toBe("NO_INSCRIPTO");
  });
  it("NO_INSCRIPTO se factura como consumidor final", () => {
    expect(condicionSistema("NO_INSCRIPTO")).toBe("CF");
    expect(condicionSistema("RI")).toBe("RI");
    expect(condicionSistema(undefined)).toBeUndefined();
  });
});

describe("ARCA · errores y WSAA", () => {
  it("clasifica los faults en mensajes en español", () => {
    expect(errorDesdeFault("Certificado expirado").tipo).toBe("CERTIFICADO_VENCIDO");
    expect(errorDesdeFault("Computador no autorizado a acceder al servicio").tipo).toBe("NO_HABILITADO");
    expect(errorDesdeFault("No existe persona con ese Id").tipo).toBe("INEXISTENTE");
    expect(errorDesdeFault("algo raro").message).toMatch(/ARCA/);
  });
  it("el TRA lleva el servicio y una ventana de ±10 minutos", () => {
    const tra = armarTRA("ws_sr_padron_a13", new Date("2026-10-09T12:00:00Z"));
    expect(tra).toContain("<service>ws_sr_padron_a13</service>");
    expect(tra).toContain("<generationTime>2026-10-09T11:50:00Z</generationTime>");
    expect(tra).toContain("<expirationTime>2026-10-09T12:10:00Z</expirationTime>");
  });
  it("lee token, sign y vencimiento de LoginCms", () => {
    const ticket = `&lt;?xml version="1.0"?&gt;&lt;loginTicketResponse version="1.0"&gt;&lt;header&gt;&lt;expirationTime&gt;2026-10-10T00:00:00.000-03:00&lt;/expirationTime&gt;&lt;/header&gt;&lt;credentials&gt;&lt;token&gt;TOK&lt;/token&gt;&lt;sign&gt;SIG&lt;/sign&gt;&lt;/credentials&gt;&lt;/loginTicketResponse&gt;`;
    const r = leerRespuestaLogin(`<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><loginCmsResponse><loginCmsReturn>${ticket}</loginCmsReturn></loginCmsResponse></soapenv:Body></soapenv:Envelope>`);
    expect(r.token).toBe("TOK");
    expect(r.sign).toBe("SIG");
    expect(r.expira.toISOString()).toBe("2026-10-10T03:00:00.000Z");
  });
});

describe("fuente pública", () => {
  it("lee nombre, tipo de persona e IVA de la búsqueda", () => {
    expect(parsearBusqueda(fx("cuitonline-busqueda.html"), "30-50001091-2")).toMatchObject({ razonSocial: "BANCO DE LA NACION ARGENTINA", tipoPersona: "JURIDICA", condicionIVA: "RI" });
  });
  it("si el CUIT no está en la página (o pidió captcha) devuelve null", () => {
    expect(parsearBusqueda(fx("cuitonline-busqueda.html"), "20123456786")).toBeNull();
    expect(parsearBusqueda("<html><body>captcha</body></html>", "30500010912")).toBeNull();
  });
  it("lee el domicilio de la ficha (JSON del mapa)", () => {
    expect(parsearDetalle(fx("cuitonline-detalle.html"))).toEqual({ domicilio: "Mitre Bartolome 326 P4 D428", localidad: "Ciudad Autonoma Buenos Aires", provincia: "Ciudad Autonoma Buenos Aires" });
  });
  it("una ficha con otro formato no rompe", () => {
    expect(parsearDetalle("<html></html>")).toEqual({ domicilio: undefined, localidad: undefined });
  });
});

const DATOS: DatosPadron = { cuit: "30500010912", razonSocial: "BANCO DE LA NACION ARGENTINA", tipoPersona: "JURIDICA", condicionIVA: "RI", domicilio: "Bartolome Mitre 326", localidad: "Caba", provincia: "Caba", codigoPostal: "C1036AAB", estado: "ACTIVO", fuente: "ARCA", obtenidoEn: "2026-10-09T12:00:00Z" };

describe("completar el formulario sin pisar lo escrito", () => {
  const vacio = { razonSocial: "", condicionIVA: "CF" as const, direccion: "", localidad: "", provincia: undefined, codigoPostal: undefined };
  it("completa todos los vacíos", () => {
    expect(completarDesdePadron(vacio, DATOS)).toEqual({ razonSocial: DATOS.razonSocial, condicionIVA: "RI", direccion: DATOS.domicilio, localidad: "Caba", provincia: "Caba", codigoPostal: "C1036AAB" });
  });
  it("no pisa lo que el usuario ya escribió", () => {
    const c = completarDesdePadron({ ...vacio, razonSocial: "Banco Nación (sucursal)", direccion: "Otra 1" }, DATOS);
    expect(c.razonSocial).toBeUndefined();
    expect(c.direccion).toBeUndefined();
    expect(c.localidad).toBe("Caba");
  });
  it("no cambia la condición de IVA si el usuario la eligió", () => {
    expect(completarDesdePadron(vacio, DATOS, { tocados: new Set(["condicionIVA"]) }).condicionIVA).toBeUndefined();
  });
  it("'Reemplazar con los datos del padrón' pisa todo lo que trae el padrón", () => {
    const c = completarDesdePadron({ ...vacio, razonSocial: "X", direccion: "Y" }, DATOS, { reemplazar: true, tocados: new Set(["razonSocial"]) });
    expect(c).toMatchObject({ razonSocial: DATOS.razonSocial, direccion: DATOS.domicilio });
  });
  it("sin condición de IVA en el padrón no se toca la del formulario", () => {
    expect(completarDesdePadron(vacio, { ...DATOS, condicionIVA: undefined }).condicionIVA).toBeUndefined();
  });
});

describe("caché del padrón (30 días)", () => {
  const ahora = new Date("2026-10-09T12:00:00Z");
  it("vale 30 días", () => {
    expect(cacheVigente("2026-09-10T12:00:01Z", ahora)).toBe(true);
    expect(cacheVigente("2026-09-09T12:00:00Z", ahora)).toBe(false);
    expect(cacheVigente("fecha-rota", ahora)).toBe(false);
  });
});

describe("importación CSV con padrón", () => {
  const mapeo = { cuit: "CUIT", razon_social: "Nombre" };
  it("consulta solo filas con CUIT válido y sin razón social", () => {
    const filas = [{ CUIT: "30-50001091-2", Nombre: "" }, { CUIT: "30-50001091-2", Nombre: "Ya tiene" }, { CUIT: "123", Nombre: "" }, { CUIT: "", Nombre: "" }];
    expect(filasParaPadron(filas, mapeo)).toEqual([0]);
  });
  it("completa la fila y agrega columnas que faltan sin pisar valores", () => {
    const r = completarFilaConPadron({ CUIT: "30500010912", Nombre: "" }, mapeo, DATOS);
    expect(r.fila).toMatchObject({ Nombre: DATOS.razonSocial, "(padrón) condicion_iva": "RI", "(padrón) direccion": DATOS.domicilio });
    expect(r.mapeo).toMatchObject({ razon_social: "Nombre", condicion_iva: "(padrón) condicion_iva" });
  });
});
