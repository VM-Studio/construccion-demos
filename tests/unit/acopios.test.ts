import { describe, expect, it } from "vitest";
import {
  diasParaVencer,
  estadoDerivado,
  montoPendienteEntrega,
  movimientosAcopio,
  notasDelAcopio,
  pagadoAcopio,
  pendienteEntrega,
  pendienteLinea,
  precioCongelado,
  resumenArticulos,
  retiradoAcopio,
  saldoDisponible,
  validarRetiro,
} from "@/domain/acopios";
import type { Acopio, AjusteAcopio, Comprobante, DevolucionNP, ItemNP, NotaPedido, Obra, Producto, Remito } from "@/domain/types";

// ───────────────────────── Fixtures mínimos ─────────────────────────

const TS = "2026-01-01T00:00:00.000Z";
const meta = { creadoEn: TS, actualizadoEn: TS };

const producto = (id: string, codigo: string, nombre: string): Producto => ({
  id,
  codigo,
  nombre,
  rubroId: "rub_1",
  unidadNegocioId: "un_cor",
  unidad: "UN",
  costoUltimo: 0,
  costoPromedio: 0,
  fechaUltimoCosto: TS,
  stockMinimo: 0,
  activo: true,
  ...meta,
});

const acopio = (over: Partial<Acopio> = {}): Acopio => ({
  id: "aco_1",
  numero: "AC2 0001-00000001",
  circuito: 2,
  clienteId: "cli_1",
  sucursalId: "suc_central",
  depositoId: "dep_central",
  vendedorId: "usr_1",
  obraIds: ["obra_1"],
  fechaCreacion: "2026-01-01",
  fechaVencimiento: "2026-12-31",
  importe: 100_000,
  alicuotaIIBBPct: 0,
  importeConIIBB: 100_000,
  formaPago: "ANTICIPO",
  listaPreciosBaseId: "lp_1",
  unidadNegocioId: "un_cor",
  preciosCongelados: [
    { productoId: "p1", precio: 1000, costoSnapshot: 700 },
    { productoId: "p2", precio: 500, costoSnapshot: 300 },
    { productoId: "p3", precio: 250, costoSnapshot: 200 },
  ],
  comprobanteIds: [],
  reciboIds: [],
  estado: "VIGENTE",
  ...meta,
  ...over,
});

const item = (over: Partial<ItemNP> & Pick<ItemNP, "id" | "productoId" | "cantidad" | "precioUnitario">): ItemNP => ({
  entregados: 0,
  costoUnitarioSnapshot: 0,
  subtotal: over.cantidad * over.precioUnitario,
  ...over,
});

const np = (over: Partial<NotaPedido> & Pick<NotaPedido, "id" | "numero" | "fecha" | "items">): NotaPedido => {
  const monto = over.monto ?? over.items.reduce((a, i) => a + i.subtotal, 0);
  return {
    circuito: 2,
    tipo: "RETIRO_ACOPIO",
    origen: "ACOPIO",
    acopioId: "aco_1",
    clienteId: "cli_1",
    sucursalId: "suc_central",
    depositoId: "dep_central",
    vendedorId: "usr_1",
    monto,
    descuentoPct: 0,
    iva: 0,
    total: monto,
    estado: "PENDIENTE",
    formaPago: "ACOPIO",
    condicionPago: "ANTICIPO",
    pendienteEntrega: true,
    modalidadEntrega: "ENVIO",
    remitoIds: [],
    comprobanteIds: [],
    ...meta,
    ...over,
  };
};

const dp = (over: Partial<DevolucionNP> & Pick<DevolucionNP, "id" | "numero" | "fecha" | "items" | "monto">): DevolucionNP => ({
  circuito: 2,
  notaPedidoId: "np_2",
  acopioId: "aco_1",
  clienteId: "cli_1",
  motivo: "Devolución",
  usuarioId: "usr_1",
  ...meta,
  ...over,
});

const acd = (over: Partial<AjusteAcopio> & Pick<AjusteAcopio, "id" | "numero" | "fecha" | "monto">): AjusteAcopio => ({
  circuito: 2,
  acopioId: "aco_1",
  tipo: "AJUSTE",
  descripcion: "Ajuste",
  usuarioId: "usr_1",
  ...meta,
  ...over,
});

const remito = (over: Partial<Remito> & Pick<Remito, "id" | "numero" | "items">): Remito => ({
  circuito: 2,
  tipo: "DESACOPIO",
  acopioId: "aco_1",
  sucursalId: "suc_central",
  depositoId: "dep_central",
  fecha: "2026-01-11",
  cantidadTotal: over.items.reduce((a, i) => a + i.cantidad, 0),
  pesoTotalKg: 0,
  valorDeclarado: 0,
  estado: "HECHO",
  facturado: true,
  ...meta,
  ...over,
});

const comprobante = (over: Partial<Comprobante> & Pick<Comprobante, "id" | "numero" | "total" | "saldoPendiente">): Comprobante => ({
  tipo: "FACTURA",
  circuito: 2,
  fecha: "2026-01-01",
  subtotal: over.total,
  iva: 0,
  estado: over.saldoPendiente === 0 ? "PAGADO" : "PARCIAL",
  ...meta,
  ...over,
});

const productos: Producto[] = [producto("p1", "200", "HIERRO 8 MM"), producto("p2", "30", "LADRILLO COMUN"), producto("p3", "1000", "CEMENTO X 50 KG")];
const obras: Obra[] = [{ id: "obra_1", clienteId: "cli_1", nombre: "Lote 268", activa: true, ...meta }];

/*
 * Escenario base (importe $ 100.000):
 *   NP1 10/01: p1 10 × 1000 (entregó 10) + p2 20 × 500 (entregó 5)   → $ 20.000
 *   NP2 15/01: p1 5 × 1000 a obra_1 (entregó 0, devolvió 2)          → $  5.000
 *   DP1 20/01: devuelve 2 × 1000 de NP2                              → −$ 2.000
 *   ACD1 25/01: traspaso de entrada                                   → +$ 1.500
 *   ACD2 26/01: ajuste en contra                                      → −$   500
 * Ruido que no debe contar: NP anulada, NP borrador, NP de venta, documentos de otro acopio.
 * Saldo = 100.000 − 25.000 + 2.000 + 1.500 − 500 = 78.000.
 */
const NP1 = np({
  id: "np_1",
  numero: "NP2 0001-00000001",
  fecha: "2026-01-10",
  items: [
    item({ id: "i1", productoId: "p1", cantidad: 10, entregados: 10, precioUnitario: 1000, costoUnitarioSnapshot: 700 }),
    item({ id: "i2", productoId: "p2", cantidad: 20, entregados: 5, precioUnitario: 500, costoUnitarioSnapshot: 300 }),
  ],
});
const NP2 = np({
  id: "np_2",
  numero: "NP2 0001-00000002",
  fecha: "2026-01-15",
  items: [item({ id: "i3", productoId: "p1", obraId: "obra_1", cantidad: 5, entregados: 0, devueltos: 2, precioUnitario: 1000 })],
});
const ruidoNP: NotaPedido[] = [
  np({ id: "np_anulada", numero: "NP2 0001-00000090", fecha: "2026-01-12", estado: "ANULADA", items: [item({ id: "ix1", productoId: "p1", cantidad: 99, precioUnitario: 1000 })] }),
  np({ id: "np_borrador", numero: "NP2 0001-00000091", fecha: "2026-01-12", estado: "BORRADOR", items: [item({ id: "ix2", productoId: "p1", cantidad: 88, precioUnitario: 1000 })] }),
  np({ id: "np_venta", numero: "NP2 0001-00000092", fecha: "2026-01-12", tipo: "VENTA", origen: "NUEVA", items: [item({ id: "ix3", productoId: "p1", cantidad: 7, precioUnitario: 1000 })] }),
  np({ id: "np_otro", numero: "NP2 0001-00000093", fecha: "2026-01-12", acopioId: "aco_2", items: [item({ id: "ix4", productoId: "p1", cantidad: 6, precioUnitario: 1000 })] }),
];
const notas = [NP1, NP2, ...ruidoNP];

const DP1 = dp({
  id: "dp_1",
  numero: "DP2 0001-00000002-1",
  fecha: "2026-01-20",
  items: [{ itemNPId: "i3", productoId: "p1", obraId: "obra_1", cantidad: 2, precioUnitario: 1000, subtotal: 2000 }],
  monto: -2000,
  remitoDevolucionId: "rd_1",
  notaCreditoId: "nc_1",
});
const devoluciones = [DP1, dp({ id: "dp_otro", numero: "DP2 0001-00000093-1", fecha: "2026-01-20", acopioId: "aco_2", items: [], monto: -6000 })];

const ACD1 = acd({ id: "acd_1", numero: "ACD2 0001-00000001", fecha: "2026-01-25", tipo: "TRASPASO_ENTRADA", monto: 1500, descripcion: "Se traspasa el saldo del AC2 0001-00000099" });
const ACD2 = acd({ id: "acd_2", numero: "ACD2 0001-00000002", fecha: "2026-01-26", monto: -500, descripcion: "Ajuste por diferencia" });
const ajustes = [ACD1, ACD2, acd({ id: "acd_otro", numero: "ACD2 0001-00000003", fecha: "2026-01-26", acopioId: "aco_2", monto: 9999 })];

const remitos: Remito[] = [
  remito({ id: "rm_1", numero: "RM2 00016-00000001", facturasRef: ["F2 0001-00000010"], items: [{ productoId: "p1", cantidad: 10, itemNPId: "i1" }, { productoId: "p2", cantidad: 3, itemNPId: "i2" }] }),
  // Mismo número (otra fila): no se duplica en la línea. Suma otra factura a i2.
  remito({ id: "rm_1b", numero: "RM2 00016-00000001", facturasRef: ["F2 0001-00000010", "F2 0001-00000011"], items: [{ productoId: "p2", cantidad: 2, itemNPId: "i2" }] }),
  remito({ id: "rm_anulado", numero: "RM2 00016-00000002", estado: "ANULADO", facturasRef: ["F2 0001-00000099"], items: [{ productoId: "p2", cantidad: 5, itemNPId: "i2" }] }),
  remito({ id: "rd_1", numero: "RD2 0008-00000001", tipo: "DEVOLUCION", items: [{ productoId: "p1", cantidad: 2 }] }),
];
const comprobantes: Comprobante[] = [comprobante({ id: "nc_1", tipo: "NOTA_CREDITO", numero: "NC2 0001-00000001", total: 2000, saldoPendiente: 0 })];
const ctx = { productos, obras, remitos, comprobantes };

// ───────────────────────── Tests ─────────────────────────

describe("notasDelAcopio", () => {
  it("toma solo los retiros del acopio que no están anulados ni en borrador", () => {
    expect(notasDelAcopio("aco_1", notas).map((n) => n.id)).toEqual(["np_1", "np_2"]);
  });
  it("una NP de venta con acopioId no cuenta como retiro", () => {
    expect(notasDelAcopio("aco_1", notas).some((n) => n.tipo === "VENTA")).toBe(false);
  });
});

describe("pendienteLinea", () => {
  it("es cantidad − entregados − devueltos", () => {
    expect(pendienteLinea({ cantidad: 5, entregados: 0, devueltos: 2 })).toBe(3);
    expect(pendienteLinea({ cantidad: 20, entregados: 5 })).toBe(15);
  });
  it("sin devueltos los toma como cero", () => {
    expect(pendienteLinea({ cantidad: 10, entregados: 4, devueltos: undefined })).toBe(6);
  });
  it("nunca da negativo (entregó o devolvió de más)", () => {
    expect(pendienteLinea({ cantidad: 10, entregados: 12 })).toBe(0);
    expect(pendienteLinea({ cantidad: 10, entregados: 8, devueltos: 5 })).toBe(0);
  });
  it("con todo entregado da cero", () => {
    expect(pendienteLinea({ cantidad: 10, entregados: 10, devueltos: 0 })).toBe(0);
  });
  it("respeta cantidades decimales (m³, toneladas)", () => {
    expect(pendienteLinea({ cantidad: 2.5, entregados: 1.25 })).toBeCloseTo(1.25, 10);
  });
});

describe("retiradoAcopio", () => {
  it("es Σ NP + Σ DP (las DP son negativas y restan de lo retirado)", () => {
    // 20.000 + 5.000 − 2.000
    expect(retiradoAcopio("aco_1", notas, devoluciones)).toBe(23_000);
  });
  it("sin movimientos da cero", () => {
    expect(retiradoAcopio("aco_x", notas, devoluciones)).toBe(0);
  });
  it("redondea a 3 decimales para no arrastrar error de coma flotante", () => {
    const n = [np({ id: "a", numero: "A", fecha: "2026-01-01", items: [], monto: 0.1 }), np({ id: "b", numero: "B", fecha: "2026-01-01", items: [], monto: 0.2 })];
    expect(retiradoAcopio("aco_1", n, [])).toBe(0.3);
  });
});

describe("saldoDisponible", () => {
  it("importe − Σ NP + Σ DP + Σ ACD con el escenario base", () => {
    // 100.000 − 25.000 + 2.000 + 1.500 − 500
    expect(saldoDisponible(acopio(), notas, devoluciones, ajustes)).toBe(78_000);
  });
  it("sin movimientos el saldo es el importe", () => {
    expect(saldoDisponible(acopio(), [], [], [])).toBe(100_000);
  });
  it("las DP (montos negativos) suman al saldo", () => {
    expect(saldoDisponible(acopio(), [NP2], [DP1], [])).toBe(100_000 - 5_000 + 2_000);
  });
  it("los ACD suman o restan según el signo", () => {
    expect(saldoDisponible(acopio(), [], [], [ACD1])).toBe(101_500);
    expect(saldoDisponible(acopio(), [], [], [ACD2])).toBe(99_500);
  });
  it("ignora NP anuladas, borradores, ventas y documentos de otros acopios", () => {
    expect(saldoDisponible(acopio(), ruidoNP, devoluciones.slice(1), ajustes.slice(2))).toBe(100_000);
  });
  it("puede quedar negativo si se autorizó un retiro de más", () => {
    const n = [np({ id: "a", numero: "A", fecha: "2026-01-01", items: [], monto: 100_250.5 })];
    expect(saldoDisponible(acopio(), n, [], [])).toBe(-250.5);
  });
  it("redondea a centavos", () => {
    const n = [np({ id: "a", numero: "A", fecha: "2026-01-01", items: [], monto: 3.333 })];
    expect(saldoDisponible(acopio({ importe: 10 }), n, [], [])).toBe(6.67);
  });
  it("un acopio consumido justo da 0 positivo (no −0)", () => {
    const n = [np({ id: "a", numero: "A", fecha: "2026-01-01", items: [], monto: 100_000 })];
    expect(Object.is(saldoDisponible(acopio(), n, [], []), 0)).toBe(true);
  });
});

describe("movimientosAcopio", () => {
  const grupos = movimientosAcopio(acopio(), notas, devoluciones, ajustes, ctx);

  it("arma un grupo por documento del acopio en orden cronológico", () => {
    expect(grupos.map((g) => [g.tipoDoc, g.numero])).toEqual([
      ["NP", "NP2 0001-00000001"],
      ["NP", "NP2 0001-00000002"],
      ["DP", "DP2 0001-00000002-1"],
      ["ACD", "ACD2 0001-00000001"],
      ["ACD", "ACD2 0001-00000002"],
    ]);
  });

  it("calcula el saldo corrido línea a línea", () => {
    expect(grupos.flatMap((g) => g.lineas.map((l) => l.saldoDisponible))).toEqual([90_000, 80_000, 75_000, 77_000, 78_500, 78_000]);
  });

  it("el último saldo corrido coincide con saldoDisponible", () => {
    expect(grupos.at(-1)!.lineas.at(-1)!.saldoDisponible).toBe(saldoDisponible(acopio(), notas, devoluciones, ajustes));
  });

  it("las líneas de NP traen código, artículo, obra, precio y pendiente", () => {
    const [l1, l2] = grupos[0].lineas;
    expect(l1).toMatchObject({ itemId: "i1", codigo: "200", descripcion: "HIERRO 8 MM", obra: "", cantidad: 10, entregados: 10, saldo: 0, precio: 1000, subtotal: 10_000 });
    expect(l2).toMatchObject({ itemId: "i2", codigo: "30", descripcion: "LADRILLO COMUN", cantidad: 20, entregados: 5, saldo: 15, precio: 500, subtotal: 10_000 });
    expect(grupos[1].lineas[0].obra).toBe("Lote 268");
  });

  it("OJO: el 'saldo' de la línea no descuenta los devueltos (pendienteLinea sí)", () => {
    // OJO: i3 tiene cantidad 5, entregados 0, devueltos 2 → pendienteLinea = 3, pero la línea muestra 5.
    const l3 = grupos[1].lineas[0];
    expect(l3.saldo).toBe(5);
    expect(pendienteLinea(NP2.items[0])).toBe(3);
  });

  it("asocia remitos sin repetir número, junta sus facturas e ignora los anulados", () => {
    const [l1, l2] = grupos[0].lineas;
    expect(l1.remitos).toEqual([{ id: "rm_1", numero: "RM2 00016-00000001" }]);
    expect(l1.facturas).toEqual(["F2 0001-00000010"]);
    expect(l2.remitos).toEqual([{ id: "rm_1", numero: "RM2 00016-00000001" }]);
    expect(l2.facturas).toEqual(["F2 0001-00000010", "F2 0001-00000011"]);
    expect(grupos[1].lineas[0].remitos).toEqual([]);
  });

  it("las DP van con precio y subtotal negativos, su remito de devolución y su nota de crédito", () => {
    const g = grupos[2];
    expect(g.monto).toBe(-2000);
    expect(g.lineas[0]).toMatchObject({ codigo: "200", cantidad: 2, entregados: 0, saldo: 2, precio: -1000, subtotal: -2000, obra: "Lote 268" });
    expect(g.lineas[0].remitos).toEqual([{ id: "rd_1", numero: "RD2 0008-00000001" }]);
    expect(g.lineas[0].facturas).toEqual(["NC2 0001-00000001"]);
  });

  it("una DP histórica sin remito ni NC usa los números de referencia y, sin subtotal, cantidad × precio", () => {
    const d = dp({
      id: "dp_h",
      numero: "DP2 0001-00000001-1",
      fecha: "2026-01-11",
      items: [{ itemNPId: "i2", productoId: "p2", cantidad: 4, precioUnitario: 500 }],
      monto: -2000,
      remitosRef: ["RD2 0008-00000077"],
      notasCreditoRef: ["NC2 0001-00000077"],
    });
    const [, dpG] = movimientosAcopio(acopio(), [NP1], [d], [], ctx);
    expect(dpG.lineas[0]).toMatchObject({ precio: -500, subtotal: -2000, remitos: [{ numero: "RD2 0008-00000077" }], facturas: ["NC2 0001-00000077"], saldoDisponible: 82_000 });
  });

  it("los ACD se muestran con el signo invertido (resta = suma al saldo) y una sola línea", () => {
    const [g1, g2] = grupos.slice(3);
    expect(g1.monto).toBe(-1500);
    expect(g1.lineas).toHaveLength(1);
    expect(g1.lineas[0]).toMatchObject({ descripcion: "Se traspasa el saldo del AC2 0001-00000099", cantidad: 1, precio: -1500, subtotal: -1500, remitos: [{ numero: "0" }] });
    expect(g2.monto).toBe(500);
    expect(g2.lineas[0].subtotal).toBe(500);
  });

  it("con la misma fecha ordena por número", () => {
    const a = np({ id: "a", numero: "NP2 0001-00000005", fecha: "2026-02-01", items: [item({ id: "x", productoId: "p1", cantidad: 1, precioUnitario: 1000 })] });
    const b = np({ id: "b", numero: "NP2 0001-00000004", fecha: "2026-02-01", items: [item({ id: "y", productoId: "p2", cantidad: 1, precioUnitario: 500 })] });
    const g = movimientosAcopio(acopio(), [a, b], [], [], ctx);
    expect(g.map((x) => x.numero)).toEqual(["NP2 0001-00000004", "NP2 0001-00000005"]);
    expect(g.map((x) => x.lineas[0].saldoDisponible)).toEqual([99_500, 98_500]);
  });

  it("acumula sin redondear y redondea solo al mostrar", () => {
    const its = [0.004, 0.004, 0.004].map((s, k) => item({ id: `r${k}`, productoId: "p1", cantidad: 1, precioUnitario: s, subtotal: s }));
    const g = movimientosAcopio(acopio({ importe: 1 }), [np({ id: "r", numero: "R", fecha: "2026-01-01", items: its })], [], [], ctx);
    // 1 − 0,004 = 0,996 → 1,00 · 0,992 → 0,99 · 0,988 → 0,99
    expect(g[0].lineas.map((l) => l.saldoDisponible)).toEqual([1, 0.99, 0.99]);
  });

  it("un producto que no está en el catálogo deja código y descripción vacíos", () => {
    const n = np({ id: "z", numero: "Z", fecha: "2026-01-01", items: [item({ id: "z1", productoId: "p_borrado", cantidad: 1, precioUnitario: 10 })] });
    const [g] = movimientosAcopio(acopio(), [n], [], [], ctx);
    expect(g.lineas[0]).toMatchObject({ codigo: "", descripcion: "" });
  });

  it("sin movimientos devuelve una lista vacía", () => {
    expect(movimientosAcopio(acopio(), [], [], [], ctx)).toEqual([]);
  });
});

describe("pendienteEntrega y montoPendienteEntrega", () => {
  it("lista las líneas con pendiente (cantidad − entregados − devueltos) al precio congelado", () => {
    expect(pendienteEntrega("aco_1", notas)).toEqual([
      { productoId: "p2", obraId: undefined, pendiente: 15, precio: 500, notaPedidoId: "np_1", itemId: "i2" },
      { productoId: "p1", obraId: "obra_1", pendiente: 3, precio: 1000, notaPedidoId: "np_2", itemId: "i3" },
    ]);
  });
  it("el monto pendiente es Σ pendiente × precio", () => {
    // 15 × 500 + 3 × 1000
    expect(montoPendienteEntrega("aco_1", notas)).toBe(10_500);
  });
  it("descarta líneas con pendiente menor a medio centavo", () => {
    const n = np({ id: "e", numero: "E", fecha: "2026-01-01", items: [item({ id: "e1", productoId: "p1", cantidad: 1, entregados: 0.996, precioUnitario: 1000 })] });
    expect(pendienteEntrega("aco_1", [n])).toEqual([]);
  });
  it("no cuenta NP anuladas, borradores ni de otros acopios", () => {
    expect(pendienteEntrega("aco_1", ruidoNP)).toEqual([]);
    expect(montoPendienteEntrega("aco_1", ruidoNP)).toBe(0);
  });
  it("OJO: el monto pendiente usa precio × cantidad e ignora el descuento de la línea", () => {
    // OJO: línea de 10 × 1000 con 10 % de descuento (subtotal 9.000) sin entregar → informa 10.000, no 9.000.
    const n = np({ id: "d", numero: "D", fecha: "2026-01-01", items: [item({ id: "d1", productoId: "p1", cantidad: 10, precioUnitario: 1000, descuentoPct: 10, subtotal: 9000 })] });
    expect(montoPendienteEntrega("aco_1", [n])).toBe(10_000);
  });
});

describe("resumenArticulos", () => {
  const remitosReserva: Remito[] = [
    ...remitos,
    remito({ id: "rm_pk", numero: "RM2 00016-00000010", estado: "PICKING", items: [{ productoId: "p2", cantidad: 4 }] }),
    remito({ id: "rm_ini", numero: "RM2 00016-00000011", estado: "INICIAL", items: [{ productoId: "p2", cantidad: 1 }] }),
    remito({ id: "rm_venta", numero: "RM2 00016-00000012", tipo: "VENTA", estado: "PICKING", items: [{ productoId: "p2", cantidad: 50 }] }),
    remito({ id: "rm_otro", numero: "RM2 00016-00000013", acopioId: "aco_2", estado: "PICKING", items: [{ productoId: "p2", cantidad: 60 }] }),
  ];
  const res = resumenArticulos(acopio(), notas, devoluciones, productos, remitosReserva);

  it("incluye toda la lista congelada ordenada por código numérico", () => {
    expect(res.map((r) => r.codigo)).toEqual(["30", "200", "1000"]);
  });
  it("saldo = −(retirado − devuelto), pendiente y devueltos por artículo", () => {
    const p1 = res.find((r) => r.productoId === "p1")!;
    expect(p1).toMatchObject({ articulo: "HIERRO 8 MM", precio: 1000, cantidad: 0, bajas: 0, devueltos: 2, pendiente: 3, saldo: -13 });
    const p2 = res.find((r) => r.productoId === "p2")!;
    expect(p2).toMatchObject({ precio: 500, devueltos: 0, pendiente: 15, saldo: -20 });
  });
  it("la cantidad es lo reservado en remitos de desacopio INICIAL o PICKING del acopio", () => {
    expect(res.find((r) => r.productoId === "p2")!.cantidad).toBe(5);
  });
  it("sin remitos la cantidad reservada es cero", () => {
    expect(resumenArticulos(acopio(), notas, devoluciones, productos).every((r) => r.cantidad === 0)).toBe(true);
  });
  it("un artículo sin retiros queda en cero", () => {
    const p3 = res.find((r) => r.productoId === "p3")!;
    expect(p3).toMatchObject({ cantidad: 0, devueltos: 0, pendiente: 0 });
    // OJO: el saldo de un artículo sin movimientos es −0 (no 0); toBe(0) fallaría.
    expect(Object.is(p3.saldo, -0)).toBe(true);
  });
  it("ignora los artículos retirados que no estén en la lista congelada", () => {
    const n = np({ id: "f", numero: "F", fecha: "2026-01-01", items: [item({ id: "f1", productoId: "p_fuera", cantidad: 3, precioUnitario: 10 })] });
    expect(resumenArticulos(acopio(), [n], [], productos).map((r) => r.productoId)).toEqual(["p2", "p1", "p3"]);
  });
});

describe("estadoDerivado", () => {
  const hoy = new Date(2026, 9, 9, 12, 0);
  it("VIGENTE con saldo y antes del vencimiento", () => {
    expect(estadoDerivado(acopio({ fechaVencimiento: "2026-12-31" }), hoy, 10_000)).toBe("VIGENTE");
  });
  it("el día del vencimiento todavía está VIGENTE", () => {
    expect(estadoDerivado(acopio({ fechaVencimiento: "2026-10-09" }), hoy, 10_000)).toBe("VIGENTE");
  });
  it("VENCIDO si pasó la fecha y le queda saldo", () => {
    expect(estadoDerivado(acopio({ fechaVencimiento: "2026-10-08" }), hoy, 10_000)).toBe("VENCIDO");
  });
  it("AGOTADO con saldo cero, negativo o menor a medio centavo", () => {
    expect(estadoDerivado(acopio(), hoy, 0)).toBe("AGOTADO");
    expect(estadoDerivado(acopio(), hoy, -150)).toBe("AGOTADO");
    expect(estadoDerivado(acopio(), hoy, 0.004)).toBe("AGOTADO");
    expect(estadoDerivado(acopio(), hoy, 0.01)).toBe("VIGENTE");
  });
  it("AGOTADO tiene prioridad sobre VENCIDO", () => {
    expect(estadoDerivado(acopio({ fechaVencimiento: "2026-01-01" }), hoy, 0)).toBe("AGOTADO");
  });
  it("CANCELADO se respeta aunque tenga saldo o esté vencido", () => {
    expect(estadoDerivado(acopio({ estado: "CANCELADO" }), hoy, 50_000)).toBe("CANCELADO");
    expect(estadoDerivado(acopio({ estado: "CANCELADO", fechaVencimiento: "2026-01-01" }), hoy, 0)).toBe("CANCELADO");
  });
  it("el estado guardado VENCIDO o AGOTADO se recalcula con el saldo actual", () => {
    expect(estadoDerivado(acopio({ estado: "AGOTADO" }), hoy, 5_000)).toBe("VIGENTE");
    expect(estadoDerivado(acopio({ estado: "VENCIDO", fechaVencimiento: "2026-12-31" }), hoy, 5_000)).toBe("VIGENTE");
  });
});

describe("diasParaVencer", () => {
  const hoy = new Date(2026, 9, 9, 18, 30);
  it("cuenta días de calendario hasta el vencimiento", () => {
    expect(diasParaVencer(acopio({ fechaVencimiento: "2026-10-19" }), hoy)).toBe(10);
    expect(diasParaVencer(acopio({ fechaVencimiento: "2026-10-10" }), hoy)).toBe(1);
  });
  it("da cero el mismo día y negativo si ya venció", () => {
    expect(diasParaVencer(acopio({ fechaVencimiento: "2026-10-09" }), hoy)).toBe(0);
    expect(diasParaVencer(acopio({ fechaVencimiento: "2026-10-01" }), hoy)).toBe(-8);
  });
  it("cruza fin de año", () => {
    expect(diasParaVencer(acopio({ fechaVencimiento: "2027-01-01" }), new Date(2026, 11, 31))).toBe(1);
  });
});

describe("pagadoAcopio", () => {
  const cmps = [
    comprobante({ id: "c1", numero: "F2 0001-00000001", total: 100_000, saldoPendiente: 40_000 }),
    comprobante({ id: "c2", numero: "F2 0001-00000002", total: 50_000, saldoPendiente: 0, estado: "ANULADO" }),
    comprobante({ id: "c3", numero: "F2 0001-00000003", total: 30_000, saldoPendiente: 0 }),
    comprobante({ id: "c4", numero: "F2 0001-00000004", total: 20_000, saldoPendiente: 0 }),
  ];
  it("suma total − saldo pendiente de sus comprobantes no anulados", () => {
    // c1: 60.000 · c2 anulado · c3 no es del acopio · c4: 20.000
    expect(pagadoAcopio({ comprobanteIds: ["c1", "c2", "c4"] }, cmps)).toBe(80_000);
  });
  it("sin comprobantes no hay nada pagado", () => {
    expect(pagadoAcopio({ comprobanteIds: [] }, cmps)).toBe(0);
  });
  it("una factura impaga en cuenta corriente aporta cero", () => {
    expect(pagadoAcopio({ comprobanteIds: ["x"] }, [comprobante({ id: "x", numero: "F", total: 10_000, saldoPendiente: 10_000, estado: "PENDIENTE" })])).toBe(0);
  });
});

describe("validarRetiro", () => {
  it("permite un retiro menor al saldo", () => {
    expect(validarRetiro(1000, 400)).toEqual({ ok: true, saldoAntes: 1000, saldoDespues: 600 });
  });
  it("permite retirar exactamente el saldo", () => {
    expect(validarRetiro(1000, 1000)).toMatchObject({ ok: true, saldoDespues: 0 });
  });
  it("rechaza si excede el saldo aunque sea por un centavo", () => {
    expect(validarRetiro(1000, 1000.01)).toMatchObject({ ok: false, saldoDespues: -0.01 });
    expect(validarRetiro(0, 500)).toMatchObject({ ok: false, saldoDespues: -500 });
  });
  it("tolera diferencias menores a medio centavo", () => {
    expect(validarRetiro(1000, 1000.004).ok).toBe(true);
  });
  it("redondea el saldo resultante a centavos", () => {
    expect(validarRetiro(0.3, 0.1).saldoDespues).toBe(0.2);
  });
  it("en cuenta corriente informa lo pagado y lo retirado incluyendo este retiro", () => {
    expect(validarRetiro(10_000, 400, { pagado: 5000, retirado: 3000, formaPago: "CUENTA_CORRIENTE" })).toEqual({
      ok: true,
      saldoAntes: 10_000,
      saldoDespues: 9600,
      pagado: 5000,
      retiradoTotal: 3400,
    });
  });
  it("OJO: retirar más de lo pagado en cuenta corriente no invalida el retiro (solo se informa)", () => {
    // OJO: la proporcionalidad a lo pagado no la aplica validarRetiro: ok depende solo del saldo.
    const v = validarRetiro(10_000, 500, { pagado: 1000, retirado: 900, formaPago: "CUENTA_CORRIENTE" });
    expect(v.ok).toBe(true);
    expect(v.retiradoTotal! > v.pagado!).toBe(true);
    expect(v.retiradoTotal).toBe(1400);
  });
  it("con anticipo no agrega pagado ni retirado", () => {
    const v = validarRetiro(10_000, 500, { pagado: 10_000, retirado: 0, formaPago: "ANTICIPO" });
    expect(v).not.toHaveProperty("pagado");
    expect(v).not.toHaveProperty("retiradoTotal");
  });
});

describe("precioCongelado", () => {
  it("devuelve precio y costo snapshot del producto", () => {
    expect(precioCongelado(acopio(), "p2")).toEqual({ productoId: "p2", precio: 500, costoSnapshot: 300 });
  });
  it("undefined si el producto no está en la lista congelada", () => {
    expect(precioCongelado(acopio(), "p_fuera")).toBeUndefined();
    expect(precioCongelado(acopio({ preciosCongelados: [] }), "p1")).toBeUndefined();
  });
});
