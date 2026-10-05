import type { AjusteStock, EstadoInicial, Numeradores, PrecioProducto, Producto } from "@/domain/types";
import { calcularComprometido } from "@/domain/stock";
import { calcularPrecioDesdeMarkup } from "@/domain/precios";
import { parsearNumero, formatearNumero } from "@/domain/numeracion";
import { BRAND } from "@/config/brand";
import { crearCalendario, crearRandom } from "./util";
import { seedOrganizacion } from "./organizacion";
import { PRODUCTOS, seedListas, seedProveedores, seedRubros, type ProductoSpec } from "./catalogo";
import { seedClientes } from "./clientes";
import { generarOperaciones } from "./operaciones";
import { generarMovimientosDesdeOperaciones } from "./movimientos";

/** Productos que quedan bajo mínimo a propósito para que las alertas luzcan. */
const BAJO_MINIMO = [
  "Cemento Portland compuesto 50 kg",
  "Placa de yeso estándar 12,5 mm 1,20x2,40 m|Durlock",
  "Adhesivo cerámico impermeable 30 kg",
  "Hierro ADN 420 Ø 12 mm x 12 m",
  "Caño PVC cloacal Ø 110 mm x 4 m",
  "Membrana asfáltica 4 mm con aluminio (rollo 10 m²)",
  "Lana de vidrio 50 mm rollo 1,20x18 m",
];

/**
 * Crea el estado inicial completo del demo, con fechas relativas a `hoy`
 * (últimos ~120 días). Determinístico: siempre genera los mismos datos.
 */
export function crearSeed(hoyParam: Date = new Date()): EstadoInicial {
  const R = crearRandom(20261005);
  const cal = crearCalendario(hoyParam);
  const ts0 = cal.dia(-130, 9);

  const org = seedOrganizacion(ts0);
  const rubros = seedRubros(ts0);
  const proveedores = seedProveedores(ts0);
  const listasPrecios = seedListas(ts0);
  const clientes = seedClientes(ts0);

  // ── Productos ──
  const contadorRubro = new Map<string, number>();
  const specs = new Map<string, ProductoSpec>();
  const productos: Producto[] = PRODUCTOS.map((s, i) => {
    const rubro = rubros.find((r) => r.id === s.rubro)!;
    const n = (contadorRubro.get(rubro.id) ?? 0) + 1;
    contadorRubro.set(rubro.id, n);
    const id = `prod_${String(i + 1).padStart(3, "0")}`;
    specs.set(id, s);
    return {
      id,
      codigo: `${rubro.prefijo}-${String(n).padStart(4, "0")}`,
      nombre: s.nombre,
      descripcion: s.descripcion,
      rubroId: s.rubro,
      marca: s.marca,
      unidad: s.unidad,
      unidadesPorPallet: s.pallet,
      proveedorHabitualId: s.proveedor,
      costoUltimo: s.costo,
      costoPromedio: s.costo,
      fechaUltimoCosto: cal.dia(-125, 8),
      stockMinimo: 0,
      activo: true,
      codigoBarras: `779${String(1000000000 + i * 7919).slice(0, 10)}`,
      pesoKg: s.pesoKg,
      creadoEn: ts0,
      actualizadoEn: ts0,
    };
  });
  const esBajoMinimo = (p: Producto) =>
    BAJO_MINIMO.some((b) => {
      const [nombre, marca] = b.split("|");
      return p.nombre === nombre && (!marca || p.marca === marca);
    });

  // ── Operaciones ──
  const ops = generarOperaciones({ R, cal, productos, specs, clientes, proveedores, listas: listasPrecios });
  const depositos = org.depositos.map((d) => d.id);

  // Pasada 1: flujos sin inventario inicial, para calibrar la apertura.
  const pasada1 = generarMovimientosDesdeOperaciones({ ...ops, productos, depositos });

  const objetivo = (p: Producto, dep: string) => {
    const s = specs.get(p.id)!;
    const factor = dep === "dep_norte" ? 1 : 0.55;
    let base: number;
    switch (s.perfil) {
      case "granel":
        base = (s.pallet ?? 50) * R.int(3, 8);
        break;
      case "medio":
        base = s.unidad === "M3" ? R.int(15, 35) : R.int(60, 220);
        break;
      case "m2":
        base = R.int(15, 45) * 10;
        break;
      case "unidad":
        base = R.int(5, 18);
        break;
      default:
        base = R.int(15, 70);
    }
    if (esBajoMinimo(p)) base = base * 0.12;
    return Math.round(base * factor);
  };

  const fechaApertura = cal.dia(-125, 7, 30);
  const apertura: AjusteStock[] = org.depositos.map((d, i) => ({
    id: `aju_apertura_${i + 1}`,
    numero: "",
    depositoId: d.id,
    items: [],
    usuarioId: "usr_diego",
    fecha: fechaApertura,
    observacion: "Inventario inicial (migración desde sistema anterior)",
    creadoEn: fechaApertura,
    actualizadoEn: fechaApertura,
  }));
  for (const p of productos) {
    for (const [i, dep] of depositos.entries()) {
      const k = `${p.id}|${dep}`;
      const minimo = pasada1.minimos.get(k) ?? 0;
      const final0 = pasada1.finales.get(k) ?? 0;
      const comp = calcularComprometido(p.id, dep, ops.pedidos, ops.acopios, ops.despachos);
      const meta = objetivo(p, dep) + (esBajoMinimo(p) ? 0 : comp);
      const cantidad = Math.ceil(Math.max(-minimo, meta - final0));
      if (cantidad > 0) apertura[i].items.push({ productoId: p.id, cantidad, signo: 1, motivo: "OTRO" });
    }
  }
  const ajustes = [...apertura, ...ops.ajustes].sort((a, b) => a.fecha.localeCompare(b.fecha));
  ajustes.forEach((a, i) => (a.numero = formatearNumero("AJU", i + 1)));

  // Pasada 2: movimientos definitivos, stock final, costos y snapshots.
  const res = generarMovimientosDesdeOperaciones({ ...ops, ajustes, productos, depositos });
  for (const p of productos) {
    const c = res.costos.get(p.id)!;
    p.costoUltimo = c.costoUltimo;
    p.costoPromedio = c.costoPromedio;
    p.fechaUltimoCosto = c.fechaUltimoCosto;
  }
  for (const ped of ops.pedidos) for (const it of ped.items) it.costoUnitarioSnapshot = res.snapshots.get(it.id) ?? 0;
  for (const a of ops.acopios) for (const it of a.items) it.costoUnitarioSnapshot = res.snapshots.get(it.id) ?? 0;

  // Stock mínimo: normal por debajo del físico; algunos a propósito por encima.
  for (const p of productos) {
    const total = res.stock.filter((s) => s.productoId === p.id).reduce((a, s) => a + s.cantidadFisica, 0);
    const pallet = p.unidadesPorPallet;
    const redondeo = (q: number) => (pallet && q >= pallet ? Math.round(q / pallet) * pallet : q >= 50 ? Math.round(q / 10) * 10 : Math.max(1, Math.round(q)));
    if (esBajoMinimo(p)) p.stockMinimo = Math.max(redondeo(total * R.float(1.8, 2.6)), Math.ceil(total) + 1);
    else p.stockMinimo = Math.min(redondeo(total * R.float(0.25, 0.5)), Math.max(1, Math.floor(total * 0.6)));
  }

  // ── Precios: costo de reposición actual + markup de la lista ──
  const precios: PrecioProducto[] = [];
  for (const p of productos)
    for (const l of listasPrecios) {
      const s = specs.get(p.id)!;
      precios.push({
        id: `pre_${p.id}_${l.id}`,
        productoId: p.id,
        listaPreciosId: l.id,
        precio: calcularPrecioDesdeMarkup(Math.max(s.costo, p.costoUltimo), l.markupPorDefecto, 10),
        creadoEn: ts0,
        actualizadoEn: cal.dia(-R.int(3, 20), 9),
      });
    }

  // Un cliente excedido de su límite de crédito (para la alerta del tablero)
  const saldo08 = ops.comprobantes.filter((c) => c.clienteId === "cli_08" && c.estado !== "ANULADO").reduce((a, c) => a + c.saldoPendiente, 0);
  const c08 = clientes.find((c) => c.id === "cli_08")!;
  if (saldo08 > 0) c08.limiteCredito = Math.max(1_000_000, Math.floor((saldo08 * 0.8) / 500_000) * 500_000);

  // ── Numeradores ──
  const maxNum = (l: { numero: string }[]) => l.reduce((m, x) => Math.max(m, parsearNumero(x.numero)), 0);
  const fiscal: Numeradores["fiscal"] = { "0001": {}, "0002": {} };
  for (const c of ops.comprobantes) {
    if (c.proveedorId) continue;
    const [pv] = c.numero.split("-");
    if (!fiscal[pv]) continue;
    fiscal[pv][c.tipo] = Math.max(fiscal[pv][c.tipo] ?? 0, parsearNumero(c.numero));
  }
  fiscal["0001"].NOTA_CREDITO ??= 214;
  fiscal["0002"].NOTA_CREDITO ??= 98;
  const numeradores: Numeradores = {
    OC: maxNum(ops.ordenesCompra),
    PRE: maxNum(ops.presupuestos),
    PED: maxNum(ops.pedidos),
    ACO: maxNum(ops.acopios),
    RET: maxNum(ops.retiros),
    REM: maxNum(ops.despachos),
    REC: maxNum(ops.cobranzas),
    OP: maxNum(ops.pagosProveedores),
    TRF: maxNum(ops.transferencias),
    AJU: maxNum(ajustes),
    RCP: maxNum(ops.recepciones),
    fiscal,
  };

  return {
    sucursales: org.sucursales,
    depositos: org.depositos,
    usuarios: org.usuarios,
    rubros,
    proveedores,
    productos,
    listasPrecios,
    precios,
    stock: res.stock,
    movimientos: res.movimientos,
    transferencias: ops.transferencias,
    ajustes,
    ordenesCompra: ops.ordenesCompra,
    recepciones: ops.recepciones,
    clientes,
    presupuestos: ops.presupuestos,
    pedidos: ops.pedidos,
    comprobantes: ops.comprobantes,
    acopios: ops.acopios,
    retiros: ops.retiros,
    vehiculos: org.vehiculos,
    choferes: org.choferes,
    despachos: ops.despachos,
    hojasRuta: ops.hojasRuta,
    cobranzas: ops.cobranzas,
    pagosProveedores: ops.pagosProveedores,
    cheques: ops.cheques,
    auditoria: ops.auditoria,
    config: {
      ivaPct: 21,
      validezPresupuestoDias: 7,
      diasVencimientoAcopio: 180,
      alertaStockMinimo: true,
      umbralSubaCostoPct: 3,
      tipoCambioUSD: 1450,
      motivosAjuste: [
        { codigo: "ROTURA", nombre: "Rotura", activo: true },
        { codigo: "FALTANTE", nombre: "Faltante en inventario", activo: true },
        { codigo: "SOBRANTE", nombre: "Sobrante en inventario", activo: true },
        { codigo: "VENCIMIENTO", nombre: "Vencimiento", activo: true },
        { codigo: "MUESTRA", nombre: "Muestra", activo: true },
        { codigo: "OTRO", nombre: "Otro", activo: true },
      ],
      empresa: {
        empresa: BRAND.empresa,
        razonSocial: BRAND.razonSocial,
        cuit: BRAND.cuit,
        direccion: BRAND.direccion,
        telefono: BRAND.telefono,
        email: BRAND.email,
      },
    },
    numeradores,
  };
}
