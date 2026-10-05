/**
 * Generador de operaciones semilla: compras, ventas, acopios, despachos,
 * transferencias, ajustes, cobranzas y pagos — todas coherentes entre sí.
 * El stock y los movimientos NO se inventan acá: se derivan después con
 * `generarMovimientosDesdeOperaciones()`.
 */
import { parseISO } from "date-fns";
import type {
  Acopio,
  AjusteStock,
  Auditoria,
  Cheque,
  Cliente,
  Cobranza,
  Comprobante,
  Despacho,
  EstadoDespacho,
  EstadoPedido,
  HojaRuta,
  ItemAcopio,
  ItemOC,
  ItemVenta,
  ListaPrecios,
  MedioCobro,
  MedioPago,
  OrdenCompra,
  PagoProveedor,
  Pedido,
  Presupuesto,
  Producto,
  Proveedor,
  RecepcionMercaderia,
  RetiroAcopio,
  TipoCliente,
  TransferenciaStock,
} from "@/domain/types";
import { calcularTotales, diasCondicionPago, tipoFacturaPara } from "@/domain/ventas";
import { estadoPorSaldo } from "@/domain/cuentasCorrientes";
import { formatearNumero, formatearNumeroFiscal, type EntidadNumerada } from "@/domain/numeracion";
import type { ProductoSpec } from "./catalogo";
import { type Calendario, type Random, redondear } from "./util";

const IVA = 21;

export interface CtxOperaciones {
  R: Random;
  cal: Calendario;
  productos: Producto[];
  specs: Map<string, ProductoSpec>;
  clientes: Cliente[];
  proveedores: Proveedor[];
  listas: ListaPrecios[];
}

export interface Operaciones {
  ordenesCompra: OrdenCompra[];
  recepciones: RecepcionMercaderia[];
  presupuestos: Presupuesto[];
  pedidos: Pedido[];
  comprobantes: Comprobante[];
  acopios: Acopio[];
  retiros: RetiroAcopio[];
  despachos: Despacho[];
  hojasRuta: HojaRuta[];
  transferencias: TransferenciaStock[];
  ajustes: AjusteStock[];
  cobranzas: Cobranza[];
  pagosProveedores: PagoProveedor[];
  cheques: Cheque[];
  auditoria: Auditoria[];
  /** Costo por producto antes del período (para el inventario inicial). */
  costoInicial: Map<string, number>;
}

const BANCOS = ["Banco Galicia", "Banco Nación", "Banco Provincia", "Santander", "BBVA", "Macro", "Credicoop", "ICBC"];

export function generarOperaciones(ctx: CtxOperaciones): Operaciones {
  const { R, cal, productos, specs, clientes, proveedores, listas } = ctx;
  const hoy = cal.hoy;
  const ahora = new Date();
  let seq = 0;
  const id = (p: string) => `${p}_${String(++seq).padStart(5, "0")}`;
  const meta = (iso: string) => ({ creadoEn: iso, actualizadoEn: iso });
  const prod = new Map(productos.map((p) => [p.id, p]));
  const cli = new Map(clientes.map((c) => [c.id, c]));
  const markup = new Map(listas.map((l) => [l.id, l.markupPorDefecto]));
  const depDeSucursal = (s: string) => (s === "suc_norte" ? "dep_norte" : "dep_sur");
  const pvDeSucursal = (s: string) => (s === "suc_norte" ? "0001" : "0002");
  /** ISO de un offset de días, sin pasarse de "ahora" si es hoy. */
  const momento = (off: number, h: number, m = 0) => {
    const iso = cal.dia(off, h, m);
    if (off === 0 && parseISO(iso) > ahora) return new Date(ahora.getTime() - 20 * 60_000).toISOString();
    return iso;
  };
  const offDe = (iso: string) => Math.floor((parseISO(iso).getTime() - hoy.getTime()) / 86_400_000);

  // ── Curvas de costo y precio (inflación ~2,4 % mensual) ──
  const costAt = (productoId: string, off: number) => {
    const s = specs.get(productoId)!;
    return redondear(s.costo * (1 + 0.0008 * off), s.costo > 5000 ? 10 : 1);
  };
  const precioAt = (productoId: string, listaId: string, off: number) =>
    redondear(costAt(productoId, off) * (1 + (markup.get(listaId) ?? 30) / 100), 10);

  const costoInicial = new Map(productos.map((p) => [p.id, costAt(p.id, -125)]));

  const auditoria: Auditoria[] = [];
  const audit = (fecha: string, usuarioId: string, accion: string, entidad: string, entidadId: string, detalle: string) =>
    auditoria.push({ id: id("aud"), fecha, usuarioId, accion, entidad, entidadId, detalle, ...meta(fecha) });

  // ── Pools de productos por tipo de cliente ──
  const porRubro = (...rubros: string[]) => productos.filter((p) => rubros.includes(p.rubroId)).map((p) => p.id);
  const gruesos = porRubro("rub_gru");
  const pools: Record<TipoCliente, string[]> = {
    CORRALON: [...gruesos, ...gruesos, ...productos.filter((p) => p.unidad === "BOLSA" || p.rubroId === "rub_imp").map((p) => p.id), ...porRubro("rub_her").slice(-2)],
    CONSTRUCTORA: [...gruesos, ...gruesos, ...porRubro("rub_sec"), ...porRubro("rub_san").slice(4, 9), ...porRubro("rub_ais")],
    ARQUITECTO: [...porRubro("rub_pis"), ...porRubro("rub_pis"), ...porRubro("rub_san"), ...porRubro("rub_gri"), ...porRubro("rub_sec").slice(0, 3), ...porRubro("rub_imp")],
    PARTICULAR: [...gruesos.slice(0, 13), ...porRubro("rub_pis"), ...porRubro("rub_san").slice(0, 4), ...porRubro("rub_gri"), ...porRubro("rub_her"), ...porRubro("rub_imp").slice(0, 2)],
  };

  const qtyPara = (productoId: string, tipo: TipoCliente): number => {
    const s = specs.get(productoId)!;
    const r = (a: number, b: number) => R.int(a, b);
    switch (s.perfil) {
      case "granel": {
        const u = s.pallet ?? 50;
        const [a, b] = { CORRALON: [1, 3], CONSTRUCTORA: [2, 5], ARQUITECTO: [0.5, 1.5], PARTICULAR: [0.2, 0.8] }[tipo];
        const q = u * R.float(a, b);
        return Math.max(1, u >= 100 ? redondear(q, 10) : Math.round(q));
      }
      case "medio":
        if (s.unidad === "M3") return { CORRALON: r(6, 12), CONSTRUCTORA: r(10, 24), ARQUITECTO: r(3, 6), PARTICULAR: r(1, 4) }[tipo];
        return { CORRALON: r(20, 60), CONSTRUCTORA: r(40, 120), ARQUITECTO: r(10, 40), PARTICULAR: r(4, 20) }[tipo];
      case "m2":
        return { CORRALON: r(40, 100), CONSTRUCTORA: r(120, 300), ARQUITECTO: r(30, 120), PARTICULAR: r(20, 60) }[tipo];
      case "unidad":
        return { CORRALON: r(2, 6), CONSTRUCTORA: r(6, 16), ARQUITECTO: r(2, 6), PARTICULAR: r(1, 3) }[tipo];
      default:
        return { CORRALON: r(5, 20), CONSTRUCTORA: r(10, 30), ARQUITECTO: r(3, 10), PARTICULAR: r(1, 5) }[tipo];
    }
  };

  const crearItemsVenta = (cliente: Cliente, off: number, n?: number): ItemVenta[] => {
    const lineas = n ?? { CORRALON: R.int(3, 6), CONSTRUCTORA: R.int(4, 7), ARQUITECTO: R.int(3, 6), PARTICULAR: R.int(2, 5) }[cliente.tipo];
    const elegidos = R.sample([...new Set(pools[cliente.tipo])], lineas);
    return elegidos.map((pid) => ({
      id: id("itv"),
      productoId: pid,
      cantidad: qtyPara(pid, cliente.tipo),
      precioUnitario: precioAt(pid, cliente.listaPreciosId, off),
      costoUnitarioSnapshot: 0,
      descuentoPct: R.chance(0.2) ? R.pick([3, 5]) : 0,
      cantidadDespachada: 0,
    }));
  };

  // ════════════════════════ COMPRAS ════════════════════════
  const ordenesCompra: OrdenCompra[] = [];
  const recepciones: RecepcionMercaderia[] = [];
  const comprobantes: Comprobante[] = [];
  const pagosProveedores: PagoProveedor[] = [];

  type PlanOC = { off: number; prov: string; estado: OrdenCompra["estado"]; recepciones?: number[]; parcial?: boolean; dep: string };
  const planesOC: PlanOC[] = [
    { off: -115, prov: "prov_01", estado: "RECIBIDA", dep: "dep_norte" },
    { off: -104, prov: "prov_03", estado: "RECIBIDA", dep: "dep_norte" },
    { off: -96, prov: "prov_06", estado: "RECIBIDA", dep: "dep_sur" },
    { off: -88, prov: "prov_04", estado: "RECIBIDA", dep: "dep_norte", recepciones: [7, 12] },
    { off: -75, prov: "prov_08", estado: "RECIBIDA", dep: "dep_norte" },
    { off: -62, prov: "prov_05", estado: "RECIBIDA", dep: "dep_sur" },
    { off: -50, prov: "prov_02", estado: "RECIBIDA", dep: "dep_sur" },
    { off: -38, prov: "prov_09", estado: "RECIBIDA", dep: "dep_norte" },
    { off: -26, prov: "prov_07", estado: "RECIBIDA", dep: "dep_norte" },
    { off: -20, prov: "prov_10", estado: "RECIBIDA_PARCIAL", dep: "dep_sur", parcial: true },
    { off: -12, prov: "prov_06", estado: "RECIBIDA_PARCIAL", dep: "dep_norte", parcial: true },
    { off: -14, prov: "prov_04", estado: "CONFIRMADA", dep: "dep_norte" },
    { off: -10, prov: "prov_03", estado: "CONFIRMADA", dep: "dep_sur" },
    { off: -3, prov: "prov_05", estado: "CONFIRMADA", dep: "dep_norte" },
    { off: -1, prov: "prov_08", estado: "CONFIRMADA", dep: "dep_sur" },
    { off: -2, prov: "prov_02", estado: "BORRADOR", dep: "dep_norte" },
    { off: 0, prov: "prov_09", estado: "BORRADOR", dep: "dep_sur" },
  ];
  // Un tercer borrador para reposición sugerida
  planesOC.push({ off: -1, prov: "prov_07", estado: "BORRADOR", dep: "dep_sur" });

  const qtyCompra = (pid: string) => {
    const s = specs.get(pid)!;
    if (s.perfil === "granel") return (s.pallet ?? 50) * R.int(4, 10);
    if (s.perfil === "medio") return s.unidad === "M3" ? R.int(18, 36) : R.int(60, 200);
    if (s.perfil === "m2") return R.int(20, 50) * 10;
    if (s.perfil === "unidad") return R.int(6, 18);
    return R.int(20, 60);
  };
  const usuarioDeposito = (dep: string) => (dep === "dep_sur" ? "usr_jorge" : "usr_diego");

  for (const plan of planesOC) {
    const prov = proveedores.find((p) => p.id === plan.prov)!;
    const prodsProv = productos.filter((p) => p.proveedorHabitualId === prov.id).map((p) => p.id);
    const elegidos = R.sample(prodsProv, Math.min(prodsProv.length, R.int(3, 6)));
    const emision = momento(plan.off, R.int(9, 12), R.int(0, 59));
    const confirmadaSinRecibir = plan.estado === "CONFIRMADA" || plan.estado === "BORRADOR";
    const items: ItemOC[] = elegidos.map((pid) => ({
      id: id("ioc"),
      productoId: pid,
      cantidadPedida: qtyCompra(pid),
      cantidadRecibida: 0,
      // Las OC abiertas ya traen la lista nueva del proveedor (+5 %): dispara el aviso de suba de costo al recibir.
      costoUnitario: confirmadaSinRecibir ? redondear(specs.get(pid)!.costo * 1.05, 10) : costAt(pid, plan.off),
      descuentoPct: R.chance(0.25) ? R.pick([2, 3, 5]) : 0,
    }));
    const tot = totalesOC(items);
    const oc: OrdenCompra = {
      id: id("oc"),
      numero: "",
      proveedorId: prov.id,
      depositoDestinoId: plan.dep,
      sucursalId: plan.dep === "dep_norte" ? "suc_norte" : "suc_sur",
      estado: plan.estado,
      fechaEmision: emision,
      fechaEntregaEstimada: cal.fecha(plan.off + prov.plazoEntregaDias),
      items,
      ...tot,
      observaciones: plan.estado === "BORRADOR" ? "Reposición sugerida por stock mínimo." : undefined,
      usuarioId: R.pick(["usr_laura", "usr_diego"]),
      ...meta(emision),
    };
    ordenesCompra.push(oc);
    audit(emision, oc.usuarioId, "Creó orden de compra", "OrdenCompra", oc.id, `${prov.razonSocial}`);
    if (plan.estado !== "BORRADOR") audit(emision, oc.usuarioId, "Confirmó orden de compra", "OrdenCompra", oc.id, "Enviada y confirmada por el proveedor");

    // Recepciones
    if (plan.estado === "RECIBIDA" || plan.estado === "RECIBIDA_PARCIAL") {
      const offsRec = plan.recepciones ?? [prov.plazoEntregaDias + R.int(0, 2)];
      offsRec.forEach((dOff, idx) => {
        const offRec = Math.min(-1, plan.off + dOff);
        const fechaRec = momento(offRec, R.int(8, 15), R.int(0, 59));
        const ultima = idx === offsRec.length - 1;
        const itemsRec = items
          .map((it) => {
            const pendiente = it.cantidadPedida - it.cantidadRecibida;
            let q = pendiente;
            if (offsRec.length > 1 && !ultima) q = Math.round(pendiente * 0.5);
            if (plan.parcial) q = it === items[items.length - 1] ? 0 : Math.round(pendiente * R.pick([0.5, 0.6, 1]));
            if (q <= 0) return null;
            it.cantidadRecibida += q;
            return {
              itemOCId: it.id,
              productoId: it.productoId,
              cantidadRecibida: q,
              costoUnitario: redondear(it.costoUnitario * (1 - it.descuentoPct / 100), 1),
              diferencia: "OK" as const,
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
        const rec: RecepcionMercaderia = {
          id: id("rcp"),
          numero: "",
          ordenCompraId: oc.id,
          depositoId: plan.dep,
          remitoProveedor: `R-${String(R.int(1, 9)).padStart(4, "0")}-${String(R.int(10000, 99999)).padStart(8, "0")}`,
          fecha: fechaRec,
          items: itemsRec,
          usuarioId: usuarioDeposito(plan.dep),
          ...meta(fechaRec),
        };
        // Factura del proveedor por lo recibido
        const neto = itemsRec.reduce((a, i) => a + i.cantidadRecibida * i.costoUnitario, 0);
        const fc: Comprobante = {
          id: id("cmp"),
          tipo: "FACTURA_A",
          numero: `${String(R.int(2, 12)).padStart(4, "0")}-${String(R.int(10000, 99999)).padStart(8, "0")}`,
          proveedorId: prov.id,
          recepcionId: rec.id,
          fecha: fechaRec,
          vencimiento: cal.fecha(offRec + diasCondicionPago(prov.condicionPago)),
          subtotal: r2(neto),
          iva: r2(neto * 0.21),
          total: r2(neto * 1.21),
          saldoPendiente: r2(neto * 1.21),
          estado: "PENDIENTE",
          ...meta(fechaRec),
        };
        rec.comprobanteId = fc.id;
        recepciones.push(rec);
        comprobantes.push(fc);
        audit(fechaRec, rec.usuarioId, "Registró recepción de mercadería", "RecepcionMercaderia", rec.id, `OC de ${prov.razonSocial} · remito ${rec.remitoProveedor}`);
      });
    }
  }

  // ════════════════════════ VENTAS ════════════════════════
  const pedidos: Pedido[] = [];
  const despachos: Despacho[] = [];
  type TipoDesp = "ENTREGADO" | "PARCIAL" | "HOY" | "MANANA" | "PASADO" | "EN_PREP_HOY" | "EN_VIAJE" | "ATRASADO" | "NINGUNO";
  type PlanPed = { off: number; estado: EstadoPedido; desp: TipoDesp; facturar: boolean; cliente?: string };

  const historicos: PlanPed[] = [];
  const offsHist = Array.from({ length: 29 }, (_, i) => Math.round(-118 + i * (112 / 28)));
  // Clientes con deuda vencida y rotación de clientes para cubrir a todos
  const rotacion = [
    "cli_01", "cli_09", "cli_12", "cli_17", "cli_02", "cli_06", "cli_04", "cli_13", "cli_10", "cli_18", "cli_08", "cli_03", "cli_14",
    "cli_19", "cli_05", "cli_07", "cli_21", "cli_11", "cli_15", "cli_20", "cli_08", "cli_16", "cli_01", "cli_22", "cli_04", "cli_23",
    "cli_24", "cli_14", "cli_02",
  ];
  offsHist.forEach((off, i) => {
    let estado: EstadoPedido = "FACTURADO";
    let desp: TipoDesp = "ENTREGADO";
    let facturar = true;
    if (i === 9) {
      estado = "CANCELADO";
      desp = "NINGUNO";
      facturar = false;
    } else if (i === 24 || i === 26) {
      estado = "DESPACHADO";
      facturar = false;
    } else if (i === 27 || i === 28) {
      estado = "DESPACHADO_PARCIAL";
      desp = "PARCIAL";
      facturar = false;
    }
    historicos.push({ off, estado, desp, facturar, cliente: rotacion[i] });
  });
  const recientes: PlanPed[] = [
    { off: -4, estado: "FACTURADO", desp: "ENTREGADO", facturar: true, cliente: "cli_05" },
    { off: -3, estado: "FACTURADO", desp: "ENTREGADO", facturar: true, cliente: "cli_09" },
    { off: -2, estado: "FACTURADO", desp: "ENTREGADO", facturar: true, cliente: "cli_06" },
    { off: -1, estado: "FACTURADO", desp: "ENTREGADO", facturar: true, cliente: "cli_13" },
    { off: -2, estado: "FACTURADO", desp: "HOY", facturar: true, cliente: "cli_10" },
    { off: -1, estado: "FACTURADO", desp: "HOY", facturar: true, cliente: "cli_07" },
    { off: -1, estado: "EN_PREPARACION", desp: "HOY", facturar: false, cliente: "cli_03" },
    { off: -1, estado: "EN_PREPARACION", desp: "EN_PREP_HOY", facturar: false, cliente: "cli_11" },
    { off: 0, estado: "EN_PREPARACION", desp: "MANANA", facturar: false, cliente: "cli_15" },
    { off: -1, estado: "EN_PREPARACION", desp: "EN_VIAJE", facturar: false, cliente: "cli_02" },
    { off: -3, estado: "EN_PREPARACION", desp: "ATRASADO", facturar: false, cliente: "cli_01" },
    { off: -2, estado: "CONFIRMADO", desp: "NINGUNO", facturar: false, cliente: "cli_12" },
    { off: -1, estado: "CONFIRMADO", desp: "NINGUNO", facturar: false, cliente: "cli_09" },
    { off: 0, estado: "CONFIRMADO", desp: "NINGUNO", facturar: false, cliente: "cli_20" },
    { off: -1, estado: "BORRADOR", desp: "NINGUNO", facturar: false, cliente: "cli_23" },
    { off: 0, estado: "BORRADOR", desp: "NINGUNO", facturar: false, cliente: "cli_18" },
  ];

  const vehiculoPara = (kg: number) => (kg > 8000 ? "veh_1" : kg > 3000 ? R.pick(["veh_1", "veh_2"]) : R.pick(["veh_2", "veh_3"]));
  const choferDe: Record<string, string> = { veh_1: "cho_1", veh_2: "cho_2", veh_3: "cho_3" };
  const pesoItems = (items: { productoId: string; cantidad: number }[]) =>
    items.reduce((a, i) => a + i.cantidad * (prod.get(i.productoId)?.pesoKg ?? 0), 0);

  const crearDespachoPedido = (
    p: Pedido,
    items: ItemVenta[],
    estado: EstadoDespacho,
    offProg: number,
    opts: { egreso: boolean; entregado: boolean },
  ): Despacho => {
    const cliente = cli.get(p.clienteId)!;
    const mostrador = p.modalidadEntrega === "RETIRA";
    const dItems = items.map((it) => ({ productoId: it.productoId, cantidad: it.cantidad, itemOrigenId: it.id, cantidadEntregada: opts.entregado ? it.cantidad : undefined }));
    const veh = mostrador ? undefined : vehiculoPara(pesoItems(dItems));
    const salida = opts.egreso ? momento(offProg, mostrador ? R.int(10, 17) : 8, R.int(0, 45)) : undefined;
    const entrega = opts.entregado ? (mostrador ? salida : momento(offProg, R.int(10, 15), R.int(0, 59))) : undefined;
    const d: Despacho = {
      id: id("des"),
      numero: "",
      sucursalId: p.sucursalId,
      depositoId: p.depositoId,
      clienteId: p.clienteId,
      origenTipo: "PEDIDO",
      origenId: p.id,
      estado,
      fechaProgramada: cal.fecha(offProg),
      fechaSalida: salida,
      fechaEntrega: entrega,
      vehiculoId: estado === "PENDIENTE" && offProg >= 0 ? undefined : veh,
      choferId: estado === "PENDIENTE" && offProg >= 0 ? undefined : veh ? choferDe[veh] : undefined,
      direccionEntrega: mostrador ? "Retira en mostrador" : `${cliente.direccion}`,
      localidad: cliente.localidad,
      items: dItems,
      firmaRecibido: opts.entregado ? (mostrador ? cliente.razonSocial : R.pick(["Encargado de obra", "Capataz", cliente.razonSocial, "Recepción"])) : undefined,
      egresoGenerado: opts.egreso,
      ...meta(cal.dia(offProg - 1, 17)),
    };
    if (opts.egreso) for (const it of items) it.cantidadDespachada = (it.cantidadDespachada ?? 0) + it.cantidad;
    despachos.push(d);
    return d;
  };

  const facturasPendientesDeNumero: { c: Comprobante; pv: string }[] = [];
  const facturar = (p: Pedido, off: number) => {
    const cliente = cli.get(p.clienteId)!;
    const tipo = tipoFacturaPara(cliente.condicionIVA);
    const fecha = momento(off, R.int(9, 18), R.int(0, 59));
    const c: Comprobante = {
      id: id("cmp"),
      tipo,
      numero: "",
      clienteId: cliente.id,
      pedidoId: p.id,
      sucursalId: p.sucursalId,
      fecha,
      vencimiento: cal.fecha(off + diasCondicionPago(p.condicionPago)),
      subtotal: r2(p.subtotal * (1 - p.descuentoPct / 100)),
      iva: p.iva,
      total: p.total,
      saldoPendiente: p.total,
      estado: "PENDIENTE",
      items: p.items,
      ...meta(fecha),
    };
    comprobantes.push(c);
    facturasPendientesDeNumero.push({ c, pv: pvDeSucursal(p.sucursalId) });
    p.comprobanteId = c.id;
    audit(fecha, p.sucursalId === "suc_norte" ? "usr_laura" : "usr_diego", "Facturó pedido", "Pedido", p.id, `${tipo === "FACTURA_A" ? "Factura A" : "Factura B"} por ${Math.round(p.total)}`);
    return c;
  };

  for (const plan of [...historicos, ...recientes]) {
    const cliente = cli.get(plan.cliente ?? R.pick(clientes).id)!;
    const items = crearItemsVenta(cliente, plan.off);
    const descuentoPct = cliente.tipo === "CONSTRUCTORA" && R.chance(0.5) ? 3 : 0;
    const tot = calcularTotales(items, descuentoPct, IVA);
    const fecha = momento(plan.off, R.int(8, 12), R.int(0, 59));
    const modalidad = cliente.tipo === "PARTICULAR" ? (R.chance(0.6) ? "RETIRA" : "ENVIO") : R.chance(0.15) ? "RETIRA" : "ENVIO";
    const forzarEnvio = ["HOY", "MANANA", "EN_PREP_HOY", "EN_VIAJE", "ATRASADO", "PARCIAL"].includes(plan.desp);
    const p: Pedido = {
      id: id("ped"),
      numero: "",
      clienteId: cliente.id,
      sucursalId: cliente.sucursalPreferidaId,
      depositoId: depDeSucursal(cliente.sucursalPreferidaId),
      vendedorId: cliente.vendedorId ?? "usr_carla",
      estado: plan.estado,
      fecha,
      fechaConfirmacion: plan.estado === "BORRADOR" ? undefined : momento(plan.off, 12, R.int(0, 59)),
      fechaEntregaComprometida: cal.fecha(plan.off + (plan.desp === "MANANA" ? 1 : R.int(1, 3))),
      items,
      subtotal: tot.subtotal,
      descuentoPct,
      iva: tot.iva,
      total: tot.total,
      condicionPago: cliente.condicionPago,
      modalidadEntrega: forzarEnvio ? "ENVIO" : modalidad,
      direccionEntrega: `${cliente.direccion}, ${cliente.localidad}`,
      ...meta(fecha),
    };
    if (p.modalidadEntrega === "RETIRA") p.direccionEntrega = undefined;
    pedidos.push(p);
    audit(fecha, p.vendedorId, "Creó pedido", "Pedido", p.id, cliente.razonSocial);
    if (p.fechaConfirmacion && p.estado !== "CANCELADO") audit(p.fechaConfirmacion, p.vendedorId, "Confirmó pedido", "Pedido", p.id, "Stock comprometido");

    const offEntrega = Math.min(0, plan.off + (p.modalidadEntrega === "RETIRA" ? 0 : R.int(1, 2)));
    switch (plan.desp) {
      case "ENTREGADO": {
        const est: EstadoDespacho = p.modalidadEntrega === "RETIRA" ? "RETIRADO_EN_MOSTRADOR" : "ENTREGADO";
        crearDespachoPedido(p, items, est, offEntrega, { egreso: true, entregado: true });
        break;
      }
      case "PARCIAL": {
        const mitad = Math.ceil(items.length / 2);
        crearDespachoPedido(p, items.slice(0, mitad), "ENTREGADO", plan.off + 1, { egreso: true, entregado: true });
        crearDespachoPedido(p, items.slice(mitad), "PENDIENTE", plan.off === offsHist[27] ? 0 : 2, { egreso: false, entregado: false });
        break;
      }
      case "HOY":
        crearDespachoPedido(p, items, "PENDIENTE", 0, { egreso: false, entregado: false });
        break;
      case "MANANA":
        crearDespachoPedido(p, items, "PENDIENTE", 1, { egreso: false, entregado: false });
        break;
      case "EN_PREP_HOY":
        crearDespachoPedido(p, items, "EN_PREPARACION", 0, { egreso: false, entregado: false });
        break;
      case "EN_VIAJE": {
        const d = crearDespachoPedido(p, items, "EN_VIAJE", 0, { egreso: true, entregado: false });
        d.vehiculoId = "veh_3";
        d.choferId = "cho_3";
        break;
      }
      case "ATRASADO": {
        const d = crearDespachoPedido(p, items, "PENDIENTE", -1, { egreso: false, entregado: false });
        d.reprogramaciones = 1;
        d.observaciones = "No se pudo entregar ayer: lluvia, obra sin acceso.";
        break;
      }
    }
    if (plan.facturar) facturar(p, plan.desp === "ENTREGADO" ? offEntrega : plan.off);
    if (plan.estado === "CANCELADO") {
      p.observaciones = "Cancelado por el cliente: cambio de proyecto.";
      audit(cal.dia(plan.off + 1, 10), p.vendedorId, "Canceló pedido", "Pedido", p.id, "Liberó stock comprometido");
    }
  }

  // ── Presupuestos (12) ──
  const presupuestos: Presupuesto[] = [];
  const crearPresupuesto = (clienteId: string, off: number, estado: Presupuesto["estado"], items?: ItemVenta[], pedidoId?: string) => {
    const cliente = cli.get(clienteId)!;
    const its = items
      ? items.map((i) => ({ ...i, id: id("itv"), costoUnitarioSnapshot: 0, cantidadDespachada: 0 }))
      : crearItemsVenta(cliente, off);
    const tot = calcularTotales(its, 0, IVA);
    const fecha = momento(off, R.int(9, 17), R.int(0, 59));
    const pr: Presupuesto = {
      id: id("pre"),
      numero: "",
      clienteId,
      sucursalId: cliente.sucursalPreferidaId,
      vendedorId: cliente.vendedorId ?? "usr_carla",
      estado,
      fecha,
      validezDias: 7,
      items: its,
      subtotal: tot.subtotal,
      descuentoPct: 0,
      iva: tot.iva,
      total: tot.total,
      pedidoId,
      ...meta(fecha),
    };
    presupuestos.push(pr);
    audit(fecha, pr.vendedorId, "Creó presupuesto", "Presupuesto", pr.id, cliente.razonSocial);
    return pr;
  };
  // 2 aceptados y convertidos en pedido
  for (const p of [pedidos[3], pedidos[17]]) {
    const pr = crearPresupuesto(p.clienteId, offDe(p.fecha) - 3, "ACEPTADO", p.items, p.id);
    p.presupuestoId = pr.id;
  }
  crearPresupuesto("cli_10", -2, "ACEPTADO");
  crearPresupuesto("cli_13", -5, "ENVIADO");
  crearPresupuesto("cli_19", -3, "ENVIADO");
  crearPresupuesto("cli_07", -1, "ENVIADO");
  crearPresupuesto("cli_22", -21, "ENVIADO"); // vencido por validez
  crearPresupuesto("cli_15", -30, "RECHAZADO");
  crearPresupuesto("cli_24", -14, "RECHAZADO");
  crearPresupuesto("cli_12", -1, "BORRADOR");
  crearPresupuesto("cli_21", 0, "BORRADOR");
  crearPresupuesto("cli_03", 0, "BORRADOR");

  // ════════════════════════ ACOPIOS ════════════════════════
  const acopios: Acopio[] = [];
  const retiros: RetiroAcopio[] = [];
  type PlanAco = {
    cliente: string;
    off: number;
    venceEn: number;
    lineas: [string, number][];
    retiros: { off: number; pct: number; envio: boolean; pendienteHoy?: boolean }[];
    pagoPct: number;
    obs?: string;
  };
  const P = (nombreParcial: string, marca?: string) =>
    productos.find((p) => p.nombre.includes(nombreParcial) && (!marca || p.marca === marca))!.id;
  const planesAco: PlanAco[] = [
    {
      cliente: "cli_09", off: -95, venceEn: 180, pagoPct: 1, obs: "Obra Torres del Sol, Nordelta. Entregas coordinadas con el jefe de obra.",
      lineas: [[P("Cemento Portland normal"), 840], [P("Ø 10 mm"), 420], [P("Malla Sima"), 80], [P("Arena gruesa"), 40], [P("Ladrillo hueco portante"), 3600]],
      retiros: [{ off: -80, pct: 0.2, envio: true }, { off: -52, pct: 0.15, envio: true }, { off: -18, pct: 0.15, envio: true }, { off: 0, pct: 0.05, envio: true, pendienteHoy: true }],
    },
    {
      cliente: "cli_10", off: -110, venceEn: 120, pagoPct: 1, obs: "Barrio cerrado Los Robles, lote 14 a 22.",
      lineas: [[P("Cemento Portland compuesto"), 420], [P("Ladrillo hueco 12x18x33"), 4320], [P("Ø 8 mm"), 300]],
      retiros: [{ off: -90, pct: 0.3, envio: true }, { off: -40, pct: 0.25, envio: true }],
    },
    {
      cliente: "cli_11", off: -60, venceEn: 180, pagoPct: 0.6,
      lineas: [[P("Placa de yeso estándar", "Durlock"), 300], [P("Perfil montante"), 600], [P("Perfil solera"), 400], [P("Masilla"), 30]],
      retiros: [{ off: -45, pct: 0.35, envio: false }],
    },
    { cliente: "cli_02", off: -20, venceEn: 180, pagoPct: 1, lineas: [[P("Cemento Portland normal"), 504], [P("Cal hidratada"), 300]], retiros: [] },
    { cliente: "cli_13", off: -8, venceEn: 180, pagoPct: 1, obs: "Casa Ruiz, Martínez. Porcelanato para planta baja y alta.", lineas: [[P("Gris Pulido"), 280], [P("Adhesivo para porcelanato"), 120], [P("Pastina"), 40]], retiros: [] },
    { cliente: "cli_19", off: -105, venceEn: 117, pagoPct: 1, obs: "Construcción vivienda propia. Retira a medida que avanza la obra.", lineas: [[P("Ladrillo hueco 12x18x33"), 2880], [P("Plasticor"), 150], [P("Arena gruesa"), 12]], retiros: [] },
    {
      cliente: "cli_05", off: -115, venceEn: 90, pagoPct: 1,
      lineas: [[P("Cemento Portland normal"), 336], [P("Cal hidratada"), 180]],
      retiros: [{ off: -100, pct: 0.5, envio: true }, { off: -70, pct: 0.5, envio: true }],
    },
    {
      cliente: "cli_12", off: -100, venceEn: 180, pagoPct: 1,
      lineas: [[P("Beige Mate"), 120], [P("Adhesivo cerámico"), 60], [P("Inodoro"), 3], [P("Lavatorio"), 3]],
      retiros: [{ off: -85, pct: 0.6, envio: true }, { off: -60, pct: 0.4, envio: false }],
    },
    {
      cliente: "cli_17", off: -118, venceEn: 90, pagoPct: 1, obs: "Ampliación quincho.",
      lineas: [[P("Cemento Portland normal"), 60], [P("Ladrillo hueco 8x18x33"), 1440], [P("Arena fina"), 6]],
      retiros: [{ off: -100, pct: 0.4, envio: false }],
    },
  ];

  const pagoPctAcopio = new Map<string, number>();
  for (const plan of planesAco) {
    const cliente = cli.get(plan.cliente)!;
    const fechaIni = momento(plan.off, R.int(10, 16), R.int(0, 59));
    const items: ItemAcopio[] = plan.lineas.map(([pid, q]) => ({
      id: id("ita"),
      productoId: pid,
      cantidadAcopiada: q,
      cantidadRetirada: 0,
      precioUnitarioPactado: precioAt(pid, cliente.listaPreciosId, plan.off),
      costoUnitarioSnapshot: 0,
    }));
    const tot = calcularTotales(items.map((i) => ({ cantidad: i.cantidadAcopiada, precioUnitario: i.precioUnitarioPactado, descuentoPct: 0 })), 0, IVA);
    const a: Acopio = {
      id: id("aco"),
      numero: "",
      clienteId: cliente.id,
      sucursalId: cliente.sucursalPreferidaId,
      depositoId: depDeSucursal(cliente.sucursalPreferidaId),
      vendedorId: cliente.vendedorId ?? "usr_carla",
      estado: "VIGENTE",
      fechaInicio: fechaIni,
      fechaVencimiento: cal.fecha(plan.off + plan.venceEn),
      items,
      subtotal: tot.subtotal,
      iva: tot.iva,
      total: tot.total,
      montoPagado: 0,
      condicionPago: "ANTICIPO",
      observaciones: plan.obs,
      ...meta(fechaIni),
    };
    acopios.push(a);
    pagoPctAcopio.set(a.id, plan.pagoPct);
    audit(fechaIni, a.vendedorId, "Creó acopio", "Acopio", a.id, `${cliente.razonSocial} · ${items.length} productos`);

    // Factura del acopio
    const fc: Comprobante = {
      id: id("cmp"),
      tipo: tipoFacturaPara(cliente.condicionIVA),
      numero: "",
      clienteId: cliente.id,
      acopioId: a.id,
      sucursalId: a.sucursalId,
      fecha: fechaIni,
      vencimiento: cal.fecha(plan.off),
      subtotal: tot.neto,
      iva: tot.iva,
      total: tot.total,
      saldoPendiente: tot.total,
      estado: "PENDIENTE",
      ...meta(fechaIni),
    };
    comprobantes.push(fc);
    facturasPendientesDeNumero.push({ c: fc, pv: pvDeSucursal(a.sucursalId) });
    a.comprobanteId = fc.id;
    a.comprobanteIds = [fc.id];

    // Retiros
    plan.retiros.forEach((rp, idx) => {
      const ultimo = idx === plan.retiros.length - 1;
      const sumaPct = plan.retiros.reduce((s, x) => s + x.pct, 0);
      const completa = ultimo && sumaPct >= 0.999;
      const itemsRet = items
        .map((it) => {
          const pend = it.cantidadAcopiada - it.cantidadRetirada;
          let q = completa ? pend : Math.min(pend, Math.round(it.cantidadAcopiada * rp.pct));
          if (specs.get(it.productoId)!.pallet && q > 50 && !completa) q = Math.max(1, Math.round(q / 10) * 10);
          return q > 0 ? { it, q } : null;
        })
        .filter((x): x is { it: ItemAcopio; q: number } => x !== null);
      if (!itemsRet.length) return;
      const fecha = momento(rp.off, R.int(8, 16), R.int(0, 59));
      const ret: RetiroAcopio = {
        id: id("ret"),
        numero: "",
        acopioId: a.id,
        fecha,
        items: itemsRet.map(({ it, q }) => ({ itemAcopioId: it.id, productoId: it.productoId, cantidad: q })),
        usuarioId: a.vendedorId,
        ...meta(fecha),
      };
      for (const { it, q } of itemsRet) it.cantidadRetirada += q;
      retiros.push(ret);
      const dItems = ret.items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad, itemOrigenId: i.itemAcopioId, cantidadEntregada: rp.pendienteHoy ? undefined : i.cantidad }));
      const veh = rp.envio && !rp.pendienteHoy ? vehiculoPara(pesoItems(dItems)) : undefined;
      const d: Despacho = {
        id: id("des"),
        numero: "",
        sucursalId: a.sucursalId,
        depositoId: a.depositoId,
        clienteId: a.clienteId,
        origenTipo: "RETIRO_ACOPIO",
        origenId: ret.id,
        acopioId: a.id,
        estado: rp.pendienteHoy ? "PENDIENTE" : rp.envio ? "ENTREGADO" : "RETIRADO_EN_MOSTRADOR",
        fechaProgramada: cal.fecha(rp.off),
        fechaSalida: rp.pendienteHoy ? undefined : momento(rp.off, rp.envio ? 8 : 11, R.int(0, 50)),
        fechaEntrega: rp.pendienteHoy ? undefined : momento(rp.off, rp.envio ? R.int(10, 14) : 11, 55),
        vehiculoId: veh,
        choferId: veh ? choferDe[veh] : undefined,
        direccionEntrega: rp.envio ? `${cliente.direccion}` : "Retira en mostrador",
        localidad: cliente.localidad,
        items: dItems,
        firmaRecibido: rp.pendienteHoy ? undefined : rp.envio ? "Jefe de obra" : cliente.razonSocial,
        egresoGenerado: !rp.pendienteHoy,
        ...meta(fecha),
      };
      ret.despachoId = d.id;
      despachos.push(d);
      audit(fecha, ret.usuarioId, "Registró retiro de acopio", "Acopio", a.id, `${ret.items.length} productos · ${rp.envio ? "con envío" : "retira en mostrador"}`);
    });
  }

  // ── Transferencias (4) ──
  const transferencias: TransferenciaStock[] = [];
  const crearTransf = (off: number, origen: string, destino: string, estado: TransferenciaStock["estado"], lineas: [string, number][], obs?: string) => {
    const fecha = momento(off, R.int(8, 11), R.int(0, 59));
    const t: TransferenciaStock = {
      id: id("trf"),
      numero: "",
      depositoOrigenId: origen,
      depositoDestinoId: destino,
      items: lineas.map(([productoId, cantidad]) => ({ productoId, cantidad })),
      estado,
      usuarioId: "usr_jorge",
      fecha,
      fechaDespacho: estado === "PENDIENTE" ? undefined : momento(off, 13, R.int(0, 30)),
      fechaRecepcion: estado === "RECIBIDA" ? momento(off, 17, R.int(0, 30)) : undefined,
      observacion: obs,
      ...meta(fecha),
    };
    transferencias.push(t);
    audit(fecha, t.usuarioId, "Creó transferencia", "TransferenciaStock", t.id, `${origen === "dep_norte" ? "Norte → Sur" : "Sur → Norte"}`);
  };
  crearTransf(-90, "dep_norte", "dep_sur", "RECIBIDA", [[P("Cemento Portland normal"), 84], [P("Ladrillo hueco 12x18x33"), 1440]], "Reposición Sur por demanda de obra.");
  crearTransf(-45, "dep_sur", "dep_norte", "RECIBIDA", [[P("Beige Mate"), 60], [P("Adhesivo cerámico"), 40]]);
  crearTransf(-1, "dep_norte", "dep_sur", "EN_TRANSITO", [[P("Placa de yeso estándar", "Durlock"), 50], [P("Ø 8 mm"), 100]], "Viaja con el camión de la tarde.");
  crearTransf(0, "dep_norte", "dep_sur", "PENDIENTE", [[P("Adhesivo para porcelanato"), 40], [P("Hidrófugo"), 12]]);

  // ── Ajustes (3 + inventario inicial, que se completa después) ──
  const ajustes: AjusteStock[] = [];
  const crearAjuste = (off: number, dep: string, items: AjusteStock["items"], obs: string, usuario = "usr_jorge") => {
    const fecha = momento(off, R.int(16, 18), R.int(0, 59));
    const aj: AjusteStock = { id: id("aju"), numero: "", depositoId: dep, items, usuarioId: usuario, fecha, observacion: obs, ...meta(fecha) };
    ajustes.push(aj);
    audit(fecha, usuario, "Registró ajuste de stock", "AjusteStock", aj.id, obs);
  };
  crearAjuste(-70, "dep_norte", [{ productoId: P("Placa de yeso estándar", "Durlock"), cantidad: 6, signo: -1, motivo: "ROTURA" }, { productoId: P("Gris Pulido"), cantidad: 4, signo: -1, motivo: "ROTURA" }], "Rotura en descarga del camión del proveedor.", "usr_diego");
  crearAjuste(-30, "dep_sur", [{ productoId: P("Cemento Portland compuesto"), cantidad: 5, signo: -1, motivo: "FALTANTE" }], "Diferencia en inventario rotativo mensual.");
  crearAjuste(-6, "dep_norte", [{ productoId: P("Ladrillo hueco 8x18x33"), cantidad: 36, signo: 1, motivo: "SOBRANTE" }, { productoId: P("Cal hidratada"), cantidad: 2, signo: -1, motivo: "MUESTRA" }], "Conteo de fin de mes.", "usr_diego");

  // ── Hojas de ruta (2) ──
  const hojasRuta: HojaRuta[] = [];
  const entregadosAyer = despachos.filter((d) => d.estado === "ENTREGADO" && offDe(d.fechaProgramada) === -1);
  if (entregadosAyer.length) {
    const v = entregadosAyer[0].vehiculoId ?? "veh_1";
    for (const d of entregadosAyer) {
      d.vehiculoId = v;
      d.choferId = choferDe[v];
    }
    hojasRuta.push({ id: id("hr"), fecha: cal.fecha(-1), vehiculoId: v, choferId: choferDe[v], despachoIds: entregadosAyer.map((d) => d.id), estado: "CERRADA", ...meta(cal.dia(-1, 7)) });
  }
  const pendHoy = despachos.filter((d) => d.estado === "PENDIENTE" && offDe(d.fechaProgramada) === 0 && d.origenTipo === "PEDIDO").slice(0, 2);
  for (const d of pendHoy) {
    d.vehiculoId = "veh_2";
    d.choferId = "cho_2";
  }
  hojasRuta.push({ id: id("hr"), fecha: cal.fecha(0), vehiculoId: "veh_2", choferId: "cho_2", despachoIds: pendHoy.map((d) => d.id), estado: "PLANIFICADA", ...meta(cal.dia(0, 7)) });

  // ════════════════════════ COBRANZAS ════════════════════════
  const cobranzas: Cobranza[] = [];
  const cheques: Cheque[] = [];
  const deudores = new Set(["cli_04", "cli_08", "cli_14", "cli_21"]);
  const facturasCli = comprobantes.filter((c) => c.clienteId).sort((a, b) => a.fecha.localeCompare(b.fecha));

  const registrarCobro = (c: Comprobante, off: number, importe: number, medio: MedioPago, sucursalId?: string) => {
    const fecha = momento(off, R.int(9, 17), R.int(0, 59));
    const m: MedioCobro = { medio, importe: r2(importe) };
    if (medio === "TRANSFERENCIA") m.referencia = `Transf. ${R.int(100000, 999999)}`;
    if (medio === "MERCADOPAGO") m.referencia = `MP ${R.int(10000000, 99999999)}`;
    if (medio === "TARJETA") m.referencia = `Visa · cupón ${R.int(1000, 9999)}`;
    const cob: Cobranza = {
      id: id("cob"),
      numero: "",
      clienteId: c.clienteId!,
      sucursalId,
      fecha,
      medios: [m],
      imputaciones: [{ comprobanteId: c.id, importe: r2(importe) }],
      total: r2(importe),
      usuarioId: R.pick(["usr_laura", "usr_diego"]),
      ...meta(fecha),
    };
    if (medio === "CHEQUE" || medio === "ECHEQ") {
      m.banco = R.pick(BANCOS);
      m.numeroCheque = String(R.int(10000000, 99999999));
      const offCobro = off + R.int(15, 45);
      m.fechaCobro = cal.fecha(offCobro);
      const ch: Cheque = {
        id: id("chq"),
        tipo: medio,
        banco: m.banco,
        numero: m.numeroCheque,
        importe: r2(importe),
        fechaCobro: m.fechaCobro,
        clienteId: c.clienteId!,
        cobranzaId: cob.id,
        estado: offCobro < 0 ? "DEPOSITADO" : "EN_CARTERA",
        ...meta(fecha),
      };
      m.chequeId = ch.id;
      cheques.push(ch);
    }
    c.saldoPendiente = r2(c.saldoPendiente - importe);
    c.estado = estadoPorSaldo(c.total, c.saldoPendiente);
    cobranzas.push(cob);
    audit(fecha, cob.usuarioId, "Registró cobranza", "Cobranza", cob.id, `${cli.get(c.clienteId!)?.razonSocial}`);
    return cob;
  };

  for (const c of facturasCli) {
    const cliente = cli.get(c.clienteId!)!;
    const offF = offDe(c.fecha);
    const offV = offDe(c.vencimiento ?? c.fecha);
    if (c.acopioId) {
      const a = acopios.find((x) => x.id === c.acopioId)!;
      registrarCobro(c, offF, c.total * (pagoPctAcopio.get(a.id) ?? 1), R.pick(["TRANSFERENCIA", "ECHEQ", "TRANSFERENCIA"] as MedioPago[]), a.sucursalId);
      a.montoPagado = r2(c.total - c.saldoPendiente);
      continue;
    }
    if (cliente.condicionPago === "CONTADO" || cliente.condicionPago === "ANTICIPO") {
      registrarCobro(c, offF, c.total, R.pick(["EFECTIVO", "TRANSFERENCIA", "MERCADOPAGO", "TARJETA"] as MedioPago[]), c.sucursalId);
      continue;
    }
    if (deudores.has(cliente.id) && offV < 0) {
      // Deudores: la factura más vieja con cobro parcial, el resto impago
      const yaTiene = cobranzas.some((x) => x.clienteId === cliente.id);
      if (!yaTiene && cliente.id !== "cli_14") registrarCobro(c, offV + 5, c.total * 0.4, "TRANSFERENCIA", c.sucursalId);
      continue;
    }
    if (offV < -3) {
      const offCobro = Math.min(-1, offV + R.int(-6, 8));
      registrarCobro(c, Math.max(offF, offCobro), c.total, R.pick(["TRANSFERENCIA", "TRANSFERENCIA", "ECHEQ", "CHEQUE"] as MedioPago[]), c.sucursalId);
    } else if (R.chance(0.25)) {
      registrarCobro(c, Math.min(0, offF + R.int(1, 5)), redondear(c.total * 0.5, 1000), "TRANSFERENCIA", c.sucursalId);
    }
  }

  // ════════════════════════ PAGOS A PROVEEDORES ════════════════════════
  const facturasProv = comprobantes.filter((c) => c.proveedorId).sort((a, b) => a.fecha.localeCompare(b.fecha));
  let chequeEndosado = false;
  for (const c of facturasProv) {
    const offV = offDe(c.vencimiento ?? c.fecha);
    if (offV >= -2) continue;
    if (c.proveedorId === "prov_07") continue; // queda vencida para mostrar alerta
    const offPago = Math.min(-1, offV + R.int(-3, 3));
    const fecha = momento(offPago, R.int(10, 16), R.int(0, 59));
    const medios: MedioCobro[] = [];
    let resto = c.total;
    if (!chequeEndosado) {
      const ch = cheques.find((x) => x.estado === "EN_CARTERA" && x.importe < c.total && offDe(x.creadoEn) < offPago);
      if (ch) {
        ch.estado = "ENTREGADO";
        ch.proveedorId = c.proveedorId;
        medios.push({ medio: ch.tipo, importe: ch.importe, banco: ch.banco, numeroCheque: ch.numero, fechaCobro: ch.fechaCobro, chequeId: ch.id, referencia: "Cheque de terceros endosado" });
        resto = r2(resto - ch.importe);
        chequeEndosado = true;
      }
    }
    medios.push(R.chance(0.7) ? { medio: "TRANSFERENCIA", importe: r2(resto), referencia: `Transf. ${R.int(100000, 999999)}` } : { medio: "ECHEQ", importe: r2(resto), banco: "Banco Galicia", numeroCheque: String(R.int(10000000, 99999999)), fechaCobro: cal.fecha(offPago + 30), referencia: "eCheq propio" });
    const op: PagoProveedor = {
      id: id("op"),
      numero: "",
      proveedorId: c.proveedorId!,
      fecha,
      medios,
      imputaciones: [{ comprobanteId: c.id, importe: c.total }],
      total: c.total,
      usuarioId: "usr_laura",
      ...meta(fecha),
    };
    for (const m of medios) if (m.chequeId) {
      const ch = cheques.find((x) => x.id === m.chequeId);
      if (ch) ch.pagoProveedorId = op.id;
    }
    c.saldoPendiente = 0;
    c.estado = "PAGADO";
    pagosProveedores.push(op);
    audit(fecha, op.usuarioId, "Registró pago a proveedor", "PagoProveedor", op.id, proveedores.find((p) => p.id === c.proveedorId)?.razonSocial ?? "");
  }

  // ════════════════════════ NUMERACIÓN ════════════════════════
  const numerar = <T extends { numero: string }>(lista: T[], entidad: EntidadNumerada, fecha: (x: T) => string) =>
    [...lista].sort((a, b) => fecha(a).localeCompare(fecha(b))).forEach((x, i) => (x.numero = formatearNumero(entidad, i + 1)));
  numerar(ordenesCompra, "OC", (x) => x.fechaEmision);
  numerar(recepciones, "RCP", (x) => x.fecha);
  numerar(presupuestos, "PRE", (x) => x.fecha);
  numerar(pedidos, "PED", (x) => x.fecha);
  numerar(acopios, "ACO", (x) => x.fechaInicio);
  numerar(retiros, "RET", (x) => x.fecha);
  numerar(despachos, "REM", (x) => x.fechaProgramada + x.creadoEn);
  numerar(cobranzas, "REC", (x) => x.fecha);
  numerar(pagosProveedores, "OP", (x) => x.fecha);
  numerar(transferencias, "TRF", (x) => x.fecha);

  const inicioFiscal: Record<string, Record<string, number>> = { "0001": { FACTURA_A: 1840, FACTURA_B: 3119 }, "0002": { FACTURA_A: 911, FACTURA_B: 1654 } };
  facturasPendientesDeNumero
    .sort((a, b) => a.c.fecha.localeCompare(b.c.fecha))
    .forEach(({ c, pv }) => {
      const n = ++inicioFiscal[pv][c.tipo];
      c.numero = formatearNumeroFiscal(pv, n);
    });

  // Auditoría: 60 registros más recientes
  auditoria.sort((a, b) => b.fecha.localeCompare(a.fecha));
  const auditoriaFinal = auditoria.slice(0, 60);

  return {
    ordenesCompra,
    recepciones,
    presupuestos,
    pedidos,
    comprobantes,
    acopios,
    retiros,
    despachos,
    hojasRuta,
    transferencias,
    ajustes,
    cobranzas,
    pagosProveedores,
    cheques,
    auditoria: auditoriaFinal,
    costoInicial,
  };

  function totalesOC(items: ItemOC[]) {
    const subtotal = r2(items.reduce((a, i) => a + i.cantidadPedida * i.costoUnitario * (1 - i.descuentoPct / 100), 0));
    return { subtotal, iva: r2(subtotal * 0.21), total: r2(subtotal * 1.21) };
  }
}

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

