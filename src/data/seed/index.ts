import type { AjusteStock, EstadoInicial, PrecioProducto, Producto } from "@/domain/types";
import { calcularPendienteEntrega, calcularReservado } from "@/domain/stock";
import { calcularPrecioDesdeMarkup } from "@/domain/precios";
import { formatearDoc, numeradoresDesde } from "@/domain/numeracion";
import { BRAND } from "@/config/brand";
import { crearCalendario, crearRandom } from "./util";
import { seedOrganizacionBase, seedOrganizacionEjemplo } from "./organizacion";
import { PRODUCTOS, UN_DE_RUBRO, seedListas, seedProveedores, seedRubros, type ProductoSpec } from "./catalogo";
import { seedClientes } from "./clientes";
import { generarOperaciones } from "./operaciones";
import { generarMovimientosDesdeOperaciones } from "./movimientos";

/** Productos que quedan bajo mínimo a propósito para que las alertas luzcan. */
const BAJO_MINIMO = ["70102", "60401", "86005", "20207", "84002", "83005", "30107"];

/**
 * Estado con SOLO la estructura de la empresa: Aceros RNF, 2 sucursales con sus depósitos y
 * posiciones de carga, 2 unidades de negocio con sus rubros (sin artículos), 3 listas de precios
 * (sin precios), motivos de ajuste, 4 usuarios, configuración y numeración en 0.
 * Cero clientes, proveedores, artículos, movimientos, documentos, adjuntos y auditoría.
 */
export function seedBase(hoyParam: Date = new Date(), ts = hoyParam.toISOString()): EstadoInicial {
  const org = seedOrganizacionBase(ts);
  return {
    sucursales: org.sucursales,
    depositos: org.depositos,
    usuarios: org.usuarios,
    unidadesNegocio: org.unidadesNegocio,
    rubros: seedRubros(ts),
    proveedores: [],
    productos: [],
    listasPrecios: seedListas(ts),
    precios: [],
    stock: [],
    movimientos: [],
    transferencias: [],
    ajustes: [],
    ordenesCompra: [],
    recepciones: [],
    acopiosProveedor: [],
    clientes: [],
    obras: [],
    cotizaciones: [],
    notasPedido: [],
    devoluciones: [],
    ajustesAcopio: [],
    acopios: [],
    remitos: [],
    adjuntos: [],
    comprobantes: [],
    vehiculos: [],
    choferes: [],
    despachos: [],
    hojasRuta: [],
    cobranzas: [],
    pagosProveedores: [],
    cheques: [],
    auditoria: [],
    config: configInicial(),
    numeradores: {},
  };
}

/**
 * Datos de ejemplo completos de Aceros RNF, construidos sobre `seedBase()`, con fechas relativas
 * a `hoy` (últimos ~6 meses). Determinístico: siempre genera los mismos datos.
 */
export function seedEjemplo(hoyParam: Date = new Date()): EstadoInicial {
  const R = crearRandom(20261005);
  const cal = crearCalendario(hoyParam);
  const ts0 = cal.dia(-280, 9);

  const base = seedBase(hoyParam, ts0);
  const extra = seedOrganizacionEjemplo(ts0);
  const org = { sucursales: base.sucursales, depositos: base.depositos, unidadesNegocio: base.unidadesNegocio, usuarios: [...base.usuarios, ...extra.usuarios], vehiculos: extra.vehiculos, choferes: extra.choferes };
  const rubros = base.rubros;
  const proveedores = seedProveedores(ts0);
  const listasPrecios = base.listasPrecios;
  const { clientes, obras } = seedClientes(ts0);

  // ── Productos (id = prod_<código>) ──
  const specs = new Map<string, ProductoSpec>();
  const productos: Producto[] = PRODUCTOS.map((s, i) => {
    const id = `prod_${s.codigo}`;
    specs.set(id, s);
    return {
      id,
      codigo: s.codigo,
      nombre: s.nombre,
      rubroId: s.rubro,
      unidadNegocioId: UN_DE_RUBRO[s.rubro],
      marca: s.marca,
      unidad: s.unidad,
      unidadesPorPallet: s.pallet,
      proveedorHabitualId: s.proveedor,
      costoUltimo: s.costo,
      costoPromedio: s.costo,
      fechaUltimoCosto: cal.dia(-200, 8),
      stockMinimo: 0,
      activo: true,
      codigoBarras: `779${String(1000000000 + i * 7919).slice(0, 10)}`,
      pesoKg: s.pesoKg,
      creadoEn: ts0,
      actualizadoEn: ts0,
    };
  });

  // ── Precios de hoy: costo de reposición + markup de la lista ──
  const precios: PrecioProducto[] = [];
  const precioMap = new Map<string, number>();
  for (const p of productos)
    for (const l of listasPrecios) {
      const precio = calcularPrecioDesdeMarkup(specs.get(p.id)!.costo, l.markupPorDefecto, p.unidad === "UN" && specs.get(p.id)!.costo < 1000 ? 1 : 10);
      precioMap.set(`${p.id}|${l.id}`, precio);
      precios.push({ id: `pre_${p.id}_${l.id}`, productoId: p.id, listaPreciosId: l.id, precio, creadoEn: ts0, actualizadoEn: cal.dia(-R.int(3, 20), 9) });
    }

  // ── Operaciones ──
  const ops = generarOperaciones({
    R,
    cal,
    ahora: hoyParam,
    productos,
    specs,
    clientes,
    obras,
    proveedores,
    sucursales: org.sucursales,
    depositos: org.depositos,
    precioHoy: (pid, lista) => precioMap.get(`${pid}|${lista}`) ?? 0,
  });
  const depositos = org.depositos.map((d) => d.id);
  const costoInicial = new Map(productos.map((p) => [p.id, Math.round(specs.get(p.id)!.costo * 0.88 * 100) / 100]));
  const flujos = { productos, depositos, recepciones: ops.recepciones, remitos: ops.remitos, transferencias: ops.transferencias, notasPedido: ops.notasPedido, costoInicial };

  // Pasada 1: flujos sin inventario inicial, para calibrar la apertura.
  const pasada1 = generarMovimientosDesdeOperaciones({ ...flujos, ajustes: ops.ajustes });

  const esBajoMinimo = (p: Producto) => BAJO_MINIMO.includes(p.codigo);
  const objetivo = (p: Producto, dep: string) => {
    const s = specs.get(p.id)!;
    const factor = dep === "dep_central" ? 1 : 0.5;
    let q: number;
    if (p.unidad === "KG") q = R.int(30, 80) * 100;
    else if (p.unidad === "M3") q = R.int(25, 60);
    else if (p.unidad === "TN") q = R.int(30, 90);
    else
      switch (s.perfil) {
        case "granel":
          q = (s.pallet ?? 60) * R.int(4, 10);
          break;
        case "medio":
          q = s.pallet ? s.pallet * R.int(2, 5) : R.int(60, 240);
          break;
        case "unidad":
          q = R.int(4, 14);
          break;
        default:
          q = R.int(12, 60);
      }
    if (esBajoMinimo(p)) q = q * 0.12;
    return Math.round(q * factor);
  };

  const fechaApertura = cal.dia(-280, 7, 30);
  const apertura: AjusteStock[] = org.depositos.map((d, i) => ({
    id: `aju_apertura_${i + 1}`,
    numero: "",
    depositoId: d.id,
    items: [],
    usuarioId: "usr_natalia",
    fecha: fechaApertura,
    observacion: "Inventario inicial (migración desde el sistema anterior)",
    creadoEn: fechaApertura,
    actualizadoEn: fechaApertura,
  }));
  const caso = ops.casoLimite;
  for (const p of productos) {
    for (const [i, dep] of depositos.entries()) {
      const k = `${p.id}|${dep}`;
      const minimo = pasada1.minimos.get(k) ?? 0;
      const final0 = pasada1.finales.get(k) ?? 0;
      const comprometido = calcularPendienteEntrega(p.id, dep, ops.notasPedido, ops.remitos) + calcularReservado(p.id, dep, ops.remitos);
      const meta = p.id === caso.productoId && dep === caso.depositoId ? caso.disponible + comprometido : objetivo(p, dep) + comprometido;
      const cantidad = Math.ceil(Math.max(-minimo, meta - final0));
      if (cantidad > 0) apertura[i].items.push({ productoId: p.id, cantidad, signo: 1, motivo: "OTRO" });
      // Caso límite: si la historia obligó a abrir con más stock, se corrige con una rotura reciente para dejar el disponible exacto.
      const exceso = Math.round((Math.max(0, cantidad) + final0 - meta) * 1000) / 1000;
      if (p.id === caso.productoId && dep === caso.depositoId && exceso > 0) {
        const f = cal.dia(-1, 18, 10);
        ops.ajustes.push({ id: "aju_caso_limite", numero: "", depositoId: dep, items: [{ productoId: p.id, cantidad: exceso, signo: -1, motivo: "ROTURA" }], usuarioId: "usr_hugo", fecha: f, observacion: "Bolsas rotas en la estiba", creadoEn: f, actualizadoEn: f });
      }
    }
  }
  const ajustes = [...apertura, ...ops.ajustes].sort((a, b) => a.fecha.localeCompare(b.fecha));
  ajustes.forEach((a, i) => (a.numero = formatearDoc("AJU", null, "0001", 600 + i + 1)));

  // Pasada 2: movimientos definitivos, stock final, costos y snapshots.
  const res = generarMovimientosDesdeOperaciones({ ...flujos, ajustes });
  for (const p of productos) {
    const c = res.costos.get(p.id)!;
    p.costoUltimo = c.costoUltimo;
    p.costoPromedio = c.costoPromedio;
    p.fechaUltimoCosto = c.fechaUltimoCosto;
  }
  for (const np of ops.notasPedido)
    if (np.origen === "NUEVA") for (const it of np.items) it.costoUnitarioSnapshot = res.snapshots.get(it.id) ?? costoInicial.get(it.productoId) ?? 0;
  for (const c of ops.comprobantes)
    for (const it of c.items ?? []) it.costoUnitarioSnapshot = res.snapshots.get(it.id) ?? 0;

  // Stock mínimo: normal por debajo del físico; algunos a propósito por encima.
  for (const p of productos) {
    const total = res.stock.filter((s) => s.productoId === p.id).reduce((a, s) => a + s.cantidadFisica, 0);
    const pallet = p.unidadesPorPallet;
    const redondeo = (q: number) => (pallet && q >= pallet ? Math.round(q / pallet) * pallet : q >= 50 ? Math.round(q / 10) * 10 : Math.max(1, Math.round(q)));
    if (esBajoMinimo(p)) p.stockMinimo = Math.max(redondeo(total * R.float(1.8, 2.6)), Math.ceil(total) + 1);
    else p.stockMinimo = Math.min(redondeo(total * R.float(0.2, 0.4)), Math.max(1, Math.floor(total * 0.6)));
  }

  // Un cliente excedido de su límite de crédito (para la alerta del tablero)
  const saldoCli = (id: string) => ops.comprobantes.filter((c) => c.clienteId === id && c.estado !== "ANULADO").reduce((a, c) => a + c.saldoPendiente, 0);
  const naku = clientes.find((c) => c.id === "cli_naku")!;
  const sNaku = saldoCli("cli_naku");
  if (sNaku > 0) naku.limiteCredito = Math.max(1_000_000, Math.floor((sNaku * 0.8) / 500_000) * 500_000);

  // Estado de acopios de proveedores: agotado cuando no queda nada por pedir.
  const numeradores = numeradoresDesde([...ops.numeros, ...ajustes.map((a) => a.numero)]);

  return {
    ...base,
    sucursales: org.sucursales,
    depositos: org.depositos,
    usuarios: org.usuarios,
    unidadesNegocio: org.unidadesNegocio,
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
    acopiosProveedor: ops.acopiosProveedor,
    clientes,
    obras,
    cotizaciones: ops.cotizaciones,
    notasPedido: ops.notasPedido,
    devoluciones: ops.devoluciones,
    ajustesAcopio: ops.ajustesAcopio,
    acopios: ops.acopios,
    remitos: ops.remitos,
    adjuntos: ops.adjuntos,
    comprobantes: ops.comprobantes,
    vehiculos: org.vehiculos,
    choferes: org.choferes,
    despachos: ops.despachos,
    hojasRuta: ops.hojasRuta,
    cobranzas: ops.cobranzas,
    pagosProveedores: ops.pagosProveedores,
    cheques: ops.cheques,
    auditoria: ops.auditoria,
    numeradores,
  };
}

/** @deprecated usar `seedEjemplo` (datos completos) o `seedBase` (solo estructura). */
export const crearSeed = seedEjemplo;

export function configInicial(): EstadoInicial["config"] {
  return {
    ivaPct: 21,
    validezPresupuestoDias: 7,
    diasVencimientoAcopio: 180,
    alicuotaIIBBPct: 0,
    alertaStockMinimo: true,
    umbralSubaCostoPct: 3,
    tipoCambioUSD: 1450,
    tamanoMaxAdjuntoMB: 10,
    categoriasAdjunto: [
      { codigo: "REMITO_FIRMADO", nombre: "Remito firmado" },
      { codigo: "FACTURA_PROVEEDOR", nombre: "Factura de proveedor" },
      { codigo: "OTRO", nombre: "Otro" },
    ],
    motivosAjuste: [
      { codigo: "INVENTARIO_INICIAL", nombre: "Inventario inicial", activo: true },
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
  };
}
