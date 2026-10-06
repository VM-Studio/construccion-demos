/**
 * Datos del "Estado de desacopio" en el formato del documento real de la empresa,
 * compartidos por la pantalla, el PDF (jsPDF) y el Excel (exceljs).
 */
import type { EstadoInicial } from "@/domain/types";
import { movimientosAcopio, resumenArticulos, saldoDisponible } from "@/domain/acopios";
import { formatDate } from "@/lib/format";

export interface LineaDoc {
  codigo: string;
  descripcion: string;
  obra: string;
  cantidad: number;
  entregados: number;
  saldo: number;
  remitos: string[];
  facturas: string[];
  precio: number;
  subtotal: number;
  saldoDisponible: number;
}

export interface GrupoDoc {
  titulo: string;
  lineas: LineaDoc[];
}

export interface ArticuloDoc {
  codigo: string;
  articulo: string;
  precio: number;
  cantidad: number;
  bajas: number;
  saldo: number;
}

export interface DocDesacopio {
  /** Título de la descarga (pie de página). */
  tipo: string;
  numero: string;
  encabezado: string[];
  columnas: string[];
  columnasArticulos: string[];
  grupos: GrupoDoc[];
  articulos: ArticuloDoc[];
  archivo: string;
}

/** Texto sin acentos y en mayúsculas, como lo imprime el sistema actual. */
export function mayusculasSinAcentos(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

/** Monto del grupo sin separador de miles y con punto decimal (ej. 997707.94). */
export function montoPlano(n: number) {
  return String(Math.round(n * 1000) / 1000);
}

const pesos = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** `$ 1.293,12` / `-$ 980,80` (con guion ASCII, apto para la fuente del PDF). */
export function dinero(n: number) {
  const v = Math.round(n * 100) / 100;
  return `${v < 0 ? "-" : ""}$ ${pesos.format(Math.abs(v))}`;
}
/** Cantidades a 3 decimales con punto: `300.000`, `-300.000`. */
export function cantidad3(n: number) {
  return (Math.round(n * 1000) / 1000).toFixed(3);
}

export function nombreArchivo(numero: string, nombre: string, prefijo = "Desacopio") {
  const num = numero.replace(/\s+/g, "-");
  const nom = mayusculasSinAcentos(nombre).replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${prefijo}_${num}_${nom}`;
}

/** Documento del acopio de un cliente. */
export function documentoAcopio(db: EstadoInicial, acopioId: string): DocDesacopio {
  const a = db.acopios.find((x) => x.id === acopioId);
  if (!a) throw new Error("Acopio inexistente");
  const c = db.clientes.find((x) => x.id === a.clienteId)!;
  const saldo = saldoDisponible(a, db.notasPedido, db.devoluciones, db.ajustesAcopio);
  const obras = db.obras.filter((o) => a.obraIds.includes(o.id));
  const facturas = db.comprobantes.filter((x) => a.comprobanteIds.includes(x.id) && x.tipo === "FACTURA").map((x) => x.numero);
  const recibos = db.cobranzas.filter((r) => a.reciboIds.includes(r.id)).map((r) => r.numero);
  const codCliente = c.codigo.replace(/^\D+/, "").replace(/^0+(?=\d{3})/, "");
  const grupos = movimientosAcopio(a, db.notasPedido, db.devoluciones, db.ajustesAcopio, db).map((g) => ({
    titulo: `${g.numero}, Fecha: ${formatDate(g.fecha)}, Monto: ${montoPlano(g.monto)}`,
    lineas: g.lineas.map((l) => ({
      codigo: l.codigo,
      descripcion: l.descripcion,
      obra: l.obra,
      cantidad: l.cantidad,
      entregados: l.entregados,
      saldo: l.saldo,
      remitos: l.remitos.map((r) => r.numero),
      facturas: l.facturas,
      precio: l.precio,
      subtotal: l.subtotal,
      saldoDisponible: l.saldoDisponible,
    })),
  }));
  const articulos = resumenArticulos(a, db.notasPedido, db.devoluciones, db.productos, db.remitos).map((r) => ({ codigo: r.codigo, articulo: r.articulo, precio: r.precio, cantidad: r.cantidad, bajas: r.bajas, saldo: r.saldo }));
  return {
    tipo: "Estado de acopio",
    numero: a.numero,
    encabezado: [
      `Detalle de: ${a.numero}, Cliente: ${mayusculasSinAcentos(c.razonSocial)} (${codCliente})`,
      `Fecha de Creacion: ${formatDate(a.fechaCreacion)}`,
      `Fecha de Vencimiento: ${formatDate(a.fechaVencimiento)}`,
      "",
      "Obras:",
      ...obras.map((o) => `. ${o.nombre}`),
      "",
      `Importe con (IIBB): ${dinero(a.importeConIIBB)}`,
      `Importe: ${dinero(a.importe)}`,
      `Saldo: ${dinero(saldo)}`,
      `Factura: ${facturas.join(" ")}`,
      `Recibo: ${recibos.join(" ")}`,
    ],
    columnas: ["Codigo", "Descripcion", "Obra", "Cantidad", "Entregados", "Saldo", "Remitos", "Facturas", "Precio", "Subtotal", "Saldo disponible"],
    columnasArticulos: ["Codigo", "Articulo", "Precio congelado", "Cantidad", "Baja de Articulos", "Saldo"],
    grupos,
    articulos,
    archivo: nombreArchivo(a.numero, c.razonSocial),
  };
}

/** Documento espejo para un acopio con proveedor (OC en lugar de NP, recepciones en lugar de remitos). */
export function documentoAcopioProveedor(db: EstadoInicial, acpId: string): DocDesacopio {
  const a = db.acopiosProveedor.find((x) => x.id === acpId);
  if (!a) throw new Error("Acopio con proveedor inexistente");
  const prov = db.proveedores.find((p) => p.id === a.proveedorId)!;
  const prod = new Map(db.productos.map((p) => [p.id, p]));
  const ocs = db.ordenesCompra.filter((o) => o.acopioProveedorId === a.id && o.estado !== "BORRADOR" && o.estado !== "CANCELADA").sort((x, y) => x.fechaEmision.localeCompare(y.fechaEmision));
  const facturas = db.comprobantes.filter((c) => a.comprobanteCompraIds.includes(c.id)).map((c) => c.numero);
  const ops = db.pagosProveedores.filter((o) => a.ordenPagoIds.includes(o.id)).map((o) => o.numero);
  let saldo = a.importe;
  const grupos: GrupoDoc[] = ocs.map((o) => {
    const recs = db.recepciones.filter((r) => r.ordenCompraId === o.id);
    const monto = o.items.reduce((s, i) => s + i.cantidadPedida * i.costoUnitario, 0);
    return {
      titulo: `${o.numero}, Fecha: ${formatDate(o.fechaEmision)}, Monto: ${montoPlano(monto)}`,
      lineas: o.items.map((i) => {
        const sub = i.cantidadPedida * i.costoUnitario;
        saldo -= sub;
        return {
          codigo: prod.get(i.productoId)?.codigo ?? "",
          descripcion: prod.get(i.productoId)?.nombre ?? "",
          obra: db.depositos.find((d) => d.id === o.depositoDestinoId)?.nombre ?? "",
          cantidad: i.cantidadPedida,
          entregados: i.cantidadRecibida,
          saldo: Math.max(0, i.cantidadPedida - i.cantidadRecibida),
          remitos: recs.filter((r) => r.items.some((x) => x.itemOCId === i.id)).map((r) => r.numero),
          facturas,
          precio: i.costoUnitario,
          subtotal: sub,
          saldoDisponible: Math.round(saldo * 100) / 100,
        };
      }),
    };
  });
  const pedido = new Map<string, number>();
  const recibido = new Map<string, number>();
  for (const o of ocs)
    for (const i of o.items) {
      pedido.set(i.productoId, (pedido.get(i.productoId) ?? 0) + i.cantidadPedida);
      recibido.set(i.productoId, (recibido.get(i.productoId) ?? 0) + i.cantidadRecibida);
    }
  const articulos = a.preciosCongelados
    .map((c) => ({ codigo: prod.get(c.productoId)?.codigo ?? "", articulo: prod.get(c.productoId)?.nombre ?? "", precio: c.costo, cantidad: (pedido.get(c.productoId) ?? 0) - (recibido.get(c.productoId) ?? 0), bajas: 0, saldo: -(recibido.get(c.productoId) ?? 0) }))
    .sort((x, y) => Number(x.codigo) - Number(y.codigo));
  return {
    tipo: "Detalle de acopio con proveedor",
    numero: a.numero,
    encabezado: [
      `Detalle de acopio con proveedor: ${a.numero}, Proveedor: ${mayusculasSinAcentos(prov.razonSocial)} (${prov.codigo})`,
      `Fecha de Creacion: ${formatDate(a.fechaCreacion)}`,
      `Fecha de Vencimiento: ${formatDate(a.fechaVencimiento)}`,
      "",
      `Modalidad: ${a.modalidad === "CANTIDAD" ? "Por cantidades" : "Por monto"}`,
      ...(a.items ?? []).map((it) => `. ${prod.get(it.productoId)?.nombre}: ${it.cantidadPactada} pactadas`),
      "",
      `Importe: ${dinero(a.importe)}`,
      `Pagado: ${dinero(a.pagado)}`,
      `Saldo: ${dinero(saldo)}`,
      `Factura de compra: ${facturas.join(" ")}`,
      `Orden de pago: ${ops.join(" ")}`,
    ],
    columnas: ["Codigo", "Descripcion", "Deposito", "Cantidad", "Recibidos", "Saldo", "Recepciones", "Facturas de compra", "Costo congelado", "Subtotal", "Saldo disponible"],
    columnasArticulos: ["Codigo", "Articulo", "Costo congelado", "Pendiente", "Baja de Articulos", "Saldo"],
    grupos,
    articulos,
    archivo: nombreArchivo(a.numero, prov.razonSocial, "AcopioProveedor"),
  };
}
