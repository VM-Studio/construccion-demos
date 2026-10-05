import type { Comprobante, EstadoPresupuesto, ItemVenta, Pedido, Presupuesto, TipoComprobante } from "@/domain/types";
import { calcularTotales } from "@/domain/ventas";
import { calcularComprometido } from "@/domain/stock";
import { saldoCliente } from "@/domain/cuentasCorrientes";
import { puede } from "@/domain/permisos";
import { formatMoney } from "@/lib/format";
import { newId } from "@/lib/utils";
import { ErrorNegocio, ejecutar, exigir, r2 } from "../helpers";
import { actualizarEstadoPedido, crearFacturaVenta, puntoVentaDe } from "../ops";
import type { GetFn, SetFn } from "../types";

export type PresupuestoInput = Pick<Presupuesto, "clienteId" | "sucursalId" | "vendedorId" | "fecha" | "validezDias" | "items" | "descuentoPct" | "observaciones">;
export type PedidoInput = Pick<
  Pedido,
  | "clienteId"
  | "sucursalId"
  | "depositoId"
  | "vendedorId"
  | "fecha"
  | "fechaEntregaComprometida"
  | "items"
  | "descuentoPct"
  | "condicionPago"
  | "modalidadEntrega"
  | "direccionEntrega"
  | "observaciones"
>;

export interface ValidacionConfirmacion {
  faltantes: { itemId: string; productoId: string; pedido: number; disponible: number; faltante: number }[];
  credito: { excede: boolean; saldo: number; limite: number; total: number };
}

const limpiarItems = (items: ItemVenta[]) => items.filter((i) => i.productoId && i.cantidad > 0);

/** Ventas: presupuestos, pedidos, facturación y anulación. */
export function crearSliceVentas(set: SetFn, get: GetFn) {
  const validar = (pedidoId: string): ValidacionConfirmacion => {
    const db = get().db;
    const p = db.pedidos.find((x) => x.id === pedidoId)!;
    const faltantes: ValidacionConfirmacion["faltantes"] = [];
    // Disponible sin contar este pedido (está en borrador, no compromete).
    const usado = new Map<string, number>();
    for (const it of p.items) {
      const fis = db.stock.find((s) => s.productoId === it.productoId && s.depositoId === p.depositoId)?.cantidadFisica ?? 0;
      // El pedido está en borrador: no se cuenta a sí mismo en el comprometido.
      const comp = calcularComprometido(it.productoId, p.depositoId, db.pedidos, db.acopios, db.despachos);
      const disp = fis - comp - (usado.get(it.productoId) ?? 0);
      usado.set(it.productoId, (usado.get(it.productoId) ?? 0) + it.cantidad);
      if (it.cantidad > disp + 1e-9) faltantes.push({ itemId: it.id, productoId: it.productoId, pedido: it.cantidad, disponible: Math.max(0, disp), faltante: it.cantidad - Math.max(0, disp) });
    }
    const cliente = db.clientes.find((c) => c.id === p.clienteId)!;
    const saldo = saldoCliente(cliente.id, db.comprobantes);
    const ctaCte = p.condicionPago.startsWith("CTA_CTE");
    return { faltantes, credito: { excede: ctaCte && saldo + p.total > cliente.limiteCredito, saldo, limite: cliente.limiteCredito, total: p.total } };
  };

  return {
    // ───────────── Presupuestos ─────────────
    guardarPresupuesto: (data: PresupuestoInput, id?: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.editar");
        if (!data.clienteId) throw new ErrorNegocio("Elegí un cliente.");
        const items = limpiarItems(data.items);
        if (!items.length) throw new ErrorNegocio("Agregá al menos un producto.");
        const t = calcularTotales(items, data.descuentoPct, tx.config.ivaPct);
        const campos = { ...data, items, subtotal: t.subtotal, iva: t.iva, total: t.total };
        if (id) {
          const pr = tx.must("presupuestos", id);
          if (pr.estado !== "BORRADOR" && pr.estado !== "ENVIADO") throw new ErrorNegocio("Este presupuesto ya no se puede editar.");
          tx.patch("presupuestos", id, campos);
          tx.auditar("Editó presupuesto", "Presupuesto", id, pr.numero);
          return id;
        }
        const pr: Presupuesto = { id: newId("pre"), numero: tx.numero("PRE"), estado: "BORRADOR", ...campos, ...tx.meta() };
        tx.insert("presupuestos", pr);
        tx.auditar("Creó presupuesto", "Presupuesto", pr.id, `${pr.numero} · ${tx.find("clientes", pr.clienteId)?.razonSocial ?? ""}`);
        return pr.id;
      }),

    cambiarEstadoPresupuesto: (id: string, estado: EstadoPresupuesto) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.editar");
        const pr = tx.must("presupuestos", id);
        if (pr.pedidoId) throw new ErrorNegocio("El presupuesto ya fue convertido en pedido.");
        tx.patch("presupuestos", id, { estado });
        const acc = { ENVIADO: "Envió presupuesto", ACEPTADO: "Marcó presupuesto aceptado", RECHAZADO: "Rechazó presupuesto", BORRADOR: "Volvió presupuesto a borrador", VENCIDO: "Venció presupuesto" }[estado];
        tx.auditar(acc, "Presupuesto", id, pr.numero);
      }),

    /** Crea un pedido con los mismos ítems y congela el costo promedio actual. */
    convertirEnPedido: (presupuestoId: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.editar");
        const pr = tx.must("presupuestos", presupuestoId);
        if (pr.pedidoId) throw new ErrorNegocio("Este presupuesto ya tiene un pedido.");
        const cliente = tx.must("clientes", pr.clienteId);
        const suc = tx.must("sucursales", pr.sucursalId);
        const items = pr.items.map((i) => ({ ...i, id: newId("itv"), costoUnitarioSnapshot: tx.must("productos", i.productoId).costoPromedio, cantidadDespachada: 0 }));
        const t = calcularTotales(items, pr.descuentoPct, tx.config.ivaPct);
        const p: Pedido = {
          id: newId("ped"),
          numero: tx.numero("PED"),
          clienteId: pr.clienteId,
          sucursalId: pr.sucursalId,
          depositoId: suc.depositoId,
          vendedorId: pr.vendedorId,
          presupuestoId: pr.id,
          estado: "BORRADOR",
          fecha: tx.ahora,
          items,
          subtotal: t.subtotal,
          descuentoPct: pr.descuentoPct,
          iva: t.iva,
          total: t.total,
          condicionPago: cliente.condicionPago,
          modalidadEntrega: "ENVIO",
          direccionEntrega: `${cliente.direccion}, ${cliente.localidad}`,
          observaciones: pr.observaciones,
          ...tx.meta(),
        };
        tx.insert("pedidos", p);
        tx.patch("presupuestos", pr.id, { estado: "ACEPTADO", pedidoId: p.id });
        tx.auditar("Convirtió presupuesto en pedido", "Pedido", p.id, `${pr.numero} → ${p.numero}`);
        return p.id;
      }),

    // ───────────── Pedidos ─────────────
    guardarPedido: (data: PedidoInput, id?: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.editar");
        if (!data.clienteId) throw new ErrorNegocio("Elegí un cliente.");
        const items = limpiarItems(data.items);
        if (!items.length) throw new ErrorNegocio("Agregá al menos un producto.");
        if (data.modalidadEntrega === "ENVIO" && !data.direccionEntrega?.trim()) throw new ErrorNegocio("Ingresá la dirección de entrega.");
        const t = calcularTotales(items, data.descuentoPct, tx.config.ivaPct);
        const campos = { ...data, items, subtotal: t.subtotal, iva: t.iva, total: t.total };
        if (id) {
          const p = tx.must("pedidos", id);
          if (p.estado !== "BORRADOR") throw new ErrorNegocio("Sólo se pueden editar pedidos en borrador.");
          tx.patch("pedidos", id, campos);
          tx.auditar("Editó pedido", "Pedido", id, p.numero);
          return id;
        }
        const p: Pedido = { id: newId("ped"), numero: tx.numero("PED"), estado: "BORRADOR", ...campos, ...tx.meta() };
        tx.insert("pedidos", p);
        tx.auditar("Creó pedido", "Pedido", p.id, `${p.numero} · ${tx.find("clientes", p.clienteId)?.razonSocial ?? ""}`);
        return p.id;
      }),

    validarConfirmacion: validar,

    /**
     * Confirma el pedido: compromete stock y congela el costo snapshot.
     * Si falta disponible requiere `permitirBackorder`; si excede el crédito,
     * VENTAS queda bloqueado y DUEÑO/ADMIN deben `autorizarExcepcion`.
     */
    confirmarPedido: (id: string, opts: { permitirBackorder?: boolean; autorizarExcepcion?: boolean } = {}) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.confirmar");
        const p = tx.must("pedidos", id);
        if (p.estado !== "BORRADOR") throw new ErrorNegocio("El pedido ya fue confirmado.");
        const v = validar(id);
        if (v.faltantes.length && !opts.permitirBackorder) throw new ErrorNegocio("No hay disponible suficiente para todos los productos.", "FALTANTE");
        if (v.credito.excede) {
          const u = tx.find("usuarios", tx.usuarioId);
          if (!puede(u, "credito.autorizar"))
            throw new ErrorNegocio(`El cliente supera su límite de crédito (${formatMoney(v.credito.limite)}). Pedí autorización a Administración.`, "CREDITO_BLOQUEADO");
          if (!opts.autorizarExcepcion) throw new ErrorNegocio("El cliente supera su límite de crédito.", "CREDITO");
        }
        const falt = new Map(v.faltantes.map((f) => [f.itemId, f.faltante]));
        tx.patch("pedidos", id, (x) => ({
          ...x,
          estado: "CONFIRMADO" as const,
          fechaConfirmacion: tx.ahora,
          excepcionCredito: v.credito.excede || undefined,
          items: x.items.map((i) => ({ ...i, costoUnitarioSnapshot: tx.must("productos", i.productoId).costoPromedio, cantidadDespachada: 0, backorder: falt.get(i.id) || undefined })),
        }));
        tx.auditar("Confirmó pedido", "Pedido", id, `${p.numero}${v.faltantes.length ? ` · ${v.faltantes.length} líneas en backorder` : ""}`);
        if (v.credito.excede) tx.auditar("Autorizó excepción de crédito", "Pedido", id, `${p.numero} · saldo ${formatMoney(v.credito.saldo)} + ${formatMoney(p.total)} > límite ${formatMoney(v.credito.limite)}`);
      }),

    cancelarPedido: (id: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.editar");
        const p = tx.must("pedidos", id);
        if (p.estado === "CANCELADO") throw new ErrorNegocio("El pedido ya está cancelado.");
        if (p.estado === "FACTURADO") throw new ErrorNegocio("Anulá primero el comprobante del pedido.");
        if (p.items.some((i) => (i.cantidadDespachada ?? 0) > 0)) throw new ErrorNegocio("El pedido ya tiene mercadería despachada.");
        for (const d of tx.get("despachos"))
          if (d.origenTipo === "PEDIDO" && d.origenId === id && d.estado !== "CANCELADO") {
            tx.patch("despachos", d.id, { estado: "CANCELADO" });
            for (const h of tx.get("hojasRuta")) if (h.despachoIds.includes(d.id)) tx.patch("hojasRuta", h.id, { despachoIds: h.despachoIds.filter((x) => x !== d.id) });
          }
        tx.patch("pedidos", id, { estado: "CANCELADO" });
        tx.auditar("Canceló pedido", "Pedido", id, `${p.numero} · liberó stock comprometido`);
      }),

    facturarPedido: (id: string, data: { tipo: TipoComprobante; fecha: string; vencimiento: string }) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.facturar");
        const p = tx.must("pedidos", id);
        if (p.estado === "BORRADOR" || p.estado === "CANCELADO") throw new ErrorNegocio("Confirmá el pedido antes de facturar.");
        if (p.comprobanteId) throw new ErrorNegocio("El pedido ya está facturado.");
        const t = calcularTotales(p.items, p.descuentoPct, tx.config.ivaPct);
        const c = crearFacturaVenta(tx, {
          clienteId: p.clienteId,
          sucursalId: p.sucursalId,
          tipo: data.tipo,
          fecha: data.fecha,
          vencimiento: data.vencimiento,
          neto: t.neto,
          iva: t.iva,
          total: t.total,
          pedidoId: p.id,
          items: p.items,
          condicionPago: p.condicionPago,
        });
        tx.patch("pedidos", id, { estado: "FACTURADO", comprobanteId: c.id });
        tx.auditar("Facturó pedido", "Pedido", id, `${p.numero} · ${c.tipo === "FACTURA_A" ? "Factura A" : "Factura B"} ${c.numero}`);
        return c.id;
      }),

    /**
     * Anula un comprobante con una nota de crédito espejo. Lo cobrado queda como
     * saldo a favor del cliente. Si el pedido no se despachó, libera el stock.
     */
    anularComprobante: (id: string, motivo?: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.anular");
        const c = tx.must("comprobantes", id);
        if (c.estado === "ANULADO") throw new ErrorNegocio("El comprobante ya está anulado.");
        if (c.tipo !== "FACTURA_A" && c.tipo !== "FACTURA_B") throw new ErrorNegocio("Sólo se pueden anular facturas.");
        if (c.proveedorId) throw new ErrorNegocio("Las facturas de proveedores no se anulan desde acá.");
        if (c.acopioId) throw new ErrorNegocio("Para anular la factura de un acopio usá “Cancelar saldo” desde el acopio.");
        const cobrado = r2(c.total - c.saldoPendiente);
        const nc: Comprobante = {
          id: newId("cmp"),
          tipo: "NOTA_CREDITO",
          numero: tx.numeroFiscal(puntoVentaDe(tx, c.sucursalId ?? "suc_norte"), "NOTA_CREDITO"),
          clienteId: c.clienteId,
          pedidoId: c.pedidoId,
          comprobanteOrigenId: c.id,
          sucursalId: c.sucursalId,
          fecha: tx.ahora,
          subtotal: c.subtotal,
          iva: c.iva,
          total: c.total,
          saldoPendiente: -cobrado,
          estado: cobrado > 0 ? "PENDIENTE" : "PAGADO",
          aplicadoA: c.saldoPendiente > 0 ? [{ comprobanteId: c.id, importe: c.saldoPendiente }] : [],
          items: c.items,
          observaciones: motivo ?? `Anula ${c.numero}${cobrado > 0 ? ` · saldo a favor ${formatMoney(cobrado)}` : ""}`,
          ...tx.meta(),
        };
        tx.insert("comprobantes", nc);
        tx.patch("comprobantes", c.id, { estado: "ANULADO", saldoPendiente: 0 });
        if (c.pedidoId) {
          const p = tx.must("pedidos", c.pedidoId);
          const despachado = p.items.some((i) => (i.cantidadDespachada ?? 0) > 0);
          if (!despachado) {
            for (const d of tx.get("despachos"))
              if (d.origenTipo === "PEDIDO" && d.origenId === p.id && d.estado !== "CANCELADO") tx.patch("despachos", d.id, { estado: "CANCELADO" });
            tx.patch("pedidos", p.id, { estado: "CANCELADO", comprobanteId: undefined });
          } else {
            tx.patch("pedidos", p.id, { estado: "CONFIRMADO", comprobanteId: undefined });
            actualizarEstadoPedido(tx, p.id);
          }
        }
        tx.auditar("Anuló comprobante", "Comprobante", c.id, `${c.numero} con nota de crédito ${nc.numero}`);
        return nc.id;
      }),

    /** Disponible para despachar de un pedido (por línea). */
    pendientesDePedido: (pedidoId: string) => {
      const db = get().db;
      const p = db.pedidos.find((x) => x.id === pedidoId);
      if (!p) return [];
      return p.items.map((i) => {
        let enDesp = 0;
        for (const d of db.despachos)
          if (d.origenTipo === "PEDIDO" && d.origenId === p.id && !d.egresoGenerado && d.estado !== "CANCELADO")
            for (const x of d.items) if (x.itemOrigenId === i.id) enDesp += x.cantidad;
        return { item: i, pendiente: Math.max(0, i.cantidad - (i.cantidadDespachada ?? 0) - enDesp) };
      });
    },
  };
}

