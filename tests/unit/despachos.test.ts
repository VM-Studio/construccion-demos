import { describe, expect, it } from "vitest";
import { despachoAbierto, minutosEspera, minutosPreparacion, minutosTotal, nivelTiempo, promedio } from "@/domain/despachos";
import type { EstadoDespacho } from "@/domain/types";

const ESPERA = "2026-10-09T10:00:00.000Z";
const INICIO = "2026-10-09T10:20:00.000Z"; // +20 min
const FIN = "2026-10-09T11:05:00.000Z"; // +45 min de preparación, 65 total
const AHORA = new Date("2026-10-09T11:30:00.000Z"); // 90 min desde la espera

describe("minutosEspera", () => {
  it("espera → inicio de preparación", () => {
    expect(minutosEspera({ estado: "PREPARACION", fechaEspera: ESPERA, fechaInicioPreparacion: INICIO }, AHORA)).toBe(20);
    expect(minutosEspera({ estado: "FINALIZADO", fechaEspera: ESPERA, fechaInicioPreparacion: INICIO }, AHORA)).toBe(20);
  });

  it("sigue en espera: cuenta hasta ahora", () => {
    expect(minutosEspera({ estado: "ESPERA", fechaEspera: ESPERA }, AHORA)).toBe(90);
  });

  it("cancelado sin preparación → null; cancelado con preparación mide igual", () => {
    expect(minutosEspera({ estado: "CANCELADO", fechaEspera: ESPERA }, AHORA)).toBeNull();
    expect(minutosEspera({ estado: "CANCELADO", fechaEspera: ESPERA, fechaInicioPreparacion: INICIO }, AHORA)).toBe(20);
  });

  it("redondea al minuto y nunca da negativo", () => {
    expect(minutosEspera({ estado: "PREPARACION", fechaEspera: ESPERA, fechaInicioPreparacion: "2026-10-09T10:01:29.000Z" }, AHORA)).toBe(1);
    expect(minutosEspera({ estado: "PREPARACION", fechaEspera: ESPERA, fechaInicioPreparacion: "2026-10-09T10:01:30.000Z" }, AHORA)).toBe(2);
    expect(minutosEspera({ estado: "ESPERA", fechaEspera: ESPERA }, new Date("2026-10-09T09:00:00.000Z"))).toBe(0);
  });
});

describe("minutosPreparacion", () => {
  it("inicio → fin", () => {
    expect(minutosPreparacion({ estado: "FINALIZADO", fechaInicioPreparacion: INICIO, fechaFin: FIN }, AHORA)).toBe(45);
    expect(minutosPreparacion({ estado: "ENTREGADO", fechaInicioPreparacion: INICIO, fechaFin: FIN }, AHORA)).toBe(45);
  });

  it("en preparación sin fin: hasta ahora", () => {
    expect(minutosPreparacion({ estado: "PREPARACION", fechaInicioPreparacion: INICIO }, AHORA)).toBe(70);
  });

  it("sin inicio → null", () => {
    expect(minutosPreparacion({ estado: "ESPERA" }, AHORA)).toBeNull();
    expect(minutosPreparacion({ estado: "PREPARACION" }, AHORA)).toBeNull();
  });

  it("con inicio, sin fin y fuera de PREPARACION → null", () => {
    expect(minutosPreparacion({ estado: "CANCELADO", fechaInicioPreparacion: INICIO }, AHORA)).toBeNull();
    expect(minutosPreparacion({ estado: "FINALIZADO", fechaInicioPreparacion: INICIO }, AHORA)).toBeNull();
  });

  it("fin anterior al inicio → 0", () => {
    expect(minutosPreparacion({ estado: "FINALIZADO", fechaInicioPreparacion: INICIO, fechaFin: ESPERA }, AHORA)).toBe(0);
  });
});

describe("minutosTotal", () => {
  it("espera → fin", () => {
    expect(minutosTotal({ estado: "FINALIZADO", fechaEspera: ESPERA, fechaFin: FIN }, AHORA)).toBe(65);
  });

  it("abierto: hasta ahora", () => {
    expect(minutosTotal({ estado: "ESPERA", fechaEspera: ESPERA }, AHORA)).toBe(90);
    expect(minutosTotal({ estado: "PREPARACION", fechaEspera: ESPERA }, AHORA)).toBe(90);
  });

  it("cancelado → null aunque tenga fin", () => {
    expect(minutosTotal({ estado: "CANCELADO", fechaEspera: ESPERA, fechaFin: FIN }, AHORA)).toBeNull();
  });

  it("OJO: FINALIZADO/EN_VIAJE sin fechaFin sigue contando hasta ahora", () => {
    expect(minutosTotal({ estado: "FINALIZADO", fechaEspera: ESPERA }, AHORA)).toBe(90);
    expect(minutosTotal({ estado: "EN_VIAJE", fechaEspera: ESPERA }, AHORA)).toBe(90);
  });

  it("acepta `ahora` por defecto (fecha real) sin romper", () => {
    expect(minutosTotal({ estado: "ESPERA", fechaEspera: ESPERA })).toBeGreaterThanOrEqual(0);
  });
});

describe("nivelTiempo", () => {
  it.each<[number | null, "ok" | "alto" | "critico"]>([
    [null, "ok"],
    [0, "ok"],
    [45, "ok"],
    [46, "alto"],
    [90, "alto"],
    [91, "critico"],
    [600, "critico"],
  ])("%s min → %s", (m, esperado) => {
    expect(nivelTiempo(m)).toBe(esperado);
  });
});

describe("despachoAbierto", () => {
  it.each<[EstadoDespacho, boolean]>([
    ["ESPERA", true],
    ["PREPARACION", true],
    ["FINALIZADO", false],
    ["EN_VIAJE", false],
    ["ENTREGADO", false],
    ["CANCELADO", false],
  ])("%s → %s", (estado, esperado) => {
    expect(despachoAbierto({ estado })).toBe(esperado);
  });
});

describe("promedio", () => {
  it("ignora null y redondea", () => {
    expect(promedio([10, null, 21])).toBe(16); // 15,5 → 16
    expect(promedio([10, 20, 30])).toBe(20);
    expect(promedio([1, 2])).toBe(2); // 1,5 → 2
    expect(promedio([0])).toBe(0);
  });

  it("sin valores → null", () => {
    expect(promedio([])).toBeNull();
    expect(promedio([null, null])).toBeNull();
  });
});
