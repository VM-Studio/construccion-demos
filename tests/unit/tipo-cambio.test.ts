import { describe, expect, it } from "vitest";
import {
  enArgentina,
  esHabil,
  estaDesactualizada,
  habilAnterior,
  hoyAR,
  parsearFechaBNA,
  parsearNumero,
  valorManual,
} from "@/domain/tipoCambio";

// Octubre 2026: jueves 8, viernes 9, sábado 10, domingo 11, lunes 12.

describe("parsearNumero", () => {
  it.each<[string, number]>([
    ["1.450,00", 1450], // billetes es-AR
    ["1506.5000", 1506.5], // divisas con punto decimal
    ["1.450", 1450], // daría 1,45: absurdo para un dólar → miles
    ["1450", 1450],
    ["1450,5", 1450.5],
    ["1,5", 1.5],
    ["1.234.567,89", 1234567.89],
    ["1.506.500", 1506500], // más de un punto → todos miles
    ["$ 1.450,00", 1450],
    ["USD 1506.50 ", 1506.5],
    ["  1.450,00\n", 1450],
    ["12.345", 12345], // 12,345 < 50 → miles
    ["49.999", 49999],
    ["0.5", 0.5], // no tiene 3 decimales → decimal
    ["-1.450,00", -1450],
  ])("%j → %d", (txt, esperado) => {
    expect(parsearNumero(txt)).toBe(esperado);
  });

  it.each(["", "   ", "abc", "$", "N/D"])("%j → NaN", (txt) => {
    expect(parsearNumero(txt)).toBeNaN();
  });

  it("solo un signo menos → NaN", () => {
    expect(parsearNumero("-")).toBeNaN();
  });

  it("OJO: '50.000' sin coma se lee como 50 (el umbral de miles es < 50)", () => {
    expect(parsearNumero("50.000")).toBe(50);
    expect(parsearNumero("999.000")).toBe(999);
  });
});

describe("parsearFechaBNA", () => {
  it.each<[string, string]>([
    ["8/10/2026", "2026-10-08"],
    ["08/10/2026", "2026-10-08"],
    ["1/1/2026", "2026-01-01"],
    ["31/12/2025", "2025-12-31"],
    ["  9/10/2026  ", "2026-10-09"],
    ["29/2/2028", "2028-02-29"],
  ])("%j → %s", (txt, esperado) => {
    expect(parsearFechaBNA(txt)).toBe(esperado);
  });

  it.each(["", "2026-10-08", "8-10-2026", "8/10/26", "Fecha: 8/10/2026", "8/10/2026 10:00", "123/10/2026", "32/10/2026", "8/13/2026"])(
    "%j → null",
    (txt) => {
      expect(parsearFechaBNA(txt)).toBeNull();
    },
  );

  it("OJO: acepta días inexistentes del mes (31/02, 29/02 en año no bisiesto) porque Date.parse no los rechaza", () => {
    expect(parsearFechaBNA("31/2/2026")).toBe("2026-02-31");
    expect(parsearFechaBNA("29/2/2026")).toBe("2026-02-29");
  });
});

describe("esHabil", () => {
  it.each<[string, boolean]>([
    ["2026-10-05", true], // lunes
    ["2026-10-06", true],
    ["2026-10-07", true],
    ["2026-10-08", true],
    ["2026-10-09", true], // viernes
    ["2026-10-10", false], // sábado
    ["2026-10-11", false], // domingo
    ["2026-12-25", true], // feriado (Navidad, viernes): no se contemplan feriados
  ])("%s → %s", (ymd, esperado) => {
    expect(esHabil(ymd)).toBe(esperado);
  });
});

describe("habilAnterior", () => {
  it.each<[string, string]>([
    ["2026-10-09", "2026-10-08"], // viernes → jueves
    ["2026-10-12", "2026-10-09"], // lunes → viernes previo
    ["2026-10-10", "2026-10-09"], // sábado → viernes
    ["2026-10-11", "2026-10-09"], // domingo → viernes
    ["2026-10-13", "2026-10-12"], // martes → lunes
    ["2026-06-01", "2026-05-29"], // lunes que cruza de mes
    ["2026-01-01", "2025-12-31"], // jueves que cruza de año
    ["2024-03-01", "2024-02-29"], // viernes en bisiesto
  ])("%s → %s", (ymd, esperado) => {
    expect(habilAnterior(ymd)).toBe(esperado);
  });
});

describe("hoyAR / enArgentina", () => {
  it.each<[string, string]>([
    ["2026-10-09T02:00:00Z", "2026-10-08"], // 23:00 del 8 en Argentina
    ["2026-10-09T02:59:59Z", "2026-10-08"],
    ["2026-10-09T03:00:00Z", "2026-10-09"], // medianoche en Argentina
    ["2026-10-09T23:59:00Z", "2026-10-09"],
    ["2026-01-01T01:00:00Z", "2025-12-31"], // cruza de año
  ])("%s → %s", (iso, esperado) => {
    expect(hoyAR(new Date(iso))).toBe(esperado);
  });

  it("enArgentina resta exactamente 3 horas", () => {
    expect(enArgentina(new Date("2026-10-09T12:00:00Z")).toISOString()).toBe("2026-10-09T09:00:00.000Z");
  });

  it("sin argumento usa la fecha actual (formato YYYY-MM-DD)", () => {
    expect(hoyAR()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("valorManual", () => {
  it("MANUAL con valor positivo → ese valor", () => {
    expect(valorManual({ tipoCambioModo: "MANUAL", tipoCambioManual: 1450 })).toBe(1450);
    expect(valorManual({ tipoCambioModo: "MANUAL", tipoCambioManual: 0.01 })).toBe(0.01);
  });

  it("MANUAL sin valor, en 0 o negativo → null (se usa la cotización)", () => {
    expect(valorManual({ tipoCambioModo: "MANUAL" })).toBeNull();
    expect(valorManual({ tipoCambioModo: "MANUAL", tipoCambioManual: 0 })).toBeNull();
    expect(valorManual({ tipoCambioModo: "MANUAL", tipoCambioManual: -10 })).toBeNull();
  });

  it("AUTO o sin modo → null aunque haya valor manual guardado", () => {
    expect(valorManual({ tipoCambioModo: "AUTO", tipoCambioManual: 1450 })).toBeNull();
    expect(valorManual({ tipoCambioManual: 1450 })).toBeNull();
    expect(valorManual({})).toBeNull();
  });
});

describe("estaDesactualizada", () => {
  it("día hábil: vale la cotización de ayer hábil o más nueva", () => {
    expect(estaDesactualizada("2026-10-08", "2026-10-09", false)).toBe(false);
    expect(estaDesactualizada("2026-10-09", "2026-10-09", false)).toBe(false);
    expect(estaDesactualizada("2026-10-07", "2026-10-09", false)).toBe(true);
  });

  it("lunes: alcanza con la del viernes", () => {
    expect(estaDesactualizada("2026-10-09", "2026-10-12", false)).toBe(false);
    expect(estaDesactualizada("2026-10-08", "2026-10-12", false)).toBe(true);
  });

  it("fin de semana: alcanza con la del viernes", () => {
    expect(estaDesactualizada("2026-10-09", "2026-10-10", false)).toBe(false);
    expect(estaDesactualizada("2026-10-09", "2026-10-11", false)).toBe(false);
    expect(estaDesactualizada("2026-10-08", "2026-10-11", false)).toBe(true);
  });

  it("si falló el último intento siempre está desactualizada", () => {
    expect(estaDesactualizada("2026-10-09", "2026-10-09", true)).toBe(true);
    expect(estaDesactualizada("2026-10-09", "2026-10-11", true)).toBe(true);
  });
});
