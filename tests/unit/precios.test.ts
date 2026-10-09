import { describe, expect, it } from "vitest";
import {
  aplicarActualizacionMasiva,
  aplicarCambiosPrecio,
  calcularActualizacionMasiva,
  calcularPrecioDesdeMarkup,
  calcularPrecioDesdeUSD,
  costoEnDolares,
  costoEnPesos,
  markupEfectivo,
  obtenerPrecio,
  redondearPrecio,
} from "@/domain/precios";
import { precio, producto } from "./fixtures";

describe("redondearPrecio", () => {
  it("por defecto redondea a $10", () => {
    expect(redondearPrecio(1234)).toBe(1230);
    expect(redondearPrecio(1235)).toBe(1240);
    expect(redondearPrecio(1236)).toBe(1240);
  });

  it("a $1 redondea al entero más cercano", () => {
    expect(redondearPrecio(99.49, 1)).toBe(99);
    expect(redondearPrecio(99.5, 1)).toBe(100);
  });

  it("a $100", () => {
    expect(redondearPrecio(1249, 100)).toBe(1200);
    expect(redondearPrecio(1250, 100)).toBe(1300);
  });

  it("precios chicos pueden quedar en 0", () => {
    expect(redondearPrecio(4)).toBe(0);
    expect(redondearPrecio(0)).toBe(0);
  });
});

describe("calcularPrecioDesdeMarkup", () => {
  it("costo × (1 + markup) redondeado", () => {
    // 1000 × 1,28 = 1280
    expect(calcularPrecioDesdeMarkup(1000, 28)).toBe(1280);
    // 1234 × 1,45 = 1789,3 → 1790
    expect(calcularPrecioDesdeMarkup(1234, 45)).toBe(1790);
    // 1234 × 1,45 = 1789,3 → 1789 a $1, 1800 a $100
    expect(calcularPrecioDesdeMarkup(1234, 45, 1)).toBe(1789);
    expect(calcularPrecioDesdeMarkup(1234, 45, 100)).toBe(1800);
  });

  it("markup 0 devuelve el costo redondeado", () => {
    expect(calcularPrecioDesdeMarkup(997, 0)).toBe(1000);
  });

  it("costo 0 da precio 0", () => {
    expect(calcularPrecioDesdeMarkup(0, 45)).toBe(0);
  });
});

describe("markupEfectivo", () => {
  it("(precio − costo) / costo en base 100", () => {
    expect(markupEfectivo(1280, 1000)).toBeCloseTo(28, 10);
    expect(markupEfectivo(900, 1000)).toBeCloseTo(-10, 10);
  });

  it("costo 0 devuelve 0", () => {
    expect(markupEfectivo(500, 0)).toBe(0);
  });
});

describe("obtenerPrecio", () => {
  const precios = [precio("p1", "lst_may", 100), precio("p1", "lst_pub", 145), precio("p2", "lst_may", 50)];

  it("busca por producto y lista", () => {
    expect(obtenerPrecio("p1", "lst_pub", precios)).toBe(145);
    expect(obtenerPrecio("p2", "lst_may", precios)).toBe(50);
  });

  it("sin precio cargado devuelve 0", () => {
    expect(obtenerPrecio("p2", "lst_pub", precios)).toBe(0);
    expect(obtenerPrecio("p9", "lst_may", [])).toBe(0);
  });
});

describe("costoEnPesos y costoEnDolares", () => {
  it("convierte a pesos redondeando a centavos", () => {
    expect(costoEnPesos(10, 1050)).toBe(10500);
    // 1,234 × 1000,5 = 1234,617 → 1234,62
    expect(costoEnPesos(1.234, 1000.5)).toBe(1234.62);
    expect(costoEnPesos(0, 1000)).toBe(0);
  });

  it("solo es costo en dólares si la moneda es USD y hay costo positivo", () => {
    expect(costoEnDolares({ monedaCosto: "USD", costoUSD: 5 })).toBe(true);
    expect(costoEnDolares({ monedaCosto: "USD", costoUSD: 0 })).toBe(false);
    expect(costoEnDolares({ monedaCosto: "USD" })).toBe(false);
    expect(costoEnDolares({ monedaCosto: "ARS", costoUSD: 5 })).toBe(false);
    expect(costoEnDolares({})).toBe(false);
  });
});

describe("calcularPrecioDesdeUSD", () => {
  it("costo USD × tipo de cambio × (1 + markup)", () => {
    // 10 × 1000 × 1,28 = 12800
    expect(calcularPrecioDesdeUSD(10, 1000, 28)).toBe(12800);
    // 3,5 × 1012 × 1,22 = 4321,24 → 4320 a $10, 4321 a $1
    expect(calcularPrecioDesdeUSD(3.5, 1012, 22)).toBe(4320);
    expect(calcularPrecioDesdeUSD(3.5, 1012, 22, 1)).toBe(4321);
  });
});

describe("calcularActualizacionMasiva", () => {
  const productos = [
    producto("p1", { costoPromedio: 1000 }),
    producto("p2", { costoPromedio: 200, monedaCosto: "USD", costoUSD: 2 }),
  ];
  const precios = [precio("p1", "lst_may", 1220), precio("p1", "lst_pub", 1450), precio("p2", "lst_may", 250), precio("p2", "lst_pub", 300)];
  const filtro = { productoIds: ["p1", "p2"], listaIds: ["lst_may", "lst_pub"] };

  it("AUMENTAR aplica el % sobre el precio actual y redondea", () => {
    const c = calcularActualizacionMasiva(precios, productos, filtro, { tipo: "AUMENTAR", pct: 10 });
    // 1220 × 1,1 = 1342 → 1340; 1450 × 1,1 = 1595 → 1600; 250 × 1,1 = 275 → 280; 300 × 1,1 = 330
    expect(c).toEqual([
      { productoId: "p1", listaPreciosId: "lst_may", anterior: 1220, nuevo: 1340 },
      { productoId: "p1", listaPreciosId: "lst_pub", anterior: 1450, nuevo: 1600 },
      { productoId: "p2", listaPreciosId: "lst_may", anterior: 250, nuevo: 280 },
      { productoId: "p2", listaPreciosId: "lst_pub", anterior: 300, nuevo: 330 },
    ]);
  });

  it("DISMINUIR resta el %", () => {
    const c = calcularActualizacionMasiva(precios, productos, { productoIds: ["p1"], listaIds: ["lst_pub"] }, { tipo: "DISMINUIR", pct: 20 }, 1);
    // 1450 × 0,8 = 1160
    expect(c).toEqual([{ productoId: "p1", listaPreciosId: "lst_pub", anterior: 1450, nuevo: 1160 }]);
  });

  // OJO: no hay tope en DISMINUIR; un % mayor a 100 deja precios negativos.
  it("DISMINUIR más del 100 % deja el precio negativo", () => {
    const c = calcularActualizacionMasiva(precios, productos, { productoIds: ["p1"], listaIds: ["lst_may"] }, { tipo: "DISMINUIR", pct: 150 });
    // 1220 × (1 − 1,5) = −610
    expect(c[0].nuevo).toBe(-610);
  });

  it("MARKUP recalcula desde el costo promedio con el markup de cada lista", () => {
    const c = calcularActualizacionMasiva(precios, productos, filtro, { tipo: "MARKUP", markups: { lst_may: 22, lst_pub: 45 } });
    // p1: 1000 × 1,22 = 1220; 1000 × 1,45 = 1450. p2: 200 × 1,22 = 244 → 240; 200 × 1,45 = 290
    expect(c.map((x) => x.nuevo)).toEqual([1220, 1450, 240, 290]);
  });

  it("MARKUP sin markup para la lista usa 0 %", () => {
    const c = calcularActualizacionMasiva(precios, productos, { productoIds: ["p1"], listaIds: ["lst_may"] }, { tipo: "MARKUP", markups: {} });
    expect(c[0].nuevo).toBe(1000);
  });

  it("DESDE_USD solo toca artículos con costo en dólares", () => {
    const c = calcularActualizacionMasiva(precios, productos, filtro, { tipo: "DESDE_USD", markups: { lst_may: 22, lst_pub: 45 }, tipoCambio: 1000 });
    // p2: 2 × 1000 = 2000; × 1,22 = 2440; × 1,45 = 2900
    expect(c).toEqual([
      { productoId: "p2", listaPreciosId: "lst_may", anterior: 250, nuevo: 2440 },
      { productoId: "p2", listaPreciosId: "lst_pub", anterior: 300, nuevo: 2900 },
    ]);
  });

  it("ignora productos inexistentes y no muta la lista de entrada", () => {
    const copia = structuredClone(precios);
    const c = calcularActualizacionMasiva(precios, productos, { productoIds: ["pX"], listaIds: ["lst_may"] }, { tipo: "AUMENTAR", pct: 10 });
    expect(c).toEqual([]);
    expect(precios).toEqual(copia);
  });

  it("filtro vacío no genera cambios", () => {
    expect(calcularActualizacionMasiva(precios, productos, { productoIds: [], listaIds: ["lst_may"] }, { tipo: "AUMENTAR", pct: 10 })).toEqual([]);
    expect(calcularActualizacionMasiva(precios, productos, { productoIds: ["p1"], listaIds: [] }, { tipo: "AUMENTAR", pct: 10 })).toEqual([]);
  });

  // OJO: el comentario dice "devuelve sólo los cambios", pero devuelve todas las combinaciones
  // producto × lista, aunque el precio no cambie (anterior === nuevo).
  it("incluye combinaciones sin cambio real", () => {
    const c = calcularActualizacionMasiva(precios, productos, { productoIds: ["p1"], listaIds: ["lst_may"] }, { tipo: "AUMENTAR", pct: 0 });
    expect(c).toEqual([{ productoId: "p1", listaPreciosId: "lst_may", anterior: 1220, nuevo: 1220 }]);
  });

  it("sin precio cargado: AUMENTAR deja 0 y MARKUP calcula desde el costo", () => {
    const filtroSinPrecio = { productoIds: ["p1"], listaIds: ["lst_nueva"] };
    expect(calcularActualizacionMasiva(precios, productos, filtroSinPrecio, { tipo: "AUMENTAR", pct: 10 })).toEqual([
      { productoId: "p1", listaPreciosId: "lst_nueva", anterior: 0, nuevo: 0 },
    ]);
    expect(calcularActualizacionMasiva(precios, productos, filtroSinPrecio, { tipo: "MARKUP", markups: { lst_nueva: 30 } })).toEqual([
      { productoId: "p1", listaPreciosId: "lst_nueva", anterior: 0, nuevo: 1300 },
    ]);
  });
});

describe("aplicarActualizacionMasiva", () => {
  const precios = [precio("p1", "lst_may", 1000), precio("p1", "lst_pub", 2000), precio("p2", "lst_may", 500)];
  const ahora = "2026-10-09T10:00:00.000Z";

  it("pct positivo aumenta solo lo filtrado y marca la fecha", () => {
    const out = aplicarActualizacionMasiva(precios, { productoIds: ["p1"], listaIds: ["lst_may"] }, 15, 10, ahora);
    expect(out[0]).toMatchObject({ precio: 1150, actualizadoEn: ahora });
    expect(out[1]).toBe(precios[1]);
    expect(out[2]).toBe(precios[2]);
  });

  it("pct negativo disminuye y redondea", () => {
    // 2000 × 0,875 = 1750 → 1800 a $100
    const out = aplicarActualizacionMasiva(precios, { productoIds: ["p1"], listaIds: ["lst_pub"] }, -12.5, 100, ahora);
    expect(out[1].precio).toBe(1800);
  });

  it("no muta la lista original", () => {
    aplicarActualizacionMasiva(precios, { productoIds: ["p1", "p2"], listaIds: ["lst_may", "lst_pub"] }, 50, 10, ahora);
    expect(precios.map((p) => p.precio)).toEqual([1000, 2000, 500]);
  });
});

describe("aplicarCambiosPrecio", () => {
  const precios = [precio("p1", "lst_may", 1000), precio("p1", "lst_pub", 2000)];
  const ahora = "2026-10-09T10:00:00.000Z";

  it("reemplaza solo los precios con cambio y actualiza la fecha", () => {
    const out = aplicarCambiosPrecio(precios, [{ productoId: "p1", listaPreciosId: "lst_pub", anterior: 2000, nuevo: 2300 }], ahora);
    expect(out[0]).toBe(precios[0]);
    expect(out[1]).toMatchObject({ precio: 2300, actualizadoEn: ahora });
    expect(precios[1].precio).toBe(2000);
  });

  it("acepta precio nuevo 0", () => {
    const out = aplicarCambiosPrecio(precios, [{ productoId: "p1", listaPreciosId: "lst_may", anterior: 1000, nuevo: 0 }], ahora);
    expect(out[0].precio).toBe(0);
  });

  // OJO: si el cambio es para un producto × lista sin PrecioProducto cargado (por ejemplo el
  // MARKUP de una lista nueva), aplicarCambiosPrecio no crea la fila: el cambio se pierde.
  it("descarta cambios de combinaciones que no tienen precio cargado", () => {
    const out = aplicarCambiosPrecio(precios, [{ productoId: "p1", listaPreciosId: "lst_nueva", anterior: 0, nuevo: 1300 }], ahora);
    expect(out).toEqual(precios);
    expect(out).toHaveLength(2);
  });

  it("sin cambios devuelve los mismos precios", () => {
    expect(aplicarCambiosPrecio(precios, [], ahora)).toEqual(precios);
  });
});
