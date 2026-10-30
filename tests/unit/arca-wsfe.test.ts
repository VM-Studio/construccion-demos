import { describe, expect, it } from "vitest";
import { ErrorArca } from "@/server/arca/config";
import { armarFECAESolicitar, documentoReceptor, fechaArca, leerRespuestaCAE, leerUltimoAutorizado, tipoCbteArca, type SolicitudCAE } from "@/server/arca/wsfe";
import { urlQrArca } from "@/lib/arca-qr";

const T = { token: "TOK", sign: "SIG" };
const base: SolicitudCAE = { puntoVenta: 5, cbteTipo: 6, numero: 43, fecha: "2026-10-30T14:00:00.000Z", docTipo: 99, docNro: "0", condicionIVAReceptor: 5, neto: 1000, iva: 210 };
const sobre = (cuerpo: string) => `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${cuerpo}</soap:Body></soap:Envelope>`;
const respuestaCAE = (det: string, extra = "") =>
  sobre(`<FECAESolicitarResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECAESolicitarResult><FeCabResp><Cuit>30500010912</Cuit><PtoVta>5</PtoVta><CbteTipo>6</CbteTipo><FchProceso>20261030</FchProceso><CantReg>1</CantReg><Resultado>${det.includes("<Resultado>A") ? "A" : "R"}</Resultado><Reproceso>N</Reproceso></FeCabResp><FeDetResp><FECAEDetResponse>${det}</FECAEDetResponse></FeDetResp>${extra}</FECAESolicitarResult></FECAESolicitarResponse>`);

describe("ARCA · WSFEv1 · solicitud", () => {
  it("tipos de comprobante según tipo y letra", () => {
    expect(tipoCbteArca("FACTURA", "A")).toBe(1);
    expect(tipoCbteArca("NOTA_CREDITO", "A")).toBe(3);
    expect(tipoCbteArca("FACTURA", "B")).toBe(6);
    expect(tipoCbteArca("NOTA_CREDITO", "B")).toBe(8);
    expect(tipoCbteArca("RECIBO", "B")).toBeNull();
  });

  it("documento del receptor: CUIT 80, DNI 96, consumidor final 99", () => {
    expect(documentoReceptor("30-50001091-2")).toEqual({ docTipo: 80, docNro: "30500010912" });
    expect(documentoReceptor("12.345.678")).toEqual({ docTipo: 96, docNro: "12345678" });
    expect(documentoReceptor("1234567")).toEqual({ docTipo: 96, docNro: "1234567" });
    expect(documentoReceptor("")).toEqual({ docTipo: 99, docNro: "0" });
    expect(documentoReceptor(undefined)).toEqual({ docTipo: 99, docNro: "0" });
  });

  it("fecha en hora de Argentina", () => {
    expect(fechaArca("2026-10-31T01:30:00.000Z")).toBe("20261030");
    expect(fechaArca("2026-10-31T04:00:00.000Z")).toBe("20261031");
  });

  it("factura B a consumidor final con IVA 21 %", () => {
    const x = armarFECAESolicitar(T, "30500010912", base);
    expect(x).toContain("<ar:Auth><ar:Token>TOK</ar:Token><ar:Sign>SIG</ar:Sign><ar:Cuit>30500010912</ar:Cuit></ar:Auth>");
    expect(x).toContain("<ar:CantReg>1</ar:CantReg><ar:PtoVta>5</ar:PtoVta><ar:CbteTipo>6</ar:CbteTipo>");
    expect(x).toContain("<ar:Concepto>1</ar:Concepto><ar:DocTipo>99</ar:DocTipo><ar:DocNro>0</ar:DocNro>");
    expect(x).toContain("<ar:CbteDesde>43</ar:CbteDesde><ar:CbteHasta>43</ar:CbteHasta><ar:CbteFch>20261030</ar:CbteFch>");
    expect(x).toContain("<ar:ImpTotal>1210.00</ar:ImpTotal><ar:ImpTotConc>0.00</ar:ImpTotConc><ar:ImpNeto>1000.00</ar:ImpNeto><ar:ImpOpEx>0.00</ar:ImpOpEx><ar:ImpTrib>0.00</ar:ImpTrib><ar:ImpIVA>210.00</ar:ImpIVA>");
    expect(x).toContain("<ar:MonId>PES</ar:MonId><ar:MonCotiz>1</ar:MonCotiz><ar:CondicionIVAReceptorId>5</ar:CondicionIVAReceptorId>");
    expect(x).toContain("<ar:Iva><ar:AlicIva><ar:Id>5</ar:Id><ar:BaseImp>1000.00</ar:BaseImp><ar:Importe>210.00</ar:Importe></ar:AlicIva></ar:Iva>");
    expect(x).not.toContain("CbtesAsoc");
  });

  it("factura A a responsable inscripto con CUIT y decimales redondeados", () => {
    const x = armarFECAESolicitar(T, "30500010912", { ...base, cbteTipo: 1, docTipo: 80, docNro: "20123456786", condicionIVAReceptor: 1, neto: 844.851, iva: 177.4187 });
    expect(x).toContain("<ar:DocTipo>80</ar:DocTipo><ar:DocNro>20123456786</ar:DocNro>");
    expect(x).toContain("<ar:CondicionIVAReceptorId>1</ar:CondicionIVAReceptorId>");
    expect(x).toContain("<ar:ImpTotal>1022.27</ar:ImpTotal>");
    expect(x).toContain("<ar:ImpNeto>844.85</ar:ImpNeto>");
    expect(x).toContain("<ar:ImpIVA>177.42</ar:ImpIVA>");
  });

  it("sin importes no manda el bloque de IVA; con neto y sin IVA informa 0 %", () => {
    expect(armarFECAESolicitar(T, "30500010912", { ...base, neto: 0, iva: 0 })).not.toContain("<ar:Iva>");
    expect(armarFECAESolicitar(T, "30500010912", { ...base, neto: 500, iva: 0 })).toContain("<ar:AlicIva><ar:Id>3</ar:Id><ar:BaseImp>500.00</ar:BaseImp><ar:Importe>0.00</ar:Importe>");
  });

  it("nota de crédito con comprobante asociado, antes del bloque de IVA", () => {
    const x = armarFECAESolicitar(T, "30500010912", { ...base, cbteTipo: 8, asociados: [{ tipo: 6, puntoVenta: 5, numero: 42, cuit: "30500010912", fecha: "20261029" }] });
    expect(x).toContain("<ar:CbtesAsoc><ar:CbteAsoc><ar:Tipo>6</ar:Tipo><ar:PtoVta>5</ar:PtoVta><ar:Nro>42</ar:Nro><ar:Cuit>30500010912</ar:Cuit><ar:CbteFch>20261029</ar:CbteFch></ar:CbteAsoc></ar:CbtesAsoc>");
    expect(x.indexOf("<ar:CbtesAsoc>")).toBeLessThan(x.indexOf("<ar:Iva>"));
    expect(x.indexOf("<ar:CondicionIVAReceptorId>")).toBeLessThan(x.indexOf("<ar:CbtesAsoc>"));
  });
});

describe("ARCA · WSFEv1 · respuesta", () => {
  it("aprobado: CAE y vencimiento en ISO", () => {
    const r = leerRespuestaCAE(respuestaCAE("<Concepto>1</Concepto><DocTipo>99</DocTipo><DocNro>0</DocNro><CbteDesde>43</CbteDesde><CbteHasta>43</CbteHasta><CbteFch>20261030</CbteFch><Resultado>A</Resultado><CAE>76431234567890</CAE><CAEFchVto>20261109</CAEFchVto>"));
    expect(r).toEqual({ ok: true, resultado: "A", cae: "76431234567890", caeVencimiento: "2026-11-09", observaciones: [] });
  });

  it("aprobado con observaciones las conserva", () => {
    const r = leerRespuestaCAE(respuestaCAE("<Resultado>A</Resultado><CAE>76431234567890</CAE><CAEFchVto>20261109</CAEFchVto><Observaciones><Obs><Code>10217</Code><Msg>Aviso informativo</Msg></Obs></Observaciones>"));
    expect(r.ok).toBe(true);
    expect(r.observaciones).toEqual(["10217: Aviso informativo"]);
  });

  it("rechazado con observaciones: motivo legible", () => {
    const r = leerRespuestaCAE(
      respuestaCAE("<Resultado>R</Resultado><CAE></CAE><CAEFchVto></CAEFchVto><Observaciones><Obs><Code>10016</Code><Msg>El numero de comprobante no es el proximo a autorizar.</Msg></Obs><Obs><Code>10242</Code><Msg>Falta la condicion de IVA del receptor.</Msg></Obs></Observaciones>"),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.resultado).toBe("R");
    expect(r.observaciones).toHaveLength(2);
    expect(r.error).toMatch(/^ARCA rechazó el comprobante: 10016: El numero de comprobante/);
    expect(r.error).toContain("10242");
  });

  it("rechazado con errores generales (Errors/Err)", () => {
    const r = leerRespuestaCAE(respuestaCAE("<Resultado>R</Resultado>", "<Errors><Err><Code>600</Code><Msg>ValidacionDeToken: No validaron las fechas del token</Msg></Err></Errors>"));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errores).toEqual(["600: ValidacionDeToken: No validaron las fechas del token"]);
    expect(r.error).toContain("600");
  });

  it("SOAP fault lanza ErrorArca", () => {
    expect(() => leerRespuestaCAE(sobre("<soap:Fault><faultcode>soap:Client</faultcode><faultstring>Server was unable to read request.</faultstring></soap:Fault>"))).toThrow(ErrorArca);
  });

  it("último autorizado", () => {
    expect(leerUltimoAutorizado(sobre(`<FECompUltimoAutorizadoResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECompUltimoAutorizadoResult><PtoVta>5</PtoVta><CbteTipo>6</CbteTipo><CbteNro>42</CbteNro></FECompUltimoAutorizadoResult></FECompUltimoAutorizadoResponse>`))).toBe(42);
    expect(() => leerUltimoAutorizado(sobre(`<FECompUltimoAutorizadoResponse xmlns="http://ar.gov.afip.dif.FEV1/"><FECompUltimoAutorizadoResult><CbteNro>0</CbteNro><Errors><Err><Code>601</Code><Msg>CUIT representada no incluida en Token</Msg></Err></Errors></FECompUltimoAutorizadoResult></FECompUltimoAutorizadoResponse>`))).toThrow(/601/);
  });
});

describe("ARCA · QR (RG 4892)", () => {
  it("arma la URL con el JSON en base64", () => {
    const url = urlQrArca({ fecha: "2026-10-30T14:00:00.000Z", cuitEmisor: "30-50001091-2", puntoVenta: 5, tipo: 6, numero: 43, importe: 1210, docTipo: 99, docNro: "0", cae: "76431234567890" });
    expect(url.startsWith("https://www.afip.gob.ar/fe/qr/?p=")).toBe(true);
    const json = JSON.parse(Buffer.from(url.split("?p=")[1], "base64").toString("utf8"));
    expect(json).toEqual({ ver: 1, fecha: "2026-10-30", cuit: 30500010912, ptoVta: 5, tipoCmp: 6, nroCmp: 43, importe: 1210, moneda: "PES", ctz: 1, tipoDocRec: 99, nroDocRec: 0, tipoCodAut: "E", codAut: 76431234567890 });
  });
});
