/**
 * Ejercita los flujos de negocio completos sobre el store y verifica la integridad
 * al final: `pnpm flujos:check`.
 */
import { useStore } from "../src/store";
import { crearSeed } from "../src/data/seed";
import { verificarIntegridad } from "../src/domain/integridad";
import { posicionesDe } from "../src/store/selectors";

const s = () => useStore.getState();
let fallas = 0;
function paso<T>(nombre: string, r: { ok: true; data: T } | { ok: false; error: string; codigo?: string }): T {
  if (!r.ok) {
    fallas++;
    console.log(`  ✘ ${nombre}: ${r.error}`);
    return undefined as T;
  }
  console.log(`  ✔ ${nombre}`);
  return r.data;
}
function check(nombre: string, cond: boolean, detalle = "") {
  if (!cond) fallas++;
  console.log(`  ${cond ? "✔" : "✘"} ${nombre}${detalle ? ` — ${detalle}` : ""}`);
}

useStore.setState({ db: crearSeed(new Date()), hidratado: true });
s().login("usr_martin");
const hoy = new Date().toISOString();
const pos = (pid: string, dep: string) => posicionesDe(s().db).get(pid)!.porDeposito[dep];

console.log("\n1) Compras: OC → confirmar → en tránsito → recepción parcial → recepción total");
{
  const prod = s().db.productos.find((p) => p.proveedorHabitualId === "prov_04")!;
  const antes = pos(prod.id, "dep_norte");
  const costoPromAntes = prod.costoPromedio;
  const ocId = paso("Crear OC", s().guardarOC({ proveedorId: "prov_04", depositoDestinoId: "dep_norte", sucursalId: "suc_norte", fechaEmision: hoy, fechaEntregaEstimada: hoy, items: [{ id: "i1", productoId: prod.id, cantidadPedida: 100, cantidadRecibida: 0, costoUnitario: Math.round(prod.costoUltimo * 1.08), descuentoPct: 0 }] }));
  paso("Enviar", s().cambiarEstadoOC(ocId, "ENVIADA"));
  paso("Confirmar", s().cambiarEstadoOC(ocId, "CONFIRMADA"));
  check("Stock en tránsito +100", pos(prod.id, "dep_norte").enTransito === antes.enTransito + 100);
  const oc = s().db.ordenesCompra.find((o) => o.id === ocId)!;
  const r1 = paso("Recepción parcial (60)", s().recibirMercaderia({ ordenCompraId: ocId, remitoProveedor: "R-0001-00012345", fecha: hoy, depositoId: "dep_norte", items: [{ itemOCId: oc.items[0].id, cantidad: 60, costoUnitario: oc.items[0].costoUnitario, diferencia: "OK" }] }));
  check("Aviso de suba de costo", (r1?.avisos.length ?? 0) > 0, r1?.avisos[0] ? `${(r1.avisos[0].subaPct * 100).toFixed(1)} %` : "");
  check("OC RECIBIDA_PARCIAL", s().db.ordenesCompra.find((o) => o.id === ocId)!.estado === "RECIBIDA_PARCIAL");
  check("Físico +60", pos(prod.id, "dep_norte").fisico === antes.fisico + 60);
  check("Costo promedio cambió", s().db.productos.find((p) => p.id === prod.id)!.costoPromedio !== costoPromAntes);
  paso("Recepción del resto (40)", s().recibirMercaderia({ ordenCompraId: ocId, remitoProveedor: "R-0001-00012399", fecha: hoy, depositoId: "dep_norte", items: [{ itemOCId: oc.items[0].id, cantidad: 40, costoUnitario: oc.items[0].costoUnitario, diferencia: "OK" }] }));
  check("OC RECIBIDA", s().db.ordenesCompra.find((o) => o.id === ocId)!.estado === "RECIBIDA");
  check("Deuda con proveedor", s().db.comprobantes.filter((c) => c.proveedorId === "prov_04" && c.saldoPendiente > 0).length > 0);
}

console.log("\n2) Ventas: presupuesto → pedido → confirmar → despacho → hoja de ruta → entrega → factura → cobro parcial → cobro total");
{
  const prod = s().db.productos.find((p) => p.nombre.startsWith("Cemento Portland normal"))!;
  const preId = paso("Crear presupuesto", s().guardarPresupuesto({ clienteId: "cli_01", sucursalId: "suc_norte", vendedorId: "usr_carla", fecha: hoy, validezDias: 7, descuentoPct: 0, items: [{ id: "x1", productoId: prod.id, cantidad: 42, precioUnitario: 13000, costoUnitarioSnapshot: 0, descuentoPct: 0 }] }));
  paso("Enviar presupuesto", s().cambiarEstadoPresupuesto(preId, "ENVIADO"));
  const pedId = paso("Convertir en pedido", s().convertirEnPedido(preId));
  const antes = pos(prod.id, "dep_norte");
  paso("Confirmar pedido", s().confirmarPedido(pedId, { permitirBackorder: true, autorizarExcepcion: true }));
  check("Comprometido +42", pos(prod.id, "dep_norte").comprometido === antes.comprometido + 42);
  const ped = s().db.pedidos.find((p) => p.id === pedId)!;
  check("Snapshot de costo congelado", ped.items[0].costoUnitarioSnapshot > 0);
  const des = paso("Generar despacho", s().generarDespachoPedido(pedId));
  paso("Asignar a hoja de ruta", s().asignarAHojaRuta(des.despachoId, "veh_1", hoy));
  const hoja = s().db.hojasRuta.find((h) => h.despachoIds.includes(des.despachoId))!;
  paso("Iniciar recorrido", s().iniciarRecorrido(hoja.id));
  check("Físico −42 y comprometido −42", pos(prod.id, "dep_norte").fisico === antes.fisico - 42 && pos(prod.id, "dep_norte").comprometido === antes.comprometido);
  paso("Marcar entregado", s().marcarEntregado(des.despachoId, { fecha: hoy, recibio: "Encargado" }));
  check("Pedido DESPACHADO", s().db.pedidos.find((p) => p.id === pedId)!.estado === "DESPACHADO");
  paso("Cerrar hoja", s().cerrarHojaRuta(hoja.id));
  const cmpId = paso("Facturar", s().facturarPedido(pedId, { tipo: "FACTURA_A", fecha: hoy, vencimiento: hoy }));
  const c = s().db.comprobantes.find((x) => x.id === cmpId)!;
  paso("Cobro parcial", s().registrarCobranza({ clienteId: "cli_01", fecha: hoy, medios: [{ medio: "CHEQUE", importe: 100000, banco: "Galicia", numeroCheque: "123", fechaCobro: hoy }], imputaciones: [{ comprobanteId: cmpId, importe: 100000 }] }));
  check("Comprobante PARCIAL", s().db.comprobantes.find((x) => x.id === cmpId)!.estado === "PARCIAL");
  paso("Cobro del resto", s().registrarCobranza({ clienteId: "cli_01", fecha: hoy, medios: [{ medio: "TRANSFERENCIA", importe: c.total - 100000 }], imputaciones: [{ comprobanteId: cmpId, importe: c.total - 100000 }] }));
  check("Comprobante PAGADO", s().db.comprobantes.find((x) => x.id === cmpId)!.estado === "PAGADO");
}

console.log("\n3) Entrega parcial: reingresa el resto y crea nuevo despacho");
{
  const prod = s().db.productos.find((p) => p.nombre.startsWith("Cal hidratada"))!;
  const pedId = paso("Pedido", s().guardarPedido({ clienteId: "cli_03", sucursalId: "suc_norte", depositoId: "dep_norte", vendedorId: "usr_carla", fecha: hoy, items: [{ id: "y", productoId: prod.id, cantidad: 20, precioUnitario: 6000, costoUnitarioSnapshot: 0, descuentoPct: 0 }], descuentoPct: 0, condicionPago: "CTA_CTE_30", modalidadEntrega: "ENVIO", direccionEntrega: "Ruta 25" }));
  paso("Confirmar", s().confirmarPedido(pedId, { permitirBackorder: true, autorizarExcepcion: true }));
  const d = paso("Despacho", s().generarDespachoPedido(pedId));
  paso("Preparar", s().prepararDespacho(d.despachoId));
  paso("Despachar", s().despacharDespacho(d.despachoId, "veh_2", "cho_2"));
  const nuevo = paso("Entrega parcial (12 de 20)", s().marcarEntregado(d.despachoId, { fecha: hoy, recibio: "Capataz", cantidades: [12] }));
  check("Nuevo despacho con 8", s().db.despachos.find((x) => x.id === nuevo)?.items[0].cantidad === 8);
  check("Pedido DESPACHADO_PARCIAL", s().db.pedidos.find((p) => p.id === pedId)!.estado === "DESPACHADO_PARCIAL");
}

console.log("\n4) Acopio: crear → retiro con envío → despachar → canje → retiro mostrador → cancelar saldo");
{
  const prodA = s().db.productos.find((p) => p.nombre.startsWith("Cemento Portland normal"))!;
  const prodB = s().db.productos.find((p) => p.nombre.startsWith("Cal hidratada"))!;
  const r = paso("Crear acopio", s().crearAcopio({ clienteId: "cli_10", sucursalId: "suc_norte", depositoId: "dep_norte", vendedorId: "usr_carla", fechaInicio: hoy, fechaVencimiento: hoy, condicionPago: "ANTICIPO", items: [{ productoId: prodA.id, cantidad: 100, precio: 12000 }] }));
  const fc = s().db.comprobantes.find((c) => c.id === r.comprobanteId)!;
  paso("Cobro 50 %", s().registrarCobranza({ clienteId: "cli_10", fecha: hoy, medios: [{ medio: "TRANSFERENCIA", importe: fc.total / 2 }], imputaciones: [{ comprobanteId: fc.id, importe: fc.total / 2 }] }));
  const a = s().db.acopios.find((x) => x.id === r.acopioId)!;
  check("Monto pagado 50 %", Math.abs(a.montoPagado - fc.total / 2) < 1);
  s().login("usr_carla");
  const bloqueado = s().registrarRetiroAcopio({ acopioId: a.id, fecha: hoy, items: [{ itemAcopioId: a.items[0].id, cantidad: 80 }], modalidad: "ENVIO" });
  check("Ventas no puede retirar más de lo pagado", !bloqueado.ok);
  s().login("usr_martin");
  const ret = paso("Retiro 30 con envío", s().registrarRetiroAcopio({ acopioId: a.id, fecha: hoy, items: [{ itemAcopioId: a.items[0].id, cantidad: 30 }], modalidad: "ENVIO" }));
  const antes = pos(prodA.id, "dep_norte");
  paso("Despachar retiro", s().despacharDespacho(ret.despachoId, "veh_1", "cho_1"));
  check("Egreso de acopio", pos(prodA.id, "dep_norte").fisico === antes.fisico - 30 && pos(prodA.id, "dep_norte").comprometido === antes.comprometido - 30);
  paso("Entregado", s().marcarEntregado(ret.despachoId, { fecha: hoy, recibio: "Obra" }));
  const precioCal = s().db.precios.find((p) => p.productoId === prodB.id && p.listaPreciosId === "lst_may")!.precio;
  paso("Canjear 10 bolsas de cemento por cal", s().canjearProducto(a.id, { itemAcopioId: a.items[0].id, cantidadOrigen: 10, productoDestinoId: prodB.id, precioDestino: precioCal }));
  const a2 = s().db.acopios.find((x) => x.id === a.id)!;
  paso("Retiro en mostrador de la cal", s().registrarRetiroAcopio({ acopioId: a.id, fecha: hoy, items: [{ itemAcopioId: a2.items[1].id, cantidad: 5 }], modalidad: "RETIRA", autorizarSinPago: true }));
  paso("Cancelar saldo", s().cancelarSaldoAcopio(a.id));
  check("Acopio CANCELADO", s().db.acopios.find((x) => x.id === a.id)!.estado === "CANCELADO");
}

console.log("\n5) Stock: transferencia y ajuste");
{
  const prod = s().db.productos.find((p) => p.nombre.startsWith("Ladrillo hueco 12"))!;
  const t = paso("Transferencia Norte → Sur", s().crearTransferencia({ depositoOrigenId: "dep_norte", depositoDestinoId: "dep_sur", items: [{ productoId: prod.id, cantidad: 144 }] }));
  paso("Despachar", s().despacharTransferencia(t.id));
  check("En tránsito entre depósitos", posicionesDe(s().db).get(prod.id)!.enTransferencia >= 144);
  paso("Recibir", s().recibirTransferencia(t.id));
  paso("Ajuste negativo por rotura", s().crearAjuste({ depositoId: "dep_sur", items: [{ productoId: prod.id, cantidad: 10, signo: -1, motivo: "ROTURA" }], observacion: "Rotura" }));
}

console.log("\n6) Anulación con nota de crédito y pago a proveedor con cheque de cartera");
{
  const fact = s().db.comprobantes.find((c) => c.clienteId && c.pedidoId && c.estado === "PENDIENTE" && (c.tipo === "FACTURA_A" || c.tipo === "FACTURA_B"))!;
  paso("Anular factura", s().anularComprobante(fact.id));
  const fp = s().db.comprobantes.find((c) => c.proveedorId && c.saldoPendiente > 0)!;
  const ch = s().db.cheques.find((c) => c.estado === "EN_CARTERA" && c.importe < fp.saldoPendiente);
  const medios = ch
    ? [{ medio: ch.tipo, importe: ch.importe, chequeId: ch.id, banco: ch.banco, numeroCheque: ch.numero, fechaCobro: ch.fechaCobro }, { medio: "TRANSFERENCIA" as const, importe: fp.saldoPendiente - ch.importe }]
    : [{ medio: "TRANSFERENCIA" as const, importe: fp.saldoPendiente }];
  paso("Pago a proveedor", s().registrarPagoProveedor({ proveedorId: fp.proveedorId!, fecha: hoy, medios, imputaciones: [{ comprobanteId: fp.id, importe: fp.saldoPendiente }] }));
  check("Factura de proveedor pagada", s().db.comprobantes.find((c) => c.id === fp.id)!.estado === "PAGADO");
}

console.log("\n7) Permisos");
{
  s().login("usr_jorge");
  check("Depósito no puede crear pedidos", !s().guardarPedido({ clienteId: "cli_01", sucursalId: "suc_sur", depositoId: "dep_sur", vendedorId: "usr_jorge", fecha: hoy, items: [], descuentoPct: 0, condicionPago: "CONTADO", modalidadEntrega: "RETIRA" }).ok);
  s().login("usr_pablo");
  check("Ventas no puede ajustar stock", !s().crearAjuste({ depositoId: "dep_sur", items: [] }).ok);
}

console.log("\nIntegridad final");
const res = verificarIntegridad(s().db);
for (const c of res.chequeos) {
  console.log(`  ${c.ok ? "✔" : "✘"} ${c.nombre} — ${c.detalle}`);
  for (const e of c.errores.slice(0, 8)) console.log(`      · ${e}`);
}
if (!res.ok) fallas++;
console.log(fallas ? `\n✘ ${fallas} fallas\n` : "\n✔ Todos los flujos OK\n");
process.exit(fallas ? 1 : 0);
