/**
 * Ejercita los flujos de negocio de Aceros RNF sobre el store y verifica la integridad
 * al final: `pnpm flujos:check`.
 */
import "./shim-storage";
import { useStore } from "../src/store";
import { crearSeed } from "../src/data/seed";
import { verificarIntegridad } from "../src/domain/integridad";
import { saldoDisponible } from "../src/domain/acopios";
import { pendienteRetirar } from "../src/domain/acopiosProveedor";
import { posicionesDe, acopiosResumenDe } from "../src/store/selectors";
import { minutosPreparacion } from "../src/domain/despachos";
import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { generarCUIT } from "../src/domain/cuit";
import { seedBase } from "../src/data/seed";
import { mapearColumnas, validarArchivo } from "../src/domain/importacion";
import { calcularActualizacionMasiva } from "../src/domain/precios";
import { pasosCargaInicial } from "../src/domain/cargaInicial";
import { prerequisitos } from "../src/domain/prerequisitos";

const s = () => useStore.getState();
let fallas = 0;
function paso<T>(nombre: string, r: { ok: true; data: T } | { ok: false; error: string; codigo?: string }, esperaError?: string): T {
  if (esperaError) {
    const ok = !r.ok && (r as { codigo?: string }).codigo === esperaError;
    if (!ok) fallas++;
    console.log(`  ${ok ? "✔" : "✘"} ${nombre}${!r.ok ? ` — ${r.error}` : " — no bloqueó"}`);
    return undefined as T;
  }
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
s().login("usr_felipe");
const hoy = new Date().toISOString();
const pos = (pid: string, dep: string) => posicionesDe(s().db).get(pid)!.porDeposito[dep];
const saldoAco = (id: string) => saldoDisponible(s().db.acopios.find((a) => a.id === id)!, s().db.notasPedido, s().db.devoluciones, s().db.ajustesAcopio);
const HOLCIM = "prod_50104";

console.log("\n1) Retiro de acopio (Ramos): 40 bolsas Holcim a precio congelado → saldo → remito picking → hecho → remito firmado");
{
  const ramos = s().db.acopios.find((a) => a.numero === "AC2 0001-00003633")!;
  const antes = saldoAco(ramos.id);
  const input = {
    clienteId: ramos.clienteId, sucursalId: ramos.sucursalId, depositoId: ramos.depositoId, fecha: hoy, circuito: 2 as const, origen: "ACOPIO" as const, acopioId: ramos.id, formaPago: "ACOPIO" as const,
    items: [{ productoId: HOLCIM, obraId: "obra_ramos_2", cantidad: 40, precioUnitario: 1 }], descuentoPct: 0, pendienteEntrega: false, modalidadEntrega: "ENVIO" as const,
  };
  s().login("usr_lucas");
  paso("Vendedor: retiro que supera el saldo se bloquea", s().crearNotaPedido(input), "SALDO_ACOPIO");
  s().login("usr_felipe");
  const npId = paso("Dueño: confirma con autorización", s().crearNotaPedido(input, { autorizarSaldoNegativo: true }));
  const np = s().db.notasPedido.find((n) => n.id === npId)!;
  check("Precio congelado $ 982,87 y circuito AC2", np.items[0].precioUnitario === 982.87 && np.circuito === 2, np.numero);
  check("Saldo baja 40 × 982,87", Math.abs(saldoAco(ramos.id) - (antes - 39314.8)) < 0.01, `${antes} → ${saldoAco(ramos.id)}`);
  const fis = pos(HOLCIM, "dep_central").fisico;
  const rem = paso("Generar remito (picking)", s().generarRemito(npId, { estado: "PICKING" }));
  check("Reservado +40", pos(HOLCIM, "dep_central").reservado >= 40);
  paso("Marcar hecho", s().marcarRemitoHecho(rem.id));
  check("Físico −40", pos(HOLCIM, "dep_central").fisico === fis - 40);
  check("NP entregada", s().db.notasPedido.find((n) => n.id === npId)!.estado === "ENTREGADA");
  paso("Subir remito firmado (metadata)", s().registrarAdjunto({ entidadTipo: "REMITO", entidadId: rem.id, nombre: "firmado.jpg", tamanoBytes: 120_000, tipoMime: "image/jpeg", categoria: "REMITO_FIRMADO", blobKey: "test" }));
  check("Remito con firmado", !!s().db.remitos.find((r) => r.id === rem.id)!.firmadoAdjuntoId);
}

console.log("\n2) Control de sobreventa: físico 500, pendiente 420 → disponible 80");
{
  // Se repone el caso: el paso 1 consumió 40 de disponible. Medimos el disponible actual.
  const d0 = pos(HOLCIM, "dep_central");
  check("Disponible = físico − pendiente − reservado", d0.disponible === d0.fisico - d0.pendiente - d0.reservado, `físico ${d0.fisico} · pendiente ${d0.pendiente} · disponible ${d0.disponible}`);
  const venta = {
    clienteId: "cli_bencen", sucursalId: "suc_central", depositoId: "dep_central", fecha: hoy, circuito: 1 as const, origen: "NUEVA" as const, formaPago: "CUENTA_CORRIENTE" as const,
    items: [{ productoId: HOLCIM, obraId: "obra_bencen_1", cantidad: d0.disponible + 20, precioUnitario: 14000 }], descuentoPct: 0, pendienteEntrega: true, modalidadEntrega: "ENVIO" as const,
  };
  s().login("usr_lucas");
  paso("Vendedor: venta mayor al disponible se bloquea", s().crearNotaPedido(venta), "SIN_DISPONIBLE");
  s().login("usr_felipe");
  // Programar la entrega de una NP pendiente (Enjinia, 300 bolsas) → espera → preparación → finalizado
  const np = s().db.notasPedido.find((n) => n.clienteId === "cli_enjinia" && n.items.some((i) => i.productoId === HOLCIM && i.cantidad === 300))!;
  const des = paso("Programar entrega", s().crearDespacho({ notaPedidoId: np.id, modalidad: "RETIRA" }));
  check("Despacho en ESPERA", s().db.despachos.find((d) => d.id === des.id)!.estado === "ESPERA");
  const disp = pos(HOLCIM, "dep_central").disponible;
  paso("Iniciar preparación", s().iniciarPreparacion(des.id, "Playa 1"));
  check("Remito en picking (reservado 300)", pos(HOLCIM, "dep_central").reservado >= 300);
  paso("Finalizar", s().finalizarDespacho(des.id));
  const d1 = pos(HOLCIM, "dep_central");
  check("Pendiente baja, físico baja, disponible igual", d1.disponible === disp, `físico ${d1.fisico} · pendiente ${d1.pendiente} · disponible ${d1.disponible}`);
  const d = s().db.despachos.find((x) => x.id === des.id)!;
  check("Despacho FINALIZADO con tiempos", d.estado === "FINALIZADO" && minutosPreparacion(d) !== null);
}

console.log("\n3) Venta nueva contado → remito hecho (retira) → factura F1 → cobro");
{
  const prod = "prod_81001";
  const npId = paso("Confirmar venta", s().crearNotaPedido({ clienteId: "cli_ortiz", sucursalId: "suc_central", depositoId: "dep_central", fecha: hoy, circuito: 1, origen: "NUEVA", formaPago: "CONTADO", items: [{ productoId: prod, obraId: "obra_ortiz_1", cantidad: 2, precioUnitario: 26000 }], descuentoPct: 0, pendienteEntrega: false, modalidadEntrega: "RETIRA" }));
  paso("Retiro en mostrador", s().retiroEnMostrador(npId));
  const fac = paso("Facturar F1", s().facturarNotaPedido(npId));
  check("Factura F1 con letra B (consumidor final)", fac?.numero.startsWith("F1 ") && s().db.comprobantes.find((c) => c.id === fac.id)!.letra === "B", fac?.numero);
  const c = s().db.comprobantes.find((x) => x.id === fac.id)!;
  paso("Cobro", s().registrarCobranza({ clienteId: "cli_ortiz", circuito: 1, fecha: hoy, medios: [{ medio: "EFECTIVO", importe: c.total }], imputaciones: [{ comprobanteId: c.id, importe: c.total }] }));
  check("Factura pagada", s().db.comprobantes.find((x) => x.id === fac.id)!.estado === "PAGADO");
  paso("Facturar retiro de acopio se bloquea", s().facturarNotaPedido(s().db.notasPedido.find((n) => n.origen === "ACOPIO")!.id).ok ? { ok: false, error: "no bloqueó" } : { ok: true, data: null });
}

console.log("\n4) Devolución: DP + RD (reingresa stock) + NC; en acopio el saldo vuelve");
{
  const np = s().db.notasPedido.find((n) => n.origen === "ACOPIO" && n.acopioId !== "aco_ramos_3633" && n.estado === "ENTREGADA" && n.items.some((i) => i.entregados >= 2))!;
  const it = np.items.find((i) => i.entregados >= 2)!;
  const saldo0 = saldoAco(np.acopioId!);
  const fis0 = pos(it.productoId, np.depositoId).fisico;
  const r = paso("Registrar devolución", s().registrarDevolucion({ notaPedidoId: np.id, items: [{ itemId: it.id, cantidad: 2 }], motivo: "Sobrante de obra" }));
  check("Número DP heredado de la NP", r?.numero.startsWith(`DP${np.circuito} ${np.numero.split(" ")[1]}-`), r?.numero);
  check("Stock reingresa", pos(it.productoId, np.depositoId).fisico === fis0 + 2);
  check("Saldo del acopio sube", Math.abs(saldoAco(np.acopioId!) - (saldo0 + 2 * it.precioUnitario)) < 0.01);
}

console.log("\n5) Acopio nuevo (anticipo) + traspaso de saldo");
{
  const a = paso("Crear acopio SP2 por $ 5M", s().crearAcopio({ clienteId: "cli_sp2", sucursalId: "suc_central", depositoId: "dep_central", fechaCreacion: hoy, fechaVencimiento: new Date(Date.now() + 180 * 86400000).toISOString(), circuito: 1, obraIds: ["obra_sp2_1"], importe: 5_000_000, alicuotaIIBBPct: 0, formaPago: "ANTICIPO", listaPreciosBaseId: "lst_may", unidadNegocioId: "un_cor", medios: [{ medio: "TRANSFERENCIA", importe: 5_000_000 }] }));
  const nuevo = s().db.acopios.find((x) => x.id === a.id)!;
  check("Congela toda la lista de la unidad", nuevo.preciosCongelados.length === s().db.productos.filter((p) => p.unidadNegocioId === "un_cor").length, `${nuevo.preciosCongelados.length} precios`);
  check("Factura y recibo pagados", s().db.comprobantes.find((c) => c.id === nuevo.comprobanteIds[0])!.estado === "PAGADO" && nuevo.reciboIds.length === 1);
  const viejo = s().db.acopios.find((x) => x.clienteId === "cli_sp2" && x.id !== a.id)!;
  const s0 = saldoAco(viejo.id);
  const t = paso("Traspasar $ 1.000.000", s().traspasarSaldo(viejo.id, a.id, 1_000_000));
  check("ACD de salida y entrada", Math.abs(saldoAco(viejo.id) - (s0 - 1_000_000)) < 0.01 && Math.abs(saldoAco(a.id) - 6_000_000) < 0.01, `${t?.salida} / ${t?.entrada}`);
  check("Descripción automática", s().db.ajustesAcopio.at(-1)!.descripcion.includes("Se traspasa el saldo del"), s().db.ajustesAcopio.at(-1)!.descripcion);
}

console.log("\n6) Acopio con proveedor (Loma Negra): OC origen acopio 400 bolsas → recepción → pendiente baja, sin deuda nueva");
{
  const acp = s().db.acopiosProveedor.find((a) => a.proveedorId === "prov_01")!;
  const pend0 = pendienteRetirar(acp, s().db.ordenesCompra).porProducto[0].pendiente;
  const deuda0 = s().db.comprobantes.filter((c) => c.proveedorId === "prov_01").reduce((x, c) => x + c.saldoPendiente, 0);
  const fis0 = pos("prod_50101", "dep_central").fisico;
  const ocId = paso("Crear OC origen acopio", s().guardarOC({ proveedorId: "prov_01", circuito: 1, origen: "ACOPIO", acopioProveedorId: acp.id, depositoDestinoId: "dep_central", sucursalId: "suc_central", fechaEmision: hoy, fechaEntregaEstimada: hoy, items: [{ id: "i1", productoId: "prod_50101", cantidadPedida: 400, cantidadRecibida: 0, costoUnitario: 1, descuentoPct: 0 }] }));
  const oc = s().db.ordenesCompra.find((o) => o.id === ocId)!;
  check("Costo congelado aplicado", oc.items[0].costoUnitario === acp.preciosCongelados.find((c) => c.productoId === "prod_50101")!.costo);
  paso("Enviar", s().cambiarEstadoOC(ocId, "ENVIADA"));
  paso("Confirmar", s().cambiarEstadoOC(ocId, "CONFIRMADA"));
  paso("Recepción", s().recibirMercaderia({ ordenCompraId: ocId, remitoProveedor: "R 0004-00099887", fecha: hoy, depositoId: "dep_central", items: [{ itemOCId: oc.items[0].id, cantidad: 400, costoUnitario: oc.items[0].costoUnitario, diferencia: "OK" }] }));
  const acp1 = s().db.acopiosProveedor.find((a) => a.id === acp.id)!;
  check("Pendiente de retirar −400", pendienteRetirar(acp1, s().db.ordenesCompra).porProducto[0].pendiente === pend0 - 400);
  check("Stock +400", pos("prod_50101", "dep_central").fisico === fis0 + 400);
  check("Sin deuda nueva", Math.abs(s().db.comprobantes.filter((c) => c.proveedorId === "prov_01").reduce((x, c) => x + c.saldoPendiente, 0) - deuda0) < 0.01);
  paso("Excede lo pactado se bloquea", s().guardarOC({ proveedorId: "prov_01", circuito: 1, origen: "ACOPIO", acopioProveedorId: acp.id, depositoDestinoId: "dep_central", sucursalId: "suc_central", fechaEmision: hoy, fechaEntregaEstimada: hoy, items: [{ id: "i1", productoId: "prod_50101", cantidadPedida: 5000, cantidadRecibida: 0, costoUnitario: 1, descuentoPct: 0 }] }).ok ? { ok: false, error: "no bloqueó" } : { ok: true, data: null });
}

console.log("\n7) Acopio con proveedor en cuenta corriente → orden de pago parcial");
{
  const acp = s().db.acopiosProveedor.find((a) => a.proveedorId === "prov_02")!;
  const fac = s().db.comprobantes.find((c) => c.id === acp.comprobanteCompraIds[0])!;
  const pagado0 = acp.pagado;
  paso("Orden de pago $ 2M", s().registrarPagoProveedor({ proveedorId: "prov_02", circuito: 1, fecha: hoy, medios: [{ medio: "TRANSFERENCIA", importe: 2_000_000 }], imputaciones: [{ comprobanteId: fac.id, importe: 2_000_000 }] }));
  check("Pagado sube y deuda baja", s().db.acopiosProveedor.find((a) => a.id === acp.id)!.pagado === pagado0 + 2_000_000);
}

console.log("\n8) Cobro de cuota de acopio en cuenta corriente (Naku)");
{
  const r = acopiosResumenDe(s().db).find((x) => x.acopio.clienteId === "cli_naku")!;
  const fac = s().db.comprobantes.find((c) => c.id === r.acopio.comprobanteIds[0])!;
  paso("Recibo RC2", s().registrarCobranza({ clienteId: "cli_naku", circuito: 2, fecha: hoy, medios: [{ medio: "TRANSFERENCIA", importe: 1_000_000 }], imputaciones: [{ comprobanteId: fac.id, importe: 1_000_000 }] }));
  check("Pagado del acopio sube", acopiosResumenDe(s().db).find((x) => x.acopio.id === r.acopio.id)!.pagado === r.pagado + 1_000_000);
}

console.log("\n9) Integridad final");
{
  const res = verificarIntegridad(s().db);
  for (const c of res.chequeos) {
    check(c.nombre, c.ok, c.detalle);
    for (const e of c.errores.slice(0, 5)) console.log(`      · ${e}`);
  }
}

console.log("\n10) Desde el sistema vacío: importar → precios → proveedor → OC → ingreso → cliente y obra → acopio → retiro → remito → hecho → cobro");
{
  useStore.setState({ db: seedBase(new Date()) });
  s().login("usr_felipe");
  check("Arranca vacío y NP pide cliente y artículo con precio", prerequisitos("notasPedido", s().db).length === 2);
  const csv = (f: string) => Papa.parse<Record<string, unknown>>(readFileSync(`public/plantillas/${f}`, "utf8").replace(/^\uFEFF/, ""), { header: true, skipEmptyLines: true });
  for (const [archivo, n] of [["articulos-ejemplo-corralon.csv", 40], ["articulos-ejemplo-ferreteria.csv", 30]] as const) {
    const p = csv(archivo);
    const filas = validarArchivo("articulos", p.data, mapearColumnas("articulos", p.meta.fields ?? []), s().db);
    check(`${archivo}: ${n} filas válidas`, filas.length === n && filas.every((f) => f.ok), filas.filter((f) => !f.ok).map((f) => f.errores.join(" ")).slice(0, 2).join(" | "));
    paso(`Importar ${n} artículos`, s().importarArticulos(filas.map((f) => f.datos!)));
  }
  check("70 artículos y stock en 0", s().db.productos.length === 70 && s().db.stock.every((x) => x.cantidadFisica === 0));
  const listas = s().db.listasPrecios.map((l) => l.id);
  const cambios = calcularActualizacionMasiva(s().db.precios, s().db.productos, { productoIds: s().db.productos.map((p) => p.id), listaIds: listas }, { tipo: "MARKUP", markups: Object.fromEntries(s().db.listasPrecios.map((l) => [l.id, l.markupPorDefecto])) }, 10);
  paso("Calcular precios desde costo + markup", s().aplicarCambiosPrecios(cambios, "Recalculado desde costo + markup"));
  check("Paso «Precios» de la guía tildado", pasosCargaInicial(s().db).find((x) => x.id === "precios")!.hecho);
  const provId = paso("Crear proveedor", s().guardarProveedor({ codigo: "", razonSocial: "Cementos del Plata S.A.", tipo: "FABRICANTE", cuit: generarCUIT("30", 52087399), condicionIVA: "RI", circuitoHabitual: 1, email: "", telefono: "", direccion: "", contacto: "", plazoEntregaDias: 5, condicionPago: "CTA_CTE_30", unidadNegocioIds: ["un_cor"], activo: true }));
  const cemento = s().db.productos.find((p) => p.unidad === "BOLSA" && p.unidadNegocioId === "un_cor")!;
  const ocId = paso("OC por 400 bolsas", s().guardarOC({ proveedorId: provId, circuito: 1, origen: "NUEVA", depositoDestinoId: "dep_central", sucursalId: "suc_central", fechaEmision: hoy, fechaEntregaEstimada: hoy, items: [{ id: "i1", productoId: cemento.id, cantidadPedida: 400, cantidadRecibida: 0, costoUnitario: 9800, descuentoPct: 0 }] }));
  paso("Enviar OC", s().cambiarEstadoOC(ocId, "ENVIADA"));
  paso("Confirmar OC", s().cambiarEstadoOC(ocId, "CONFIRMADA"));
  check("En tránsito 0 → 400", pos(cemento.id, "dep_central").enTransito === 400);
  const oc = s().db.ordenesCompra.find((o) => o.id === ocId)!;
  paso("Ingreso de mercadería", s().recibirMercaderia({ ordenCompraId: ocId, remitoProveedor: "R 0001-00000001", facturaProveedor: "A 0001-00000001", fecha: hoy, depositoId: "dep_central", items: [{ itemOCId: oc.items[0].id, cantidad: 400, costoUnitario: 9800, diferencia: "OK" }] }));
  check("Físico 400, en tránsito 0", pos(cemento.id, "dep_central").fisico === 400 && pos(cemento.id, "dep_central").enTransito === 0);
  const deuda = s().db.comprobantes.filter((c) => c.proveedorId === provId).reduce((a, c) => a + c.saldoPendiente, 0);
  check("Le debemos = $ 3.920.000 + IVA", Math.abs(deuda - 400 * 9800 * 1.21) < 1, String(deuda));
  paso("Inventario inicial con costo en Sucursal 2", s().crearAjuste({ depositoId: "dep_2", items: [{ productoId: cemento.id, cantidad: 100, signo: 1, motivo: "INVENTARIO_INICIAL", costoUnitario: 9500 }] }));
  check("Físico en Sucursal 2 = 100", pos(cemento.id, "dep_2").fisico === 100);
  const cliId = paso("Crear cliente", s().guardarCliente({ codigo: "", razonSocial: "Constructora del Sur S.R.L.", tipo: "CONSTRUCTORA", cuit: generarCUIT("30", 71234599), condicionIVA: "RI", circuitoHabitual: 2, email: "", telefono: "", direccion: "", localidad: "", listaPreciosId: "lst_may", condicionPago: "CTA_CTE_30", limiteCredito: 10_000_000, sucursalPreferidaId: "suc_central", activo: true }));
  const obraId = paso("Crear obra", s().guardarObra({ clienteId: cliId, nombre: "Edificio Boedo", activa: true }));
  const acoId = paso("Acopio por $ 4.500.000", s().crearAcopio({ clienteId: cliId, sucursalId: "suc_central", depositoId: "dep_central", fechaCreacion: hoy, fechaVencimiento: new Date(Date.now() + 180 * 86400000).toISOString(), circuito: 2, obraIds: [obraId], importe: 4_500_000, alicuotaIIBBPct: 0, formaPago: "ANTICIPO", listaPreciosBaseId: "lst_may", unidadNegocioId: "un_cor", medios: [{ medio: "TRANSFERENCIA", importe: 4_500_000 }] })).id;
  check("Saldo del acopio $ 4.500.000", saldoAco(acoId) === 4_500_000);
  const npId = paso("Retiro de 40 bolsas", s().crearNotaPedido({ clienteId: cliId, sucursalId: "suc_central", depositoId: "dep_central", fecha: hoy, circuito: 2, origen: "ACOPIO", acopioId: acoId, formaPago: "ACOPIO", items: [{ productoId: cemento.id, obraId, cantidad: 40, precioUnitario: 1 }], descuentoPct: 0, pendienteEntrega: false, modalidadEntrega: "RETIRA" }));
  check("Pendiente +40 y disponible 400 → 360", pos(cemento.id, "dep_central").pendiente === 40 && pos(cemento.id, "dep_central").disponible === 360);
  check("Saldo del acopio baja", saldoAco(acoId) < 4_500_000);
  const rem = paso("Remito en picking", s().generarRemito(npId, { estado: "PICKING" }));
  check("Reservado +40", pos(cemento.id, "dep_central").reservado === 40);
  paso("Remito hecho", s().marcarRemitoHecho(rem.id));
  const p2 = pos(cemento.id, "dep_central");
  check("Físico 400 → 360, pendiente y reservado en 0", p2.fisico === 360 && p2.pendiente === 0 && p2.reservado === 0);
  paso("Saldo inicial de cliente", s().cargarSaldoInicial({ tipo: "cliente", entidadId: cliId, importe: 250_000, fecha: hoy, circuito: 1 }));
  const si = s().db.comprobantes.find((c) => c.tipo === "SALDO_INICIAL")!;
  paso("Cobro del saldo inicial", s().registrarCobranza({ clienteId: cliId, circuito: 1, fecha: hoy, medios: [{ medio: "EFECTIVO", importe: 250_000 }], imputaciones: [{ comprobanteId: si.id, importe: 250_000 }] }));
  check("Guía de carga inicial completa", pasosCargaInicial(s().db).every((x) => x.hecho), pasosCargaInicial(s().db).filter((x) => !x.hecho).map((x) => x.titulo).join(", "));
  const res = verificarIntegridad(s().db);
  check("Integridad desde vacío", res.ok, res.chequeos.filter((c) => !c.ok).map((c) => c.errores[0]).join(" | "));
  paso("Cargar datos de ejemplo con datos: pide confirmación", s().cargarDatosEjemplo(), "HAY_DATOS");
  paso("Reemplazar por datos de ejemplo", s().cargarDatosEjemplo({ reemplazar: true }));
  check("Ejemplo cargado", s().db.productos.length > 100);
  s().resetearDemo();
  check("Vaciar deja solo estructura", !s().db.productos.length && !s().db.clientes.length && s().db.usuarios.length === 4 && s().ui.usuarioId === "usr_felipe");
}

if (fallas) {
  console.error(`\n✘ ${fallas} verificaciones fallaron.\n`);
  process.exit(1);
}
console.log("\n✔ Todos los flujos verificados.\n");
