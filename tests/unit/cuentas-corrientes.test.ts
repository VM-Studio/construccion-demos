import { describe, expect, it } from "vitest";
import {
  antiguedadDeuda,
  diasAtraso,
  disponibleCredito,
  esComprobanteDeuda,
  estadoPorSaldo,
  estaVencido,
  imputarAutomaticamente,
  saldoCliente,
  saldoProveedor,
} from "@/domain/cuentasCorrientes";
import type { Comprobante, TipoComprobante } from "@/domain/types";

let secuencia = 0;
/** Comprobante mínimo: factura F1 pendiente del cliente "cli-ramos" por $ 1.000. */
function comprobante(over: Partial<Comprobante> = {}): Comprobante {
  secuencia++;
  return {
    id: `cmp-${secuencia}`,
    creadoEn: "2026-10-01T12:00:00.000Z",
    actualizadoEn: "2026-10-01T12:00:00.000Z",
    tipo: "FACTURA",
    circuito: 1,
    numero: `F1 0001-${String(secuencia).padStart(8, "0")}`,
    clienteId: "cli-ramos",
    fecha: "2026-10-01",
    subtotal: 826.45,
    iva: 173.55,
    total: 1000,
    saldoPendiente: 1000,
    estado: "PENDIENTE",
    ...over,
  };
}

// Fechas locales a mediodía para no depender de la zona horaria de la máquina.
const HOY = new Date(2026, 9, 9, 12, 0, 0); // 9 de octubre de 2026

describe("esComprobanteDeuda", () => {
  it.each<[TipoComprobante, boolean]>([
    ["FACTURA", true],
    ["NOTA_DEBITO", true],
    ["SALDO_INICIAL", true],
    ["NOTA_CREDITO", false],
    ["SALDO_A_FAVOR", false],
  ])("%s → %s", (tipo, esperado) => {
    expect(esComprobanteDeuda({ tipo })).toBe(esperado);
  });
});

describe("saldoCliente", () => {
  it("suma facturas, notas de débito y saldos iniciales del cliente", () => {
    const cs = [
      comprobante({ saldoPendiente: 1000 }),
      comprobante({ tipo: "NOTA_DEBITO", saldoPendiente: 250.5 }),
      comprobante({ tipo: "SALDO_INICIAL", saldoPendiente: 3000 }),
    ];
    expect(saldoCliente("cli-ramos", cs)).toBeCloseTo(4250.5, 2);
  });

  it("las notas de crédito y saldos a favor restan (vienen con saldo negativo)", () => {
    const cs = [
      comprobante({ saldoPendiente: 1000 }),
      comprobante({ tipo: "NOTA_CREDITO", saldoPendiente: -300 }),
      comprobante({ tipo: "SALDO_A_FAVOR", saldoPendiente: -200 }),
    ];
    expect(saldoCliente("cli-ramos", cs)).toBe(500);
  });

  it("OJO: el signo lo da saldoPendiente, no el tipo: una NC cargada con saldo positivo SUMA deuda", () => {
    const cs = [comprobante({ saldoPendiente: 1000 }), comprobante({ tipo: "NOTA_CREDITO", saldoPendiente: 300 })];
    expect(saldoCliente("cli-ramos", cs)).toBe(1300);
  });

  it("excluye anulados y comprobantes de otros clientes o de proveedores", () => {
    const cs = [
      comprobante({ saldoPendiente: 1000 }),
      comprobante({ saldoPendiente: 5000, estado: "ANULADO" }),
      comprobante({ clienteId: "cli-otro", saldoPendiente: 700 }),
      comprobante({ clienteId: undefined, proveedorId: "prov-loma", saldoPendiente: 900 }),
    ];
    expect(saldoCliente("cli-ramos", cs)).toBe(1000);
  });

  it("pagados no suman (saldo 0) y sin comprobantes da 0", () => {
    expect(saldoCliente("cli-ramos", [comprobante({ saldoPendiente: 0, estado: "PAGADO" })])).toBe(0);
    expect(saldoCliente("cli-ramos", [])).toBe(0);
  });

  it("puede quedar negativo (a favor del cliente)", () => {
    const cs = [comprobante({ saldoPendiente: 100 }), comprobante({ tipo: "SALDO_A_FAVOR", saldoPendiente: -400 })];
    expect(saldoCliente("cli-ramos", cs)).toBe(-300);
  });
});

describe("saldoProveedor", () => {
  it("suma lo que le debemos al proveedor, sin anulados ni de otros", () => {
    const cs = [
      comprobante({ clienteId: undefined, proveedorId: "prov-loma", saldoPendiente: 12000 }),
      comprobante({ clienteId: undefined, proveedorId: "prov-loma", tipo: "NOTA_CREDITO", saldoPendiente: -2000 }),
      comprobante({ clienteId: undefined, proveedorId: "prov-loma", saldoPendiente: 9999, estado: "ANULADO" }),
      comprobante({ clienteId: undefined, proveedorId: "prov-acindar", saldoPendiente: 500 }),
      comprobante({ saldoPendiente: 800 }), // de cliente
    ];
    expect(saldoProveedor("prov-loma", cs)).toBe(10000);
    expect(saldoProveedor("prov-acindar", cs)).toBe(500);
    expect(saldoProveedor("prov-inexistente", cs)).toBe(0);
  });
});

describe("estaVencido", () => {
  it("vence al día siguiente del vencimiento, no el mismo día", () => {
    expect(estaVencido(comprobante({ vencimiento: "2026-10-08" }), HOY)).toBe(true);
    expect(estaVencido(comprobante({ vencimiento: "2026-10-09" }), HOY)).toBe(false);
    expect(estaVencido(comprobante({ vencimiento: "2026-10-10" }), HOY)).toBe(false);
  });

  it("sin vencimiento usa la fecha de emisión", () => {
    expect(estaVencido(comprobante({ fecha: "2026-10-08", vencimiento: undefined }), HOY)).toBe(true);
    expect(estaVencido(comprobante({ fecha: "2026-10-09", vencimiento: undefined }), HOY)).toBe(false);
  });

  it("no vence si está saldado (o saldo ≤ 0,009), anulado o no es de deuda", () => {
    const base = { vencimiento: "2026-09-01" };
    expect(estaVencido(comprobante({ ...base, saldoPendiente: 0 }), HOY)).toBe(false);
    expect(estaVencido(comprobante({ ...base, saldoPendiente: 0.009 }), HOY)).toBe(false);
    expect(estaVencido(comprobante({ ...base, saldoPendiente: 0.01 }), HOY)).toBe(true);
    expect(estaVencido(comprobante({ ...base, estado: "ANULADO" }), HOY)).toBe(false);
    expect(estaVencido(comprobante({ ...base, tipo: "NOTA_CREDITO", saldoPendiente: 500 }), HOY)).toBe(false);
    expect(estaVencido(comprobante({ ...base, tipo: "SALDO_A_FAVOR", saldoPendiente: 500 }), HOY)).toBe(false);
  });

  it("notas de débito y saldos iniciales también vencen", () => {
    expect(estaVencido(comprobante({ tipo: "NOTA_DEBITO", vencimiento: "2026-10-01" }), HOY)).toBe(true);
    expect(estaVencido(comprobante({ tipo: "SALDO_INICIAL", vencimiento: "2026-10-01" }), HOY)).toBe(true);
  });
});

describe("diasAtraso", () => {
  it("cuenta días calendario desde el vencimiento", () => {
    expect(diasAtraso(comprobante({ vencimiento: "2026-10-08" }), HOY)).toBe(1);
    expect(diasAtraso(comprobante({ vencimiento: "2026-09-09" }), HOY)).toBe(30);
    expect(diasAtraso(comprobante({ vencimiento: "2025-10-09" }), HOY)).toBe(365);
  });

  it("0 si todavía no venció o vence hoy", () => {
    expect(diasAtraso(comprobante({ vencimiento: "2026-10-09" }), HOY)).toBe(0);
    expect(diasAtraso(comprobante({ vencimiento: "2026-11-09" }), HOY)).toBe(0);
  });

  it("sin vencimiento cuenta desde la emisión", () => {
    expect(diasAtraso(comprobante({ fecha: "2026-09-29", vencimiento: undefined }), HOY)).toBe(10);
  });

  it("OJO: no mira saldo ni estado: un comprobante pagado o anulado igual devuelve días de atraso", () => {
    expect(diasAtraso(comprobante({ vencimiento: "2026-09-29", saldoPendiente: 0, estado: "PAGADO" }), HOY)).toBe(10);
    expect(diasAtraso(comprobante({ vencimiento: "2026-09-29", estado: "ANULADO" }), HOY)).toBe(10);
  });
});

describe("antiguedadDeuda", () => {
  it("reparte el saldo por días desde la emisión con bordes 30/60/90 inclusivos", () => {
    const cs = [
      comprobante({ fecha: "2026-10-09", saldoPendiente: 1 }), // 0 días
      comprobante({ fecha: "2026-09-09", saldoPendiente: 10 }), // 30 días → 0-30
      comprobante({ fecha: "2026-09-08", saldoPendiente: 100 }), // 31 días → 31-60
      comprobante({ fecha: "2026-08-10", saldoPendiente: 1000 }), // 60 días → 31-60
      comprobante({ fecha: "2026-08-09", saldoPendiente: 10000 }), // 61 días → 61-90
      comprobante({ fecha: "2026-07-11", saldoPendiente: 100000 }), // 90 días → 61-90
      comprobante({ fecha: "2026-07-10", saldoPendiente: 1000000 }), // 91 días → +90
    ];
    expect(antiguedadDeuda(cs, HOY)).toEqual({ "0-30": 11, "31-60": 1100, "61-90": 110000, "+90": 1000000 });
  });

  it("usa la fecha de emisión, no el vencimiento", () => {
    const cs = [comprobante({ fecha: "2026-10-05", vencimiento: "2026-06-01", saldoPendiente: 500 })];
    expect(antiguedadDeuda(cs, HOY)).toEqual({ "0-30": 500, "31-60": 0, "61-90": 0, "+90": 0 });
  });

  it("ignora anulados, saldados, saldos negativos y comprobantes que no son de deuda", () => {
    const cs = [
      comprobante({ fecha: "2026-10-01", estado: "ANULADO" }),
      comprobante({ fecha: "2026-10-01", saldoPendiente: 0, estado: "PAGADO" }),
      comprobante({ fecha: "2026-10-01", saldoPendiente: -50 }),
      comprobante({ fecha: "2026-10-01", tipo: "NOTA_CREDITO", saldoPendiente: 300 }),
      comprobante({ fecha: "2026-10-01", tipo: "SALDO_A_FAVOR", saldoPendiente: 300 }),
      comprobante({ fecha: "2026-10-01", tipo: "NOTA_DEBITO", saldoPendiente: 40 }),
      comprobante({ fecha: "2026-01-01", tipo: "SALDO_INICIAL", saldoPendiente: 60 }),
    ];
    expect(antiguedadDeuda(cs, HOY)).toEqual({ "0-30": 40, "31-60": 0, "61-90": 0, "+90": 60 });
  });

  it("sin comprobantes todo en 0", () => {
    expect(antiguedadDeuda([], HOY)).toEqual({ "0-30": 0, "31-60": 0, "61-90": 0, "+90": 0 });
  });

  it("OJO: un comprobante con fecha futura (días negativos) cae en 0-30", () => {
    expect(antiguedadDeuda([comprobante({ fecha: "2026-12-01", saldoPendiente: 7 })], HOY)["0-30"]).toBe(7);
  });
});

describe("disponibleCredito", () => {
  it("límite − saldo", () => {
    expect(disponibleCredito({ limiteCredito: 1_000_000 }, 250_000)).toBe(750_000);
    expect(disponibleCredito({ limiteCredito: 1_000_000 }, 0)).toBe(1_000_000);
    expect(disponibleCredito({ limiteCredito: 1_000_000 }, 1_000_000)).toBe(0);
  });

  it("saldo a favor (negativo) aumenta el disponible", () => {
    expect(disponibleCredito({ limiteCredito: 1000 }, -500)).toBe(1500);
  });

  it("OJO: el comentario dice 'nunca menor a 0' pero devuelve negativo cuando se pasó del límite (el piso queda en la UI)", () => {
    expect(disponibleCredito({ limiteCredito: 1000 }, 1500)).toBe(-500);
    expect(disponibleCredito({ limiteCredito: 0 }, 200)).toBe(-200);
  });
});

describe("estadoPorSaldo", () => {
  it.each<[number, number, "PENDIENTE" | "PARCIAL" | "PAGADO"]>([
    [1000, 1000, "PENDIENTE"],
    [1000, 999.995, "PENDIENTE"], // dentro de la tolerancia de 0,009
    [1000, 999.99, "PARCIAL"],
    [1000, 500, "PARCIAL"],
    [1000, 0.01, "PARCIAL"],
    [1000, 0.009, "PAGADO"],
    [1000, 0, "PAGADO"],
    [1000, -50, "PAGADO"],
    [1000, 1200, "PENDIENTE"], // saldo mayor al total (p. ej. intereses) sigue pendiente
  ])("total %d, saldo %d → %s", (total, saldo, esperado) => {
    expect(estadoPorSaldo(total, saldo)).toBe(esperado);
  });
});

describe("imputarAutomaticamente", () => {
  const pendientes = [
    { id: "f-nueva", fecha: "2026-10-05", saldoPendiente: 300 },
    { id: "f-vieja", fecha: "2026-08-01", saldoPendiente: 1000 },
    { id: "f-media", fecha: "2026-09-15", saldoPendiente: 500 },
  ];

  it("imputa del más antiguo al más nuevo y deja remanente 0 si alcanza justo", () => {
    expect(imputarAutomaticamente(1800, pendientes)).toEqual({
      imputaciones: [
        { comprobanteId: "f-vieja", importe: 1000 },
        { comprobanteId: "f-media", importe: 500 },
        { comprobanteId: "f-nueva", importe: 300 },
      ],
      remanente: 0,
    });
  });

  it("pago parcial: completa los viejos y deja el último a medias", () => {
    expect(imputarAutomaticamente(1200, pendientes)).toEqual({
      imputaciones: [
        { comprobanteId: "f-vieja", importe: 1000 },
        { comprobanteId: "f-media", importe: 200 },
      ],
      remanente: 0,
    });
  });

  it("si sobra, devuelve el remanente", () => {
    const r = imputarAutomaticamente(2000, pendientes);
    expect(r.imputaciones).toHaveLength(3);
    expect(r.remanente).toBe(200);
  });

  it("importe 0 o negativo no imputa nada", () => {
    expect(imputarAutomaticamente(0, pendientes)).toEqual({ imputaciones: [], remanente: 0 });
    expect(imputarAutomaticamente(-100, pendientes)).toEqual({ imputaciones: [], remanente: -100 });
  });

  it("saltea comprobantes sin saldo o con saldo negativo", () => {
    const r = imputarAutomaticamente(100, [
      { id: "pagada", fecha: "2026-01-01", saldoPendiente: 0 },
      { id: "nc", fecha: "2026-01-02", saldoPendiente: -50 },
      { id: "debe", fecha: "2026-03-01", saldoPendiente: 80 },
    ]);
    expect(r).toEqual({ imputaciones: [{ comprobanteId: "debe", importe: 80 }], remanente: 20 });
  });

  it("redondea a centavos sin arrastrar error de coma flotante", () => {
    const r = imputarAutomaticamente(0.3, [
      { id: "a", fecha: "2026-01-01", saldoPendiente: 0.1 },
      { id: "b", fecha: "2026-01-02", saldoPendiente: 0.2 },
    ]);
    expect(r).toEqual({
      imputaciones: [
        { comprobanteId: "a", importe: 0.1 },
        { comprobanteId: "b", importe: 0.2 },
      ],
      remanente: 0,
    });
    expect(imputarAutomaticamente(100.005, [{ id: "a", fecha: "2026-01-01", saldoPendiente: 1000 }]).imputaciones[0].importe).toBe(100.01);
  });

  it("no muta la lista recibida y a igual fecha respeta el orden original", () => {
    const lista = [
      { id: "x", fecha: "2026-05-01", saldoPendiente: 10 },
      { id: "y", fecha: "2026-05-01", saldoPendiente: 10 },
      { id: "z", fecha: "2026-04-01", saldoPendiente: 10 },
    ];
    const copia = structuredClone(lista);
    const r = imputarAutomaticamente(30, lista);
    expect(r.imputaciones.map((i) => i.comprobanteId)).toEqual(["z", "x", "y"]);
    expect(lista).toEqual(copia);
  });

  it("sin pendientes todo el importe queda de remanente", () => {
    expect(imputarAutomaticamente(1234.56, [])).toEqual({ imputaciones: [], remanente: 1234.56 });
  });
});
