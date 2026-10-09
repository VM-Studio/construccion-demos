import { describe, expect, it } from "vitest";
import {
  calcularRentabilidadACostoActual,
  calcularRentabilidadItem,
  calcularRentabilidadPedido,
  calcularTotales,
  diasCondicionPago,
  importeLinea,
  letraFacturaPara,
  porcentajeEntregado,
} from "@/domain/ventas";
import { itemNP } from "./fixtures";

describe("importeLinea", () => {
  it("cantidad × precio sin descuento", () => {
    expect(importeLinea({ cantidad: 3, precioUnitario: 150 })).toBe(450);
  });

  it("aplica el descuento de línea", () => {
    expect(importeLinea({ cantidad: 4, precioUnitario: 250, descuentoPct: 10 })).toBe(900);
  });

  it("descuento 0 o ausente es lo mismo", () => {
    expect(importeLinea({ cantidad: 2, precioUnitario: 10, descuentoPct: 0 })).toBe(20);
  });

  it("descuento del 100 % da 0", () => {
    expect(importeLinea({ cantidad: 2, precioUnitario: 10, descuentoPct: 100 })).toBe(0);
  });

  it("cantidad 0 da 0", () => {
    expect(importeLinea({ cantidad: 0, precioUnitario: 999, descuentoPct: 5 })).toBe(0);
  });

  it("cantidades fraccionarias (m³)", () => {
    expect(importeLinea({ cantidad: 2.5, precioUnitario: 1000 })).toBe(2500);
  });
});

describe("calcularTotales", () => {
  it("subtotal → descuento general → neto → IVA → total", () => {
    const items = [
      { cantidad: 10, precioUnitario: 100 }, // 1000
      { cantidad: 2, precioUnitario: 500, descuentoPct: 10 }, // 900
    ];
    // subtotal 1900; desc 5 % = 95; neto 1805; IVA 21 % = 379,05; total 2184,05
    expect(calcularTotales(items, 5, 21)).toEqual({ subtotal: 1900, descuento: 95, neto: 1805, iva: 379.05, total: 2184.05 });
  });

  it("sin descuento general e IVA 10,5 %", () => {
    // 3 × 333,33 = 999,99; IVA 104,99895 → 105; total 1104,98895 → 1104,99
    expect(calcularTotales([{ cantidad: 3, precioUnitario: 333.33 }], 0, 10.5)).toEqual({ subtotal: 999.99, descuento: 0, neto: 999.99, iva: 105, total: 1104.99 });
  });

  it("IVA 0 (circuito interno)", () => {
    expect(calcularTotales([{ cantidad: 1, precioUnitario: 1234.5 }], 0, 0)).toEqual({ subtotal: 1234.5, descuento: 0, neto: 1234.5, iva: 0, total: 1234.5 });
  });

  it("sin ítems todo en 0", () => {
    expect(calcularTotales([], 10, 21)).toEqual({ subtotal: 0, descuento: 0, neto: 0, iva: 0, total: 0 });
  });

  it("redondea cada total a centavos", () => {
    // 1 × 0,125 → subtotal 0,13; IVA 21 % = 0,02625 → 0,03; total 0,15125 → 0,15
    expect(calcularTotales([{ cantidad: 1, precioUnitario: 0.125 }], 0, 21)).toEqual({ subtotal: 0.13, descuento: 0, neto: 0.13, iva: 0.03, total: 0.15 });
  });

  it("el total sale del neto sin redondear (no de la suma de los redondeados)", () => {
    // neto 0,125 + IVA 0,02625 = 0,15125 → 0,15, aunque 0,13 + 0,03 = 0,16
    const t = calcularTotales([{ cantidad: 1, precioUnitario: 0.125 }], 0, 21);
    expect(t.total).not.toBe(t.neto + t.iva);
  });
});

describe("calcularRentabilidadItem", () => {
  it("usa el costo snapshot", () => {
    const r = calcularRentabilidadItem({ cantidad: 10, precioUnitario: 150, costoUnitarioSnapshot: 100 });
    expect(r).toEqual({ ingreso: 1500, costo: 1000, margenBruto: 500, margenPct: 500 / 1500 });
  });

  it("aplica descuento de línea y descuento general sobre el ingreso", () => {
    // 10 × 200 = 2000; −10 % = 1800; −5 % = 1710; costo 10 × 120 = 1200; margen 510
    const r = calcularRentabilidadItem({ cantidad: 10, precioUnitario: 200, costoUnitarioSnapshot: 120, descuentoPct: 10 }, 5);
    expect(r.ingreso).toBe(1710);
    expect(r.costo).toBe(1200);
    expect(r.margenBruto).toBe(510);
    expect(r.margenPct).toBeCloseTo(510 / 1710, 10);
  });

  it("con costo explícito ignora el snapshot", () => {
    const r = calcularRentabilidadItem({ cantidad: 10, precioUnitario: 150, costoUnitarioSnapshot: 100 }, 0, 130);
    expect(r).toMatchObject({ costo: 1300, margenBruto: 200 });
  });

  it("costo explícito 0 se respeta (no cae al snapshot)", () => {
    const r = calcularRentabilidadItem({ cantidad: 2, precioUnitario: 50, costoUnitarioSnapshot: 40 }, 0, 0);
    expect(r).toMatchObject({ costo: 0, margenBruto: 100, margenPct: 1 });
  });

  it("margen negativo si se vende bajo costo", () => {
    const r = calcularRentabilidadItem({ cantidad: 1, precioUnitario: 80, costoUnitarioSnapshot: 100 });
    expect(r).toMatchObject({ margenBruto: -20, margenPct: -0.25 });
  });

  it("ingreso 0 deja margenPct en 0", () => {
    const r = calcularRentabilidadItem({ cantidad: 0, precioUnitario: 80, costoUnitarioSnapshot: 100 });
    expect(r).toEqual({ ingreso: 0, costo: 0, margenBruto: 0, margenPct: 0 });
  });
});

describe("calcularRentabilidadPedido", () => {
  const pedido = {
    descuentoPct: 10,
    items: [
      itemNP("i1", "p1", 10, { precioUnitario: 100, costoUnitarioSnapshot: 60 }), // ingreso 900, costo 600
      itemNP("i2", "p2", 5, { precioUnitario: 200, costoUnitarioSnapshot: 150, descuentoPct: 20 }), // 1000 × 0,8 × 0,9 = 720, costo 750
    ],
  };

  it("suma ingreso y costo snapshot de todas las líneas", () => {
    const r = calcularRentabilidadPedido(pedido);
    expect(r.ingreso).toBe(1620);
    expect(r.costo).toBe(1350);
    expect(r.margenBruto).toBe(270);
    expect(r.margenPct).toBeCloseTo(270 / 1620, 10);
  });

  it("pedido sin ítems da todo 0", () => {
    expect(calcularRentabilidadPedido({ items: [], descuentoPct: 0 })).toEqual({ ingreso: 0, costo: 0, margenBruto: 0, margenPct: 0 });
  });
});

describe("calcularRentabilidadACostoActual", () => {
  const pedido = {
    descuentoPct: 0,
    items: [
      itemNP("i1", "p1", 10, { precioUnitario: 100, costoUnitarioSnapshot: 60 }),
      itemNP("i2", "p2", 5, { precioUnitario: 200, costoUnitarioSnapshot: 150 }),
    ],
  };

  it("usa el costo actual en vez del snapshot", () => {
    const actual: Record<string, number> = { p1: 80, p2: 190 };
    const r = calcularRentabilidadACostoActual(pedido, (id) => actual[id]);
    // ingreso 1000 + 1000; costo 800 + 950
    expect(r).toMatchObject({ ingreso: 2000, costo: 1750, margenBruto: 250 });
    expect(r.margenPct).toBeCloseTo(0.125, 10);
  });

  it("difiere de la rentabilidad con snapshot cuando subió el costo", () => {
    const snap = calcularRentabilidadPedido(pedido);
    const hoy = calcularRentabilidadACostoActual(pedido, () => 120);
    expect(snap.margenBruto).toBe(2000 - 600 - 750);
    expect(hoy.margenBruto).toBe(2000 - 1200 - 600);
    expect(hoy.margenBruto).toBeLessThan(snap.margenBruto);
  });
});

describe("letraFacturaPara", () => {
  it("responsable inscripto lleva A", () => {
    expect(letraFacturaPara("RI")).toBe("A");
  });

  it("monotributo, exento y consumidor final llevan B", () => {
    expect(letraFacturaPara("MONOTRIBUTO")).toBe("B");
    expect(letraFacturaPara("EXENTO")).toBe("B");
    expect(letraFacturaPara("CF")).toBe("B");
  });
});

describe("diasCondicionPago", () => {
  it("días por condición", () => {
    expect(diasCondicionPago("CONTADO")).toBe(0);
    expect(diasCondicionPago("ANTICIPO")).toBe(0);
    expect(diasCondicionPago("CTA_CTE_15")).toBe(15);
    expect(diasCondicionPago("CTA_CTE_30")).toBe(30);
    expect(diasCondicionPago("CTA_CTE_60")).toBe(60);
  });

  it("condición desconocida da 0", () => {
    expect(diasCondicionPago("CTA_CTE_90")).toBe(0);
    expect(diasCondicionPago("")).toBe(0);
  });

  // OJO: la búsqueda es sobre un objeto literal, así que claves heredadas de Object.prototype
  // ("toString", "constructor"…) devuelven una función en lugar de un número.
  it("claves heredadas del prototipo no devuelven número", () => {
    expect(typeof diasCondicionPago("toString")).toBe("function");
  });
});

describe("porcentajeEntregado", () => {
  it("entregados / cantidad", () => {
    const np = { items: [itemNP("i1", "p1", 10, { entregados: 4 }), itemNP("i2", "p2", 10, { entregados: 6 })] };
    expect(porcentajeEntregado(np)).toBe(0.5);
  });

  it("descuenta devoluciones del total", () => {
    // total 10 − 2 = 8; entregados 4 → 0,5
    expect(porcentajeEntregado({ items: [itemNP("i1", "p1", 10, { entregados: 4, devueltos: 2 })] })).toBe(0.5);
  });

  it("todo devuelto sin entregas cuenta como 100 %", () => {
    expect(porcentajeEntregado({ items: [itemNP("i1", "p1", 5, { devueltos: 5 })] })).toBe(1);
  });

  it("lo entregado de más por línea se topea en la cantidad", () => {
    // línea 1: min(10, 15) = 10; línea 2: 0 → 10 / 20
    const np = { items: [itemNP("i1", "p1", 10, { entregados: 15 }), itemNP("i2", "p2", 10)] };
    expect(porcentajeEntregado(np)).toBe(0.5);
  });

  it("nunca supera 1", () => {
    expect(porcentajeEntregado({ items: [itemNP("i1", "p1", 10, { entregados: 10, devueltos: 3 })] })).toBe(1);
  });

  it("sin ítems o con cantidad 0 da 1", () => {
    expect(porcentajeEntregado({ items: [] })).toBe(1);
    expect(porcentajeEntregado({ items: [itemNP("i1", "p1", 0)] })).toBe(1);
  });

  it("nada entregado da 0", () => {
    expect(porcentajeEntregado({ items: [itemNP("i1", "p1", 7)] })).toBe(0);
  });
});
