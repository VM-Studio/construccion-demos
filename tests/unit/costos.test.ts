import { describe, expect, it } from "vitest";
import { recalcularCostoPromedio, valorizarInventario, variacionCosto } from "@/domain/costos";
import { producto, stock } from "./fixtures";

describe("recalcularCostoPromedio", () => {
  it("pondera stock actual e ingreso", () => {
    // (100 × 50 + 50 × 80) / 150 = 9000 / 150 = 60
    expect(recalcularCostoPromedio(100, 50, 50, 80)).toBe(60);
  });

  it("redondea a centavos", () => {
    // (1 × 10 + 2 × 11) / 3 = 32 / 3 = 10,666… → 10,67
    expect(recalcularCostoPromedio(1, 10, 2, 11)).toBe(10.67);
  });

  it("sin stock previo toma el costo del ingreso (redondeado)", () => {
    expect(recalcularCostoPromedio(0, 50, 10, 72.345)).toBe(72.35);
  });

  it("con stock negativo también toma el costo del ingreso", () => {
    expect(recalcularCostoPromedio(-5, 50, 10, 80)).toBe(80);
  });

  it("ingreso de cantidad 0 o negativa deja el costo como estaba (sin redondear)", () => {
    expect(recalcularCostoPromedio(100, 50.123, 0, 80)).toBe(50.123);
    expect(recalcularCostoPromedio(100, 50, -3, 80)).toBe(50);
  });

  it("ingreso al mismo costo no cambia el promedio", () => {
    expect(recalcularCostoPromedio(37, 12.5, 13, 12.5)).toBe(12.5);
  });

  // OJO: el promedio se redondea a 2 decimales, pero la regla del proyecto guarda costos
  // unitarios con 4 decimales (14,4). En artículos de costo unitario chico se pierde precisión:
  // (1 × 0,1234 + 1 × 0,1235) / 2 = 0,12345 → queda 0,12.
  it("costos unitarios chicos pierden precisión por el redondeo a 2 decimales", () => {
    expect(recalcularCostoPromedio(1, 0.1234, 1, 0.1235)).toBe(0.12);
  });
});

describe("valorizarInventario", () => {
  const productos = [
    producto("p1", { costoUltimo: 100, costoPromedio: 90 }),
    producto("p2", { costoUltimo: 2.5, costoPromedio: 2 }),
  ];
  const existencias = [stock("p1", "dep_1", 10), stock("p1", "dep_2", 5), stock("p2", "dep_1", 3), stock("p2", "dep_2", 0), stock("p2", "dep_3", -4), stock("pX", "dep_1", 50)];

  it("ULTIMO usa el costo último", () => {
    const r = valorizarInventario(existencias, productos, "ULTIMO");
    // 10×100 + 5×100 + 3×2,5 = 1507,5
    expect(r.total).toBe(1507.5);
    expect(r.lineas).toEqual([
      { productoId: "p1", depositoId: "dep_1", cantidad: 10, costoUnitario: 100, valor: 1000 },
      { productoId: "p1", depositoId: "dep_2", cantidad: 5, costoUnitario: 100, valor: 500 },
      { productoId: "p2", depositoId: "dep_1", cantidad: 3, costoUnitario: 2.5, valor: 7.5 },
    ]);
  });

  it("PROMEDIO usa el costo promedio", () => {
    // 15×90 + 3×2 = 1356
    expect(valorizarInventario(existencias, productos, "PROMEDIO").total).toBe(1356);
  });

  it("saltea cantidades ≤ 0 y productos inexistentes", () => {
    const r = valorizarInventario(existencias, productos, "PROMEDIO");
    expect(r.lineas.every((l) => l.cantidad > 0)).toBe(true);
    expect(r.lineas.some((l) => l.productoId === "pX")).toBe(false);
  });

  it("redondea el total a centavos (las líneas no)", () => {
    const r = valorizarInventario([stock("p1", "dep_1", 3)], [producto("p1", { costoUltimo: 0.3333 })], "ULTIMO");
    expect(r.total).toBe(1);
    expect(r.lineas[0].valor).toBeCloseTo(0.9999, 10);
  });

  it("sin stock da total 0 y sin líneas", () => {
    expect(valorizarInventario([], productos, "ULTIMO")).toEqual({ total: 0, lineas: [] });
  });
});

describe("variacionCosto", () => {
  it("devuelve la variación como fracción", () => {
    expect(variacionCosto(100, 105)).toBeCloseTo(0.05, 10);
    expect(variacionCosto(200, 150)).toBe(-0.25);
  });

  it("sin cambio da 0", () => {
    expect(variacionCosto(80, 80)).toBe(0);
  });

  it("con costo anterior 0 devuelve 0 (no divide por cero)", () => {
    expect(variacionCosto(0, 50)).toBe(0);
  });
});
