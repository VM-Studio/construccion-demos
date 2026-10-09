import { describe, expect, it } from "vitest";
import {
  ahorroAcopio,
  deudaConProveedor,
  ordenesDelAcopio,
  pedidoAcopio,
  pendienteRetirar,
  resumenArticulos,
  retiradoAcopioProveedor,
  saldoDisponible,
} from "@/domain/acopiosProveedor";
import type { AcopioProveedor, ItemOC, OrdenCompra, Producto } from "@/domain/types";

// ───────────────────────── Fixtures mínimos ─────────────────────────

const TS = "2026-01-01T00:00:00.000Z";
const meta = { creadoEn: TS, actualizadoEn: TS };

const producto = (id: string, codigo: string, nombre: string, costoUltimo: number): Producto => ({
  id,
  codigo,
  nombre,
  rubroId: "rub_1",
  unidadNegocioId: "un_cor",
  unidad: "BOLSA",
  costoUltimo,
  costoPromedio: costoUltimo,
  fechaUltimoCosto: TS,
  stockMinimo: 0,
  activo: true,
  ...meta,
});

const acp = (over: Partial<AcopioProveedor> = {}): AcopioProveedor => ({
  id: "acp_1",
  numero: "ACP1 0001-00000001",
  circuito: 1,
  proveedorId: "prov_loma",
  sucursalId: "suc_central",
  depositoDestinoId: "dep_central",
  fechaCreacion: "2026-01-01",
  fechaVencimiento: "2026-12-31",
  modalidad: "CANTIDAD",
  importe: 2_000_000,
  formaPago: "CUENTA_CORRIENTE",
  preciosCongelados: [{ productoId: "q1", costo: 1000 }],
  items: [{ productoId: "q1", cantidadPactada: 2000 }],
  pagado: 500_000,
  comprobanteCompraIds: [],
  ordenPagoIds: [],
  estado: "VIGENTE",
  ...meta,
  ...over,
});

const itemOC = (id: string, productoId: string, cantidadPedida: number, cantidadRecibida: number, costoUnitario: number, descuentoPct = 0): ItemOC => ({
  id,
  productoId,
  cantidadPedida,
  cantidadRecibida,
  costoUnitario,
  descuentoPct,
});

const oc = (over: Partial<OrdenCompra> & Pick<OrdenCompra, "id" | "items">): OrdenCompra => ({
  numero: `OC1 0001-${over.id}`,
  circuito: 1,
  origen: "ACOPIO",
  acopioProveedorId: "acp_1",
  proveedorId: "prov_loma",
  depositoDestinoId: "dep_central",
  sucursalId: "suc_central",
  estado: "ENVIADA",
  fechaEmision: "2026-01-10",
  fechaEntregaEstimada: "2026-01-15",
  subtotal: 0,
  iva: 0,
  total: 0,
  usuarioId: "usr_1",
  ...meta,
  ...over,
});

const productos: Producto[] = [
  producto("q1", "50104", "CEMENTO LOMA NEGRA X 50 KG", 1200),
  producto("q2", "50113", "PLASTICOR X 40 KG", 900),
  producto("q3", "20102", "HIERRO 6 MM", 500),
];

/*
 * Acopio por CANTIDAD: 2.000 bolsas de cemento a $ 1.000 congelado ($ 2.000.000), cuenta corriente, pagado $ 500.000.
 *   oc_1 ENVIADA          800 pedidas / 800 recibidas × 1.000            → pedido 800.000 · recibido 800.000
 *   oc_2 RECIBIDA_PARCIAL 500 pedidas / 200 recibidas × 1.000 − 10 %     → pedido 450.000 · recibido 180.000
 *   oc_7 CONFIRMADA       100 pedidas /   0 recibidas × 1.000            → pedido 100.000 · recibido       0
 *   No cuentan: BORRADOR, CANCELADA, origen NUEVA y OC de otro acopio.
 */
const ocsCantidad: OrdenCompra[] = [
  oc({ id: "oc_1", estado: "ENVIADA", items: [itemOC("a", "q1", 800, 800, 1000)] }),
  oc({ id: "oc_2", estado: "RECIBIDA_PARCIAL", items: [itemOC("b", "q1", 500, 200, 1000, 10)] }),
  oc({ id: "oc_3", estado: "BORRADOR", items: [itemOC("c", "q1", 300, 0, 1000)] }),
  oc({ id: "oc_4", estado: "CANCELADA", items: [itemOC("d", "q1", 400, 0, 1000)] }),
  oc({ id: "oc_5", origen: "NUEVA", items: [itemOC("e", "q1", 50, 50, 1300)] }),
  oc({ id: "oc_6", acopioProveedorId: "acp_otro", items: [itemOC("f", "q1", 70, 70, 1000)] }),
  oc({ id: "oc_7", estado: "CONFIRMADA", items: [itemOC("g", "q1", 100, 0, 1000)] }),
];

/*
 * Acopio por MONTO: $ 500.000 por anticipo, costos congelados q2 $ 800 y q3 $ 500.
 *   m_1 RECIBIDA  q2 100/100 × 800 · q3 200/150 × 500 → pedido 180.000 · recibido 155.000
 *   m_2 ENVIADA   q2  50/  0 × 800                    → pedido  40.000 · recibido       0
 */
const acpMonto = acp({
  id: "acp_2",
  numero: "ACP2 0001-00000002",
  circuito: 2,
  modalidad: "MONTO",
  importe: 500_000,
  formaPago: "ANTICIPO",
  pagado: 500_000,
  items: undefined,
  preciosCongelados: [
    { productoId: "q3", costo: 500 },
    { productoId: "q2", costo: 800 },
    { productoId: "q_fuera", costo: 100 },
  ],
});
const ocsMonto: OrdenCompra[] = [
  oc({ id: "m_1", acopioProveedorId: "acp_2", estado: "RECIBIDA", items: [itemOC("m1a", "q2", 100, 100, 800), itemOC("m1b", "q3", 200, 150, 500)] }),
  oc({ id: "m_2", acopioProveedorId: "acp_2", estado: "ENVIADA", items: [itemOC("m2a", "q2", 50, 0, 800)] }),
];

// ───────────────────────── Tests ─────────────────────────

describe("ordenesDelAcopio", () => {
  it("toma solo OC origen ACOPIO del acopio en estado enviada, confirmada o recibida", () => {
    expect(ordenesDelAcopio(acp(), ocsCantidad).map((o) => o.id)).toEqual(["oc_1", "oc_2", "oc_7"]);
  });
  it("incluye las RECIBIDA", () => {
    expect(ordenesDelAcopio(acpMonto, ocsMonto).map((o) => o.id)).toEqual(["m_1", "m_2"]);
  });
});

describe("pedidoAcopio y retiradoAcopioProveedor", () => {
  it("pedido = Σ cantidad pedida × costo neto de descuento", () => {
    expect(pedidoAcopio(acp(), ocsCantidad)).toBe(1_350_000);
  });
  it("retirado = Σ cantidad recibida × costo neto de descuento", () => {
    expect(retiradoAcopioProveedor(acp(), ocsCantidad)).toBe(980_000);
  });
  it("acopio por monto con varios artículos", () => {
    expect(pedidoAcopio(acpMonto, ocsMonto)).toBe(220_000);
    expect(retiradoAcopioProveedor(acpMonto, ocsMonto)).toBe(155_000);
  });
  it("sin OC da cero", () => {
    expect(pedidoAcopio(acp(), [])).toBe(0);
    expect(retiradoAcopioProveedor(acp(), [])).toBe(0);
  });
});

describe("saldoDisponible (proveedor)", () => {
  it("es importe − Σ OC emitidas (pedido, no recibido)", () => {
    expect(saldoDisponible(acp(), ocsCantidad)).toBe(650_000);
    expect(saldoDisponible(acpMonto, ocsMonto)).toBe(280_000);
  });
  it("sin OC el saldo es el importe", () => {
    expect(saldoDisponible(acp(), [])).toBe(2_000_000);
  });
  it("redondea a centavos", () => {
    expect(saldoDisponible(acp({ importe: 100 }), [oc({ id: "r", items: [itemOC("r1", "q1", 3, 0, 33.3333)] })])).toBe(0);
  });
  it("puede quedar negativo si se pidió de más", () => {
    expect(saldoDisponible(acp({ importe: 1000 }), [oc({ id: "r", items: [itemOC("r1", "q1", 2, 0, 600)] })])).toBe(-200);
  });
});

describe("pendienteRetirar", () => {
  it("por cantidad: pactado − recibido por producto, valuado al costo congelado", () => {
    const p = pendienteRetirar(acp(), ocsCantidad);
    expect(p.porProducto).toEqual([{ productoId: "q1", pactado: 2000, recibido: 1000, pendiente: 1000, costo: 1000, pendientePesos: 1_000_000 }]);
    expect(p.pesos).toBe(1_000_000);
  });
  it("OJO: por cantidad, los pesos pendientes ignoran el descuento de las OC", () => {
    // OJO: importe − retirado neto = 2.000.000 − 980.000 = 1.020.000, pero informa 1.000 bolsas × 1.000 = 1.000.000.
    expect(pendienteRetirar(acp(), ocsCantidad).pesos).not.toBe(acp().importe - retiradoAcopioProveedor(acp(), ocsCantidad));
  });
  it("por cantidad: si recibió de más el pendiente es cero", () => {
    const p = pendienteRetirar(acp(), [oc({ id: "x", items: [itemOC("x1", "q1", 2100, 2100, 1000)] })]);
    expect(p.porProducto[0]).toMatchObject({ recibido: 2100, pendiente: 0, pendientePesos: 0 });
    expect(p.pesos).toBe(0);
  });
  it("por cantidad: lo recibido de artículos no pactados no aparece", () => {
    const p = pendienteRetirar(acp(), [oc({ id: "x", items: [itemOC("x1", "q2", 10, 10, 800)] })]);
    expect(p.porProducto.map((x) => x.productoId)).toEqual(["q1"]);
    expect(p.porProducto[0].recibido).toBe(0);
  });
  it("por cantidad sin costo congelado del producto valúa en cero", () => {
    const p = pendienteRetirar(acp({ preciosCongelados: [] }), []);
    expect(p.porProducto[0]).toMatchObject({ pendiente: 2000, costo: 0, pendientePesos: 0 });
  });
  it("por monto: pesos = importe − retirado, y por producto solo informa lo recibido", () => {
    const p = pendienteRetirar(acpMonto, ocsMonto);
    expect(p.pesos).toBe(345_000);
    expect(p.porProducto).toEqual([
      { productoId: "q2", pactado: 0, recibido: 100, pendiente: 0, costo: 800, pendientePesos: 0 },
      { productoId: "q3", pactado: 0, recibido: 150, pendiente: 0, costo: 500, pendientePesos: 0 },
    ]);
  });
  it("por monto: nunca da negativo si retiró más que el importe", () => {
    const p = pendienteRetirar(acpMonto, [oc({ id: "y", acopioProveedorId: "acp_2", items: [itemOC("y1", "q2", 700, 700, 800)] })]);
    expect(p.pesos).toBe(0);
  });
  it("modalidad CANTIDAD sin artículos pactados se trata como por monto", () => {
    const p = pendienteRetirar(acp({ items: [] }), ocsCantidad);
    expect(p.pesos).toBe(1_020_000);
    expect(p.porProducto).toEqual([{ productoId: "q1", pactado: 0, recibido: 1000, pendiente: 0, costo: 1000, pendientePesos: 0 }]);
  });
});

describe("deudaConProveedor", () => {
  it("en cuenta corriente: importe − pagado", () => {
    expect(deudaConProveedor(acp())).toBe(1_500_000);
  });
  it("en cuenta corriente totalmente pagado o sobrepagado: cero", () => {
    expect(deudaConProveedor(acp({ pagado: 2_000_000 }))).toBe(0);
    expect(deudaConProveedor(acp({ pagado: 2_100_000 }))).toBe(0);
  });
  it("por anticipo no le debemos nada (se pagó al crear)", () => {
    expect(deudaConProveedor(acp({ formaPago: "ANTICIPO", pagado: 0 }))).toBe(0);
  });
  it("un acopio cancelado no genera deuda", () => {
    expect(deudaConProveedor(acp({ estado: "CANCELADO" }))).toBe(0);
  });
  it("vencido o agotado en cuenta corriente sigue debiendo", () => {
    expect(deudaConProveedor(acp({ estado: "VENCIDO" }))).toBe(1_500_000);
    expect(deudaConProveedor(acp({ estado: "AGOTADO", pagado: 1_999_000 }))).toBe(1000);
  });
});

describe("resumenArticulos (proveedor)", () => {
  it("por cantidad: pactado, pedido, recibido, saldo y costos", () => {
    expect(resumenArticulos(acp(), ocsCantidad, productos)).toEqual([
      { productoId: "q1", codigo: "50104", articulo: "CEMENTO LOMA NEGRA X 50 KG", costo: 1000, costoActual: 1200, pactado: 2000, pedido: 1400, recibido: 1000, saldo: 1000 },
    ]);
  });
  it("por monto: saldo = −recibido y ordena por código (sin catálogo, código vacío primero)", () => {
    const r = resumenArticulos(acpMonto, ocsMonto, productos);
    expect(r.map((x) => x.productoId)).toEqual(["q_fuera", "q3", "q2"]);
    expect(r[1]).toMatchObject({ codigo: "20102", costo: 500, costoActual: 500, pactado: 0, pedido: 200, recibido: 150, saldo: -150 });
    expect(r[2]).toMatchObject({ codigo: "50113", costo: 800, costoActual: 900, pactado: 0, pedido: 150, recibido: 100, saldo: -100 });
  });
  it("un artículo fuera del catálogo usa el costo congelado como costo actual", () => {
    const r = resumenArticulos(acpMonto, ocsMonto, productos);
    expect(r[0]).toMatchObject({ codigo: "", articulo: "", costo: 100, costoActual: 100, pedido: 0, recibido: 0 });
    // OJO: sin movimientos el saldo es −0 (no 0).
    expect(Object.is(r[0].saldo, -0)).toBe(true);
  });
});

describe("ahorroAcopio", () => {
  it("por cantidad: pendiente × (costo actual − costo congelado)", () => {
    // 1.000 bolsas × (1.200 − 1.000)
    expect(ahorroAcopio(acp(), ocsCantidad, productos)).toBe(200_000);
  });
  it("si el costo bajó el ahorro es negativo", () => {
    const baratos = [producto("q1", "50104", "CEMENTO", 900)];
    expect(ahorroAcopio(acp(), ocsCantidad, baratos)).toBe(-100_000);
  });
  it("sin el producto en el catálogo no hay ahorro", () => {
    expect(ahorroAcopio(acp(), ocsCantidad, [])).toBe(0);
  });
  it("todo retirado: no hay ahorro pendiente", () => {
    expect(ahorroAcopio(acp(), [oc({ id: "t", items: [itemOC("t1", "q1", 2000, 2000, 1000)] })], productos)).toBe(0);
  });
  it("OJO: en acopios por monto el ahorro siempre da cero", () => {
    // OJO: pendienteRetirar por monto no informa pendiente por producto, así que el ahorro es 0
    // aunque el costo actual de q2 (900) supere al congelado (800) y queden $ 345.000 sin retirar.
    expect(ahorroAcopio(acpMonto, ocsMonto, productos)).toBe(0);
  });
});
