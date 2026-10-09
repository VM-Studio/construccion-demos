import { describe, expect, it } from "vitest";
import {
  calcularDisponible,
  calcularEnTransferencia,
  calcularEnTransito,
  calcularPendienteEntrega,
  calcularReservado,
  estaBajoMinimo,
  estadoStock,
  lineasPendientes,
  porRetirarAcopiosProveedor,
  reservadoPorLinea,
} from "@/domain/stock";
import { acopioProveedor, itemNP, itemOC, notaPedido, ordenCompra, remito, transferencia } from "./fixtures";

describe("reservadoPorLinea", () => {
  it("suma por línea de NP solo lo que está en remitos en PICKING", () => {
    const remitos = [
      remito("r1", [{ productoId: "p1", cantidad: 3, itemNPId: "i1" }]),
      remito("r2", [{ productoId: "p1", cantidad: 2, itemNPId: "i1" }, { productoId: "p2", cantidad: 5, itemNPId: "i2" }]),
      remito("r3", [{ productoId: "p1", cantidad: 100, itemNPId: "i1" }], { estado: "INICIAL" }),
      remito("r4", [{ productoId: "p1", cantidad: 100, itemNPId: "i1" }], { estado: "HECHO" }),
      remito("r5", [{ productoId: "p1", cantidad: 100, itemNPId: "i1" }], { estado: "ANULADO" }),
    ];
    const m = reservadoPorLinea(remitos);
    expect(m.get("i1")).toBe(5);
    expect(m.get("i2")).toBe(5);
    expect(m.size).toBe(2);
  });

  it("ignora los ítems sin línea de NP asociada", () => {
    const m = reservadoPorLinea([remito("r1", [{ productoId: "p1", cantidad: 4 }])]);
    expect(m.size).toBe(0);
  });

  it("sin remitos devuelve un mapa vacío", () => {
    expect(reservadoPorLinea([]).size).toBe(0);
  });
});

describe("lineasPendientes", () => {
  it("devuelve cantidad − entregados − devueltos de las NP activas", () => {
    const np = notaPedido("np1", [
      itemNP("i1", "p1", 10, { entregados: 3, devueltos: 2, precioUnitario: 150, obraId: "obra_1" }),
      itemNP("i2", "p2", 4, { entregados: 4 }),
    ]);
    const out = lineasPendientes([np], []);
    expect(out).toEqual([
      { notaPedidoId: "np1", itemId: "i1", clienteId: "cli_1", obraId: "obra_1", productoId: "p1", depositoId: "dep_1", pendiente: 5, precio: 150 },
    ]);
  });

  it("descuenta lo que ya está en picking para no contarlo dos veces", () => {
    const np = notaPedido("np1", [itemNP("i1", "p1", 10)]);
    const out = lineasPendientes([np], [remito("r1", [{ productoId: "p1", cantidad: 4, itemNPId: "i1" }])]);
    expect(out).toHaveLength(1);
    expect(out[0].pendiente).toBe(6);
  });

  it("no lista la línea si todo lo pendiente está en picking", () => {
    const np = notaPedido("np1", [itemNP("i1", "p1", 10, { entregados: 6 })]);
    expect(lineasPendientes([np], [remito("r1", [{ productoId: "p1", cantidad: 4, itemNPId: "i1" }])])).toEqual([]);
  });

  it("solo toma NP PENDIENTE y ENTREGADA_PARCIAL", () => {
    const estados = ["BORRADOR", "PENDIENTE", "ENTREGADA_PARCIAL", "ENTREGADA", "ANULADA"] as const;
    const notas = estados.map((e, k) => notaPedido(`np${k}`, [itemNP(`i${k}`, "p1", 1)], { estado: e }));
    expect(lineasPendientes(notas, []).map((l) => l.notaPedidoId)).toEqual(["np1", "np2"]);
  });

  it("descarta residuos menores a la tolerancia (0,0005)", () => {
    const np = notaPedido("np1", [itemNP("i1", "p1", 1, { entregados: 0.9996 }), itemNP("i2", "p1", 1, { entregados: 0.999 })]);
    const out = lineasPendientes([np], []);
    expect(out.map((l) => l.itemId)).toEqual(["i2"]);
    expect(out[0].pendiente).toBeCloseTo(0.001, 6);
  });

  it("si se entregó de más el pendiente no queda negativo", () => {
    const np = notaPedido("np1", [itemNP("i1", "p1", 5, { entregados: 7 })]);
    expect(lineasPendientes([np], [])).toEqual([]);
  });

  it("línea con cantidad 0 no aparece", () => {
    expect(lineasPendientes([notaPedido("np1", [itemNP("i1", "p1", 0)])], [])).toEqual([]);
  });

  it("usa el depósito de la NP, no el del remito", () => {
    const np = notaPedido("np1", [itemNP("i1", "p1", 10)], { depositoId: "dep_2" });
    const out = lineasPendientes([np], [remito("r1", [{ productoId: "p1", cantidad: 3, itemNPId: "i1" }], { depositoId: "dep_1" })]);
    expect(out[0]).toMatchObject({ depositoId: "dep_2", pendiente: 7 });
  });

  // OJO: lineasPendientes descuenta lo reservado de cualquier remito en PICKING con itemNPId,
  // sin mirar el tipo; calcularReservado, en cambio, solo cuenta VENTA y DESACOPIO. Un remito
  // DEVOLUCION/TRANSFERENCIA en picking con itemNPId bajaría el pendiente sin sumar reservado.
  it("descuenta lo reservado aunque el remito en picking no sea de venta ni desacopio", () => {
    const np = notaPedido("np1", [itemNP("i1", "p1", 10)]);
    const r = remito("r1", [{ productoId: "p1", cantidad: 4, itemNPId: "i1" }], { tipo: "DEVOLUCION" });
    expect(lineasPendientes([np], [r])[0].pendiente).toBe(6);
    expect(calcularReservado("p1", "dep_1", [r])).toBe(0);
  });
});

describe("calcularPendienteEntrega", () => {
  const notas = [
    notaPedido("np1", [itemNP("i1", "p1", 10, { entregados: 2 }), itemNP("i2", "p2", 5)]),
    notaPedido("np2", [itemNP("i3", "p1", 3)]),
    notaPedido("np3", [itemNP("i4", "p1", 50)], { depositoId: "dep_2" }),
    notaPedido("np4", [itemNP("i5", "p1", 50)], { estado: "ENTREGADA" }),
  ];

  it("suma el pendiente del producto en el depósito pedido", () => {
    expect(calcularPendienteEntrega("p1", "dep_1", notas, [])).toBe(11);
    expect(calcularPendienteEntrega("p1", "dep_2", notas, [])).toBe(50);
    expect(calcularPendienteEntrega("p2", "dep_1", notas, [])).toBe(5);
  });

  it("descuenta lo que está en picking", () => {
    const r = remito("r1", [{ productoId: "p1", cantidad: 3, itemNPId: "i3" }]);
    expect(calcularPendienteEntrega("p1", "dep_1", notas, [r])).toBe(8);
  });

  it("producto sin ventas da 0", () => {
    expect(calcularPendienteEntrega("p9", "dep_1", notas, [])).toBe(0);
  });
});

describe("calcularReservado", () => {
  it("suma ítems del producto en remitos de VENTA y DESACOPIO en PICKING del depósito", () => {
    const remitos = [
      remito("r1", [{ productoId: "p1", cantidad: 2 }, { productoId: "p2", cantidad: 9 }]),
      remito("r2", [{ productoId: "p1", cantidad: 3 }], { tipo: "DESACOPIO" }),
      remito("r3", [{ productoId: "p1", cantidad: 100 }], { tipo: "TRANSFERENCIA" }),
      remito("r4", [{ productoId: "p1", cantidad: 100 }], { tipo: "DEVOLUCION" }),
      remito("r5", [{ productoId: "p1", cantidad: 100 }], { depositoId: "dep_2" }),
      remito("r6", [{ productoId: "p1", cantidad: 100 }], { estado: "INICIAL" }),
      remito("r7", [{ productoId: "p1", cantidad: 100 }], { estado: "HECHO" }),
      remito("r8", [{ productoId: "p1", cantidad: 100 }], { estado: "ANULADO" }),
    ];
    expect(calcularReservado("p1", "dep_1", remitos)).toBe(5);
    expect(calcularReservado("p2", "dep_1", remitos)).toBe(9);
  });

  it("sin remitos da 0", () => {
    expect(calcularReservado("p1", "dep_1", [])).toBe(0);
  });
});

describe("calcularEnTransito", () => {
  it("suma lo pedido menos lo recibido de OC CONFIRMADA y RECIBIDA_PARCIAL al depósito", () => {
    const ocs = [
      ordenCompra("oc1", [itemOC("a", "p1", 100, 0), itemOC("b", "p2", 7)]),
      ordenCompra("oc2", [itemOC("c", "p1", 50, 20)], { estado: "RECIBIDA_PARCIAL" }),
      ordenCompra("oc3", [itemOC("d", "p1", 999)], { estado: "BORRADOR" }),
      ordenCompra("oc4", [itemOC("e", "p1", 999)], { estado: "ENVIADA" }),
      ordenCompra("oc5", [itemOC("f", "p1", 999, 999)], { estado: "RECIBIDA" }),
      ordenCompra("oc6", [itemOC("g", "p1", 999)], { estado: "CANCELADA" }),
      ordenCompra("oc7", [itemOC("h", "p1", 999)], { depositoDestinoId: "dep_2" }),
    ];
    expect(calcularEnTransito("p1", "dep_1", ocs)).toBe(130);
    expect(calcularEnTransito("p2", "dep_1", ocs)).toBe(7);
  });

  it("si se recibió de más no resta (mínimo 0 por línea)", () => {
    const ocs = [ordenCompra("oc1", [itemOC("a", "p1", 10, 15), itemOC("b", "p1", 4, 0)], { estado: "RECIBIDA_PARCIAL" })];
    expect(calcularEnTransito("p1", "dep_1", ocs)).toBe(4);
  });
});

describe("porRetirarAcopiosProveedor", () => {
  it("pactado − pedido en OC (no borrador ni cancelada) de acopios por cantidad", () => {
    const acopios = [acopioProveedor("acp1", { items: [{ productoId: "p1", cantidadPactada: 2000 }] })];
    const ocs = [
      ordenCompra("oc1", [itemOC("a", "p1", 500)], { acopioProveedorId: "acp1", origen: "ACOPIO" }),
      ordenCompra("oc2", [itemOC("b", "p1", 300, 300)], { acopioProveedorId: "acp1", estado: "RECIBIDA" }),
      ordenCompra("oc3", [itemOC("c", "p1", 999)], { acopioProveedorId: "acp1", estado: "BORRADOR" }),
      ordenCompra("oc4", [itemOC("d", "p1", 999)], { acopioProveedorId: "acp1", estado: "CANCELADA" }),
      ordenCompra("oc5", [itemOC("e", "p1", 999)]),
    ];
    expect(porRetirarAcopiosProveedor("p1", "dep_1", acopios, ocs)).toBe(1200);
  });

  it("ignora acopios por monto, cancelados o de otro depósito", () => {
    const items = [{ productoId: "p1", cantidadPactada: 100 }];
    const acopios = [
      acopioProveedor("a1", { items, modalidad: "MONTO" }),
      acopioProveedor("a2", { items, estado: "CANCELADO" }),
      acopioProveedor("a3", { items, depositoDestinoId: "dep_2" }),
    ];
    expect(porRetirarAcopiosProveedor("p1", "dep_1", acopios, [])).toBe(0);
  });

  it("si se pidió más de lo pactado no da negativo", () => {
    const acopios = [acopioProveedor("acp1", { items: [{ productoId: "p1", cantidadPactada: 100 }] })];
    const ocs = [ordenCompra("oc1", [itemOC("a", "p1", 150)], { acopioProveedorId: "acp1" })];
    expect(porRetirarAcopiosProveedor("p1", "dep_1", acopios, ocs)).toBe(0);
  });

  it("producto no pactado o acopio sin ítems da 0", () => {
    const acopios = [acopioProveedor("acp1", { items: [{ productoId: "p2", cantidadPactada: 100 }] }), acopioProveedor("acp2", { items: undefined })];
    expect(porRetirarAcopiosProveedor("p1", "dep_1", acopios, [])).toBe(0);
  });
});

describe("calcularEnTransferencia", () => {
  const trs = [
    transferencia("t1", [{ productoId: "p1", cantidad: 5 }, { productoId: "p2", cantidad: 1 }]),
    transferencia("t2", [{ productoId: "p1", cantidad: 3 }], { depositoDestinoId: "dep_3" }),
    transferencia("t3", [{ productoId: "p1", cantidad: 100 }], { estado: "PENDIENTE" }),
    transferencia("t4", [{ productoId: "p1", cantidad: 100 }], { estado: "RECIBIDA" }),
    transferencia("t5", [{ productoId: "p1", cantidad: 100 }], { estado: "CANCELADA" }),
  ];

  it("sin depósito suma todas las transferencias EN_TRANSITO", () => {
    expect(calcularEnTransferencia("p1", trs)).toBe(8);
  });

  it("con depósito filtra por destino", () => {
    expect(calcularEnTransferencia("p1", trs, "dep_2")).toBe(5);
    expect(calcularEnTransferencia("p1", trs, "dep_3")).toBe(3);
    expect(calcularEnTransferencia("p1", trs, "dep_1")).toBe(0);
  });
});

describe("calcularDisponible", () => {
  it("físico − pendiente de entrega − reservado", () => {
    expect(calcularDisponible(100, 30, 20)).toBe(50);
  });

  it("reservado por defecto es 0", () => {
    expect(calcularDisponible(100, 30)).toBe(70);
  });

  it("puede quedar negativo si está todo comprometido", () => {
    expect(calcularDisponible(10, 8, 5)).toBe(-3);
  });

  it("con todo en cero da 0", () => {
    expect(calcularDisponible(0, 0, 0)).toBe(0);
  });

  it("de punta a punta: picking no se descuenta dos veces", () => {
    // NP de 10, 4 ya en picking: pendiente 6 + reservado 4 = 10 comprometidas.
    const notas = [notaPedido("np1", [itemNP("i1", "p1", 10)])];
    const remitos = [remito("r1", [{ productoId: "p1", cantidad: 4, itemNPId: "i1" }])];
    const pend = calcularPendienteEntrega("p1", "dep_1", notas, remitos);
    const res = calcularReservado("p1", "dep_1", remitos);
    expect(calcularDisponible(25, pend, res)).toBe(15);
  });
});

describe("estaBajoMinimo", () => {
  it("es true si el físico está por debajo del mínimo", () => {
    expect(estaBajoMinimo({ stockMinimo: 10 }, 9)).toBe(true);
  });

  it("igual al mínimo no está bajo mínimo", () => {
    expect(estaBajoMinimo({ stockMinimo: 10 }, 10)).toBe(false);
  });

  it("mínimo 0 nunca está bajo mínimo, aunque el físico sea negativo", () => {
    expect(estaBajoMinimo({ stockMinimo: 0 }, -5)).toBe(false);
  });
});

describe("estadoStock", () => {
  it("SIN_STOCK con físico 0 o negativo", () => {
    expect(estadoStock({ stockMinimo: 10 }, 0)).toBe("SIN_STOCK");
    expect(estadoStock({ stockMinimo: 0 }, 0)).toBe("SIN_STOCK");
    expect(estadoStock({ stockMinimo: 0 }, -1)).toBe("SIN_STOCK");
  });

  it("BAJO_MINIMO con físico positivo por debajo del mínimo", () => {
    expect(estadoStock({ stockMinimo: 10 }, 0.5)).toBe("BAJO_MINIMO");
  });

  it("OK en el mínimo o arriba", () => {
    expect(estadoStock({ stockMinimo: 10 }, 10)).toBe("OK");
    expect(estadoStock({ stockMinimo: 0 }, 1)).toBe("OK");
  });
});
