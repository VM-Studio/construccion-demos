/**
 * Caso de referencia: acopio de Ramos María Zulema, AC2 0001-00003633 (documento real
 * "Detalle de acopio"), importe $ 4.500.000, cierra en $ 844,85.
 * Se arma con `seedEjemplo` (las NP, DP y ACD transcriptos en `src/data/seed/ramos.ts`).
 */
import { describe, expect, it } from "vitest";
import { addDays } from "date-fns";
import { seedEjemplo } from "@/data/seed";
import {
  diasParaVencer,
  estadoDerivado,
  montoPendienteEntrega,
  movimientosAcopio,
  pagadoAcopio,
  pendienteEntrega,
  resumenArticulos,
  retiradoAcopio,
  saldoDisponible,
  validarRetiro,
} from "@/domain/acopios";

const HOY = new Date("2026-10-09T15:00:00.000Z");
const db = seedEjemplo(HOY);
const ramos = db.acopios.find((a) => a.numero === "AC2 0001-00003633")!;
const saldo = () => saldoDisponible(ramos, db.notasPedido, db.devoluciones, db.ajustesAcopio);
const grupos = movimientosAcopio(ramos, db.notasPedido, db.devoluciones, db.ajustesAcopio, db);
const lineas = grupos.flatMap((g) => g.lineas.map((l) => ({ doc: g.numero, ...l })));

/*
 * Totales del documento (montos exactos con 3 decimales):
 *   Σ NP  = 4.542.167,299 (25 notas de pedido)
 *   Σ DP  =    32.974,644 (4 devoluciones: 3.200,90 + 12.760,176 + 12.760,176 + 4.253,392)
 *   Σ ACD =    10.037,507 (4 traspasos: 980,804 + 5.716,518 + 1.657,133 + 1.683,052)
 *   Saldo = 4.500.000 − 4.542.167,299 + 32.974,644 + 10.037,507 = 844,852 → $ 844,85
 */
const SUMA_NP = 4_542_167.299;
const SUMA_DP = 32_974.644;
const SUMA_ACD = 10_037.507;

describe("Acopio de Ramos AC2 0001-00003633 (caso de referencia)", () => {
  it("existe en el seed de ejemplo con importe $ 4.500.000, circuito 2 y anticipo", () => {
    expect(ramos).toBeDefined();
    expect(ramos.importe).toBe(4_500_000);
    expect(ramos.circuito).toBe(2);
    expect(ramos.formaPago).toBe("ANTICIPO");
    expect(ramos.obraIds).toEqual(["obra_ramos_1", "obra_ramos_2"]);
  });

  it("tiene 25 NP, 4 DP y 4 ACD", () => {
    const cuenta = (t: string) => grupos.filter((g) => g.tipoDoc === t).length;
    expect([cuenta("NP"), cuenta("DP"), cuenta("ACD")]).toEqual([25, 4, 4]);
  });

  it("los totales por tipo de documento coinciden con el documento", () => {
    const suma = (t: string) => grupos.filter((g) => g.tipoDoc === t).reduce((a, g) => a + g.monto, 0);
    expect(suma("NP")).toBeCloseTo(SUMA_NP, 3);
    // En el detalle las DP van negativas y los ACD con el signo invertido.
    expect(suma("DP")).toBeCloseTo(-SUMA_DP, 3);
    expect(suma("ACD")).toBeCloseTo(-SUMA_ACD, 3);
  });

  it("las DP se guardan con monto negativo y los ACD de traspaso de entrada con monto positivo", () => {
    const dps = db.devoluciones.filter((d) => d.acopioId === ramos.id);
    const acds = db.ajustesAcopio.filter((a) => a.acopioId === ramos.id);
    expect(dps.every((d) => d.monto < 0)).toBe(true);
    expect(acds.every((a) => a.monto > 0 && a.tipo === "TRASPASO_ENTRADA")).toBe(true);
    expect(acds.map((a) => a.numero).sort()).toEqual(["ACD2 0001-00003595", "ACD2 0001-00003596", "ACD2 0001-00003599", "ACD2 0001-00003601"]);
  });

  it("retirado neto = Σ NP + Σ DP = 4.509.192,655", () => {
    expect(retiradoAcopio(ramos.id, db.notasPedido, db.devoluciones)).toBeCloseTo(SUMA_NP - SUMA_DP, 3);
  });

  it("el saldo disponible cierra en $ 844,85", () => {
    expect(saldo()).toBeCloseTo(844.85, 2);
    expect(Math.abs(saldo() - 844.85)).toBeLessThan(0.005);
  });

  it("el saldo corrido cierra en $ 844,85 en la última línea (NP 00073954)", () => {
    const ultima = lineas.at(-1)!;
    expect(ultima.doc).toBe("NP2 0001-00073954");
    expect(ultima.saldoDisponible).toBe(844.85);
  });

  it("el saldo corrido coincide con el documento en los puntos de control", () => {
    const saldoTras = (doc: string) => lineas.filter((l) => l.doc === doc).at(-1)!.saldoDisponible;
    // Primera línea: 4.500.000 − 231.074,10 (2299 · HIERRO 6 MM)
    expect(lineas[0].saldoDisponible).toBe(4_268_925.9);
    // Fin de NP 67299: 4.500.000 − 997.707,94
    expect(saldoTras("NP2 0001-00067299")).toBe(3_502_292.06);
    // NP 67661 (100 ladrillos sin retirar) y su DP: el saldo vuelve exactamente a donde estaba
    expect(saldoTras("NP2 0001-00067375")).toBe(3_143_184.32);
    expect(saldoTras("NP2 0001-00067661")).toBe(3_139_983.42);
    expect(saldoTras("DP2 0001-00067661-1")).toBe(3_143_184.32);
    // Después de los 4 traspasos (ACD) del día 42
    expect(saldoTras("ACD2 0001-00003599")).toBe(1_833_566.46);
    // Después de las 3 devoluciones de pallets
    expect(saldoTras("DP2 0001-00069103-1")).toBe(923_059.45);
    // Antes de la última NP
    expect(saldoTras("NP2 0001-00072898")).toBe(3793.45);
  });

  it("cada línea del saldo corrido es la anterior menos su subtotal (tolerancia de centavos)", () => {
    let prev = ramos.importe;
    for (const l of lineas) {
      expect(Math.abs(prev - l.subtotal - l.saldoDisponible)).toBeLessThanOrEqual(0.011);
      prev = l.saldoDisponible;
    }
  });

  it("el saldo corrido final coincide con saldoDisponible", () => {
    expect(Math.abs(lineas.at(-1)!.saldoDisponible - saldo())).toBeLessThan(0.005);
  });

  it("los movimientos están en orden cronológico", () => {
    const fechas = grupos.map((g) => g.fecha);
    expect([...fechas].sort()).toEqual(fechas);
  });

  it("OJO: los ACD del mismo día salen ordenados por el minuto que les asigna el seed (3601 antes que 3595)", () => {
    // OJO: el seed usa el último dígito del número como minuto, así que ACD 3601 (min 1) queda antes que 3595 (min 5).
    // El saldo final no cambia, pero el orden no es el del documento original (3595, 3596, 3599, 3601).
    expect(grupos.filter((g) => g.tipoDoc === "ACD").map((g) => g.numero)).toEqual(["ACD2 0001-00003601", "ACD2 0001-00003595", "ACD2 0001-00003596", "ACD2 0001-00003599"]);
  });

  it("queda pendiente de entrega solo la última NP: 3 bolsas de cemento a CANTON GOLF", () => {
    const p = pendienteEntrega(ramos.id, db.notasPedido);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ productoId: "prod_50104", obraId: "obra_ramos_2", pendiente: 3, precio: 982.87 });
    // 3 × 982,87 (el subtotal del documento es 2.948,598: precio × cantidad redondea distinto)
    expect(montoPendienteEntrega(ramos.id, db.notasPedido)).toBeCloseTo(2948.61, 2);
  });

  it("el resumen de artículos refleja lo retirado neto y lo devuelto", () => {
    const r = resumenArticulos(ramos, db.notasPedido, db.devoluciones, db.productos, db.remitos);
    const art = (codigo: string) => r.find((x) => x.codigo === codigo)!;
    // Ladrillo común: 1.600 + 100 + 2.000 retirados, 100 devueltos → −3.600
    expect(art("30101")).toMatchObject({ devueltos: 100, pendiente: 0, saldo: -3600 });
    // Pallets: 25 retirados, 7 devueltos → −18
    expect(art("140105")).toMatchObject({ devueltos: 7, pendiente: 0, saldo: -18 });
    // Cemento Holcim: 763 retirados, 3 pendientes
    expect(art("50104")).toMatchObject({ pendiente: 3, saldo: -763 });
    expect(r).toHaveLength(ramos.preciosCongelados.length);
  });

  it("está totalmente pagado: factura F2 0001-00086926 por $ 4.500.000 cobrada con 2 recibos", () => {
    expect(pagadoAcopio(ramos, db.comprobantes)).toBe(4_500_000);
    expect(db.comprobantes.find((c) => c.id === ramos.comprobanteIds[0])!.numero).toBe("F2 0001-00086926");
    expect(ramos.reciboIds).toHaveLength(2);
  });

  it("está VIGENTE y vence en 2 días; pasada la fecha con saldo queda VENCIDO", () => {
    expect(diasParaVencer(ramos, HOY)).toBe(2);
    expect(estadoDerivado(ramos, HOY, saldo())).toBe("VIGENTE");
    expect(estadoDerivado(ramos, addDays(HOY, 3), saldo())).toBe("VENCIDO");
  });

  it("un retiro de $ 844,85 es válido y uno de $ 844,86 excede el saldo", () => {
    expect(validarRetiro(saldo(), 844.85)).toMatchObject({ ok: true, saldoDespues: 0 });
    expect(validarRetiro(saldo(), 844.86).ok).toBe(false);
  });

  it("el acopio viejo AC2 0001-00003208 quedó AGOTADO tras traspasar su saldo al 3633", () => {
    const viejo = db.acopios.find((a) => a.numero === "AC2 0001-00003208")!;
    const s = saldoDisponible(viejo, db.notasPedido, db.devoluciones, db.ajustesAcopio);
    expect(s).toBe(0);
    expect(estadoDerivado(viejo, HOY, s)).toBe("AGOTADO");
    const salida = db.ajustesAcopio.find((a) => a.acopioId === viejo.id && a.tipo === "TRASPASO_SALIDA")!;
    expect(salida.monto).toBeCloseTo(-980.804, 3);
    expect(salida.acopioRelacionadoId).toBe(ramos.id);
  });
});
