import { describe, expect, it } from "vitest";
import {
  claveFecha,
  comprobantesVenta,
  fechaVentaNP,
  margenPeriodo,
  netoPorUN,
  netoVenta,
  notasVendidas,
  rankingProductos,
  serieVentasMargen,
  ventasFacturadas,
} from "@/domain/metricas";
import type { Acopio, ItemVenta } from "@/domain/types";
import { comprobante, estado, itemNP, notaPedido, producto } from "./fixtures";

const productos = [producto("p_fer", { unidadNegocioId: "un_fer" }), producto("p_cor", { unidadNegocioId: "un_cor" })];
const itemVenta = (productoId: string, cantidad: number, precioUnitario: number): ItemVenta => ({
  id: `iv_${productoId}`,
  productoId,
  cantidad,
  precioUnitario,
  costoUnitarioSnapshot: 0,
  descuentoPct: 0,
});
const octubre = { desde: "2026-10-01T00:00:00.000Z", hasta: "2026-10-31T23:59:59.999Z" };

describe("comprobantesVenta", () => {
  const cs = [
    comprobante("f1"),
    comprobante("nc1", { tipo: "NOTA_CREDITO" }),
    comprobante("nd1", { tipo: "NOTA_DEBITO" }),
    comprobante("si1", { tipo: "SALDO_INICIAL" }),
    comprobante("fp1", { clienteId: undefined, proveedorId: "prv_1" }),
    comprobante("f2", { sucursalId: "suc_2" }),
    comprobante("f3", { circuito: 2 }),
    comprobante("fa", { estado: "ANULADO" }),
  ];

  it("solo facturas y NC de clientes", () => {
    expect(comprobantesVenta(cs, null).map((c) => c.id)).toEqual(["f1", "nc1", "f2", "f3", "fa"]);
  });

  it("filtra por sucursal (también con el atajo de string)", () => {
    expect(comprobantesVenta(cs, "suc_2").map((c) => c.id)).toEqual(["f2"]);
    expect(comprobantesVenta(cs, { sucursalId: "suc_2" }).map((c) => c.id)).toEqual(["f2"]);
  });

  it("circuito2: false excluye AC2", () => {
    expect(comprobantesVenta(cs, { sucursalId: null, circuito2: false }).map((c) => c.id)).not.toContain("f3");
  });

  // OJO: el comentario dice "no anuladas", pero el filtro no las saca; recién netoVenta las lleva a 0.
  it("incluye los comprobantes anulados", () => {
    expect(comprobantesVenta(cs, null).map((c) => c.id)).toContain("fa");
  });
});

describe("netoVenta", () => {
  it("factura suma, NC resta, anulado vale 0", () => {
    expect(netoVenta(comprobante("f", { subtotal: 1000 }))).toBe(1000);
    expect(netoVenta(comprobante("nc", { tipo: "NOTA_CREDITO", subtotal: 300 }))).toBe(-300);
    expect(netoVenta(comprobante("fa", { subtotal: 1000, estado: "ANULADO" }))).toBe(0);
  });
});

describe("netoPorUN", () => {
  it("reparte el neto según el peso de cada línea", () => {
    // ferretería 2 × 100 = 200, corralón 1 × 300 = 300 → 40 % / 60 % de 1000
    const c = comprobante("f", { subtotal: 1000, items: [itemVenta("p_fer", 2, 100), itemVenta("p_cor", 1, 300)] });
    const r = netoPorUN(c, estado({ productos }));
    expect(r.un_fer).toBeCloseTo(400, 10);
    expect(r.un_cor).toBeCloseTo(600, 10);
  });

  it("NC reparte en negativo", () => {
    const c = comprobante("nc", { tipo: "NOTA_CREDITO", subtotal: 500, items: [itemVenta("p_fer", 1, 10)] });
    expect(netoPorUN(c, estado({ productos }))).toEqual({ un_fer: -500 });
  });

  it("sin ítems propios usa los de la nota de pedido", () => {
    const np = notaPedido("np1", [itemNP("i1", "p_fer", 1, { precioUnitario: 100 })]);
    const c = comprobante("f", { subtotal: 800, notaPedidoId: "np1" });
    expect(netoPorUN(c, estado({ productos, notasPedido: [np] }))).toEqual({ un_fer: 800 });
  });

  it("factura de acopio va entera a la unidad del acopio", () => {
    const acopio = { id: "ac1", unidadNegocioId: "un_fer" } as Acopio;
    const c = comprobante("f", { subtotal: 5000, acopioId: "ac1" });
    expect(netoPorUN(c, estado({ productos, acopios: [acopio] }))).toEqual({ un_fer: 5000 });
  });

  it("acopio desconocido o comprobante sin ítems cae en corralón", () => {
    expect(netoPorUN(comprobante("f", { subtotal: 100, acopioId: "acX" }), estado({ productos }))).toEqual({ un_cor: 100 });
    expect(netoPorUN(comprobante("f", { subtotal: 100 }), estado({ productos }))).toEqual({ un_cor: 100 });
  });

  it("producto desconocido cae en corralón", () => {
    const c = comprobante("f", { subtotal: 100, items: [itemVenta("p_x", 1, 10)] });
    expect(netoPorUN(c, estado({ productos }))).toEqual({ un_cor: 100 });
  });

  it("neto 0 devuelve objeto vacío", () => {
    expect(netoPorUN(comprobante("f", { subtotal: 0 }), estado({ productos }))).toEqual({});
  });
});

describe("ventasFacturadas", () => {
  const db = estado({
    productos,
    comprobantes: [
      comprobante("f1", { subtotal: 1000, items: [itemVenta("p_fer", 1, 100), itemVenta("p_cor", 1, 300)] }),
      comprobante("nc1", { tipo: "NOTA_CREDITO", subtotal: 200, items: [itemVenta("p_cor", 1, 1)] }),
      comprobante("f2", { subtotal: 700, fecha: "2026-09-30T12:00:00.000Z" }),
      comprobante("f3", { subtotal: 50, sucursalId: "suc_2" }),
      comprobante("fa", { subtotal: 9999, estado: "ANULADO" }),
    ],
  });

  it("facturas − NC del rango", () => {
    expect(ventasFacturadas(db, octubre, null)).toBe(850);
  });

  it("por sucursal", () => {
    expect(ventasFacturadas(db, octubre, "suc_2")).toBe(50);
  });

  it("por unidad de negocio", () => {
    // f1: fer 250 / cor 750; nc1: cor −200; f3 sin ítems → cor 50
    expect(ventasFacturadas(db, octubre, { sucursalId: null, unidadNegocioId: "un_fer" })).toBeCloseTo(250, 10);
    expect(ventasFacturadas(db, octubre, { sucursalId: null, unidadNegocioId: "un_cor" })).toBeCloseTo(600, 10);
  });

  it("la comparación de fechas es por texto: un hasta sin hora deja afuera ese día", () => {
    expect(ventasFacturadas(db, { desde: "2026-10-01", hasta: "2026-10-05" }, null)).toBe(0);
  });
});

describe("fechaVentaNP", () => {
  it("usa la fecha de confirmación si existe", () => {
    expect(fechaVentaNP(notaPedido("np", [], { fechaConfirmacion: "2026-10-03T10:00:00.000Z" }))).toBe("2026-10-03T10:00:00.000Z");
    expect(fechaVentaNP(notaPedido("np", [], { fecha: "2026-10-02T10:00:00.000Z" }))).toBe("2026-10-02T10:00:00.000Z");
  });
});

describe("notasVendidas, margenPeriodo y rankingProductos", () => {
  const db = estado({
    productos,
    notasPedido: [
      notaPedido("np1", [
        itemNP("a", "p_fer", 2, { precioUnitario: 100, costoUnitarioSnapshot: 60 }), // 200 / 120
        itemNP("b", "p_cor", 1, { precioUnitario: 500, costoUnitarioSnapshot: 400 }), // 500 / 400
      ], { fechaConfirmacion: "2026-10-04T12:00:00.000Z" }),
      notaPedido("np2", [itemNP("c", "p_fer", 3, { precioUnitario: 100, costoUnitarioSnapshot: 50 })], { descuentoPct: 10, estado: "ENTREGADA" }), // 270 / 150
      notaPedido("np3", [itemNP("d", "p_fer", 99)], { estado: "BORRADOR" }),
      notaPedido("np4", [itemNP("e", "p_fer", 99)], { estado: "ANULADA" }),
      notaPedido("np5", [itemNP("f", "p_fer", 99)], { circuito: 2, sucursalId: "suc_2" }),
      notaPedido("np6", [itemNP("g", "p_fer", 99)], { fecha: "2026-11-01T12:00:00.000Z" }),
    ],
  });

  it("excluye borradores, anuladas y fuera de rango", () => {
    expect(notasVendidas(db, octubre, null).map((n) => n.nota.id)).toEqual(["np1", "np2", "np5"]);
  });

  it("filtra por sucursal y circuito", () => {
    expect(notasVendidas(db, octubre, "suc_2").map((n) => n.nota.id)).toEqual(["np5"]);
    expect(notasVendidas(db, octubre, { sucursalId: null, circuito2: false }).map((n) => n.nota.id)).toEqual(["np1", "np2"]);
  });

  it("por unidad de negocio solo cuenta las líneas de esa unidad", () => {
    const r = notasVendidas(db, octubre, { sucursalId: "suc_1", unidadNegocioId: "un_cor" });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ ingreso: 500, costo: 400, margen: 100 });
  });

  it("margenPeriodo suma ingresos y margen", () => {
    const m = margenPeriodo(db, octubre, "suc_1");
    // ingreso 700 + 270 = 970; margen 180 + 120 = 300
    expect(m).toMatchObject({ ingreso: 970, margen: 300, pedidos: 2 });
    expect(m.margenPct).toBeCloseTo(300 / 970, 10);
  });

  it("margenPeriodo sin ventas da 0", () => {
    expect(margenPeriodo(estado(), octubre, null)).toEqual({ ingreso: 0, margen: 0, margenPct: 0, pedidos: 0 });
  });

  it("rankingProductos agrupa por artículo", () => {
    const r = rankingProductos(db, octubre, "suc_1");
    const fer = r.find((x) => x.productoId === "p_fer")!;
    expect(fer).toMatchObject({ unidades: 5, facturado: 470, costo: 270, margen: 200 });
    expect(fer.margenPct).toBeCloseTo(200 / 470, 10);
    expect(r.find((x) => x.productoId === "p_cor")).toMatchObject({ unidades: 1, facturado: 500, margen: 100 });
  });
});

describe("claveFecha", () => {
  it("día, semana (arranca el lunes) y mes", () => {
    // 8/10/2026 es jueves
    expect(claveFecha("2026-10-08T12:00:00", "dia")).toBe("2026-10-08");
    expect(claveFecha("2026-10-08T12:00:00", "semana")).toBe("2026-10-05");
    expect(claveFecha("2026-10-11T12:00:00", "semana")).toBe("2026-10-05");
    expect(claveFecha("2026-10-12T12:00:00", "semana")).toBe("2026-10-12");
    expect(claveFecha("2026-10-08T12:00:00", "mes")).toBe("2026-10");
  });
});

describe("serieVentasMargen", () => {
  it("arma un punto por día aunque no haya ventas y acumula ventas y margen", () => {
    const db = estado({
      productos,
      comprobantes: [comprobante("f1", { fecha: "2026-10-06T12:00:00", subtotal: 1000, items: [itemVenta("p_fer", 1, 1)] })],
      notasPedido: [notaPedido("np1", [itemNP("a", "p_fer", 1, { precioUnitario: 100, costoUnitarioSnapshot: 70 })], { fecha: "2026-10-07T12:00:00" })],
    });
    const s = serieVentasMargen(db, { desde: "2026-10-05T00:00:00", hasta: "2026-10-07T23:59:59" }, null, "dia");
    expect(s.map((p) => p.clave)).toEqual(["2026-10-05", "2026-10-06", "2026-10-07"]);
    expect(s[1]).toMatchObject({ ventas: 1000, margen: 0, porUN: { un_fer: 1000 }, porSucursal: { suc_1: 1000 } });
    expect(s[2]).toMatchObject({ ventas: 0, margen: 30 });
    expect(s[0]).toMatchObject({ ventas: 0, margen: 0 });
  });
});
