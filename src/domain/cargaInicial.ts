import type { EstadoInicial } from "./types";

/**
 * Guía de carga inicial: los pasos en el orden en que cada uno habilita al siguiente.
 * El check de cada paso se calcula solo, mirando los datos.
 */

export type AccionPaso = "importarArticulos" | "importarClientes" | "importarProveedores" | "calcularPrecios";

export interface PasoCarga {
  id: string;
  titulo: string;
  descripcion: string;
  /** "Qué vas a ver después". */
  despues: string;
  href: string;
  /** Texto del link principal. */
  ir: string;
  /** Botón secundario (importar CSV, calcular precios). */
  secundaria?: { label: string; accion: AccionPaso };
  hecho: boolean;
  /** "3 cargados", "12 de 40 con precio". */
  progreso?: string;
}

export function pasosCargaInicial(db: EstadoInicial): PasoCarga[] {
  const activos = db.productos.filter((p) => p.activo);
  const un = (codigo: "FER" | "COR") => db.unidadesNegocio.find((u) => u.codigo === codigo)?.id;
  const fer = activos.filter((p) => p.unidadNegocioId === un("FER")).length;
  const cor = activos.filter((p) => p.unidadNegocioId === un("COR")).length;

  const listas = db.listasPrecios.filter((l) => l.activa);
  const conPrecio = new Set(db.precios.filter((p) => p.precio > 0).map((p) => `${p.productoId}|${p.listaPreciosId}`));
  const completos = activos.filter((p) => listas.every((l) => conPrecio.has(`${p.id}|${l.id}`))).length;

  const clientesConObra = new Set(db.obras.filter((o) => o.activa).map((o) => o.clienteId));
  const inventario = db.ajustes.filter((a) => a.items.some((i) => i.motivo === "INVENTARIO_INICIAL"));
  const ventas = db.notasPedido.filter((n) => n.estado !== "BORRADOR" && n.estado !== "ANULADA");
  const remitosVenta = db.remitos.filter((r) => r.notaPedidoId && r.estado !== "ANULADO" && r.tipo !== "DEVOLUCION");
  const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

  return [
    {
      id: "articulos",
      titulo: "Artículos",
      descripcion: "Cargá al menos un artículo de Ferretería y uno de Corralón.",
      despues: "El artículo aparece en Stock con 0 en cada depósito y ya se puede comprar, vender y acopiar.",
      href: "/productos",
      ir: "Ir a artículos",
      secundaria: { label: "Importar desde CSV", accion: "importarArticulos" },
      hecho: fer > 0 && cor > 0,
      progreso: activos.length ? `${cor} de Corralón · ${fer} de Ferretería` : undefined,
    },
    {
      id: "precios",
      titulo: "Precios",
      descripcion: "Las listas de precios tienen que tener precio para esos artículos.",
      despues: "Cada venta toma el precio de la lista del cliente y cada acopio congela la lista del día.",
      href: "/ventas/listas-precios",
      ir: "Ver listas de precios",
      secundaria: { label: "Calcular desde costo + markup", accion: "calcularPrecios" },
      hecho: activos.length > 0 && completos === activos.length,
      progreso: activos.length ? `${completos} de ${activos.length} con precio en todas las listas` : undefined,
    },
    {
      id: "proveedores",
      titulo: "Proveedores",
      descripcion: "Cargá los proveedores a los que les comprás.",
      despues: "Aparecen en Compras para hacerles órdenes y en Cuentas corrientes con saldo $ 0.",
      href: "/proveedores",
      ir: "Ir a proveedores",
      secundaria: { label: "Importar desde CSV", accion: "importarProveedores" },
      hecho: db.proveedores.length > 0,
      progreso: db.proveedores.length ? plural(db.proveedores.length, "cargado", "cargados") : undefined,
    },
    {
      id: "clientes",
      titulo: "Clientes y obras",
      descripcion: "Cargá los clientes y al menos una obra de cada uno.",
      despues: "Cada cliente tiene su ficha con acopios, ventas, cuenta corriente y pendientes de entrega.",
      href: "/clientes",
      ir: "Ir a clientes",
      secundaria: { label: "Importar desde CSV", accion: "importarClientes" },
      hecho: db.clientes.length > 0 && clientesConObra.size > 0,
      progreso: db.clientes.length ? `${plural(db.clientes.length, "cliente", "clientes")} · ${plural(db.obras.length, "obra", "obras")}` : undefined,
    },
    {
      id: "inventario",
      titulo: "Inventario inicial",
      descripcion: "Cargá lo que ya tienen en cada depósito.",
      despues: "Stock físico y disponible por depósito, la valorización y las alertas de reposición.",
      href: "/stock/ajustes?nuevo=1&motivo=INVENTARIO_INICIAL",
      ir: "Cargar inventario inicial",
      hecho: inventario.length > 0,
      progreso: inventario.length ? plural(inventario.length, "ajuste de inventario", "ajustes de inventario") : undefined,
    },
    {
      id: "compra",
      titulo: "Primera compra",
      descripcion: "Hacé una orden de compra, confirmala y registrá su ingreso.",
      despues: "Stock físico, costo del artículo y deuda con el proveedor.",
      href: "/compras/oc/nueva",
      ir: "Nueva orden de compra",
      hecho: db.recepciones.length > 0,
      progreso: db.ordenesCompra.length ? `${plural(db.ordenesCompra.length, "OC", "OC")} · ${plural(db.recepciones.length, "ingreso", "ingresos")}` : undefined,
    },
    {
      id: "acopio",
      titulo: "Primer acopio",
      descripcion: "El cliente deja plata para retirar materiales a precio congelado.",
      despues: "Saldo disponible del acopio, su factura, la deuda de mercadería y el estado de desacopio.",
      href: "/acopios/nuevo",
      ir: "Nuevo acopio",
      hecho: db.acopios.length > 0,
      progreso: db.acopios.length ? plural(db.acopios.length, "acopio", "acopios") : undefined,
    },
    {
      id: "venta",
      titulo: "Primera venta y su remito",
      descripcion: "Confirmá una nota de pedido y generá su remito.",
      despues: "Pendiente de entrega, disponible, despachos y, al marcar el remito Hecho, el stock físico.",
      href: "/ventas/notas-pedido/nueva",
      ir: "Nueva nota de pedido",
      hecho: ventas.length > 0 && remitosVenta.length > 0,
      progreso: ventas.length ? `${plural(ventas.length, "venta", "ventas")} · ${plural(remitosVenta.length, "remito", "remitos")}` : undefined,
    },
    {
      id: "cobro",
      titulo: "Primer cobro",
      descripcion: "Registrá un recibo contra una factura o un acopio.",
      despues: "La cuenta corriente del cliente baja y, si pagó con cheque, queda en cartera.",
      href: "/ventas/recibos?nuevo=1",
      ir: "Registrar cobro",
      hecho: db.cobranzas.length > 0,
      progreso: db.cobranzas.length ? plural(db.cobranzas.length, "recibo", "recibos") : undefined,
    },
  ];
}
