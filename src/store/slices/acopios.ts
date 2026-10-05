import type { Acopio, Comprobante, CondicionPago, Despacho, ItemAcopio, RetiroAcopio } from "@/domain/types";
import { calcularTotales } from "@/domain/ventas";
import { pendienteItem, proporcionPagada } from "@/domain/acopios";
import { puede } from "@/domain/permisos";
import { formatMoney, formatPercent, formatQty } from "@/lib/format";
import { newId } from "@/lib/utils";
import { ErrorNegocio, ejecutar, exigir, r2 } from "../helpers";
import { actualizarEstadoAcopio, confirmarEgresoDeDespacho, crearFacturaVenta, nombreProducto, puntoVentaDe, valorRetirado } from "../ops";
import type { GetFn, SetFn } from "../types";

export interface AcopioInput {
  clienteId: string;
  sucursalId: string;
  depositoId: string;
  vendedorId: string;
  fechaInicio: string;
  fechaVencimiento: string;
  condicionPago: CondicionPago;
  observaciones?: string;
  items: { productoId: string; cantidad: number; precio: number }[];
}

export interface RetiroInput {
  acopioId: string;
  fecha: string;
  items: { itemAcopioId: string; cantidad: number }[];
  modalidad: "ENVIO" | "RETIRA";
  direccionEntrega?: string;
  fechaProgramada?: string;
  observaciones?: string;
  autorizarSinPago?: boolean;
}

/** Acopios: contratos, retiros, ampliaciones, canjes y cancelaciones. */
export function crearSliceAcopios(set: SetFn, get: GetFn) {
  return {
    /** Crea el acopio VIGENTE, congela costos, compromete stock y emite la factura. */
    crearAcopio: (data: AcopioInput) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "acopios.editar");
        if (!data.clienteId) throw new ErrorNegocio("Elegí un cliente.");
        const lineas = data.items.filter((i) => i.productoId && i.cantidad > 0);
        if (!lineas.length) throw new ErrorNegocio("Agregá al menos un producto.");
        const items: ItemAcopio[] = lineas.map((l) => ({
          id: newId("ita"),
          productoId: l.productoId,
          cantidadAcopiada: l.cantidad,
          cantidadRetirada: 0,
          precioUnitarioPactado: l.precio,
          costoUnitarioSnapshot: tx.must("productos", l.productoId).costoPromedio,
        }));
        const t = calcularTotales(items.map((i) => ({ cantidad: i.cantidadAcopiada, precioUnitario: i.precioUnitarioPactado, descuentoPct: 0 })), 0, tx.config.ivaPct);
        const a: Acopio = {
          id: newId("aco"),
          numero: tx.numero("ACO"),
          clienteId: data.clienteId,
          sucursalId: data.sucursalId,
          depositoId: data.depositoId,
          vendedorId: data.vendedorId,
          estado: "VIGENTE",
          fechaInicio: data.fechaInicio,
          fechaVencimiento: data.fechaVencimiento,
          items,
          subtotal: t.subtotal,
          iva: t.iva,
          total: t.total,
          montoPagado: 0,
          condicionPago: data.condicionPago,
          observaciones: data.observaciones,
          ...tx.meta(),
        };
        tx.insert("acopios", a);
        const fc = crearFacturaVenta(tx, {
          clienteId: a.clienteId,
          sucursalId: a.sucursalId,
          fecha: data.fechaInicio,
          neto: t.neto,
          iva: t.iva,
          total: t.total,
          acopioId: a.id,
          condicionPago: data.condicionPago,
          observaciones: `Acopio ${a.numero}`,
        });
        tx.patch("acopios", a.id, { comprobanteId: fc.id, comprobanteIds: [fc.id] });
        tx.auditar("Creó acopio", "Acopio", a.id, `${a.numero} · ${formatMoney(a.total)} · factura ${fc.numero}`);
        return { acopioId: a.id, comprobanteId: fc.id, numero: a.numero };
      }),

    /**
     * Registra un retiro. Con envío crea un despacho PENDIENTE (el egreso se genera
     * al salir el camión); en mostrador egresa el stock en el momento.
     */
    registrarRetiroAcopio: (data: RetiroInput) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "acopios.editar");
        const a = tx.must("acopios", data.acopioId);
        if (a.estado === "CANCELADO" || a.estado === "COMPLETADO") throw new ErrorNegocio("El acopio no tiene saldo para retirar.");
        const lineas = data.items.filter((i) => i.cantidad > 0);
        if (!lineas.length) throw new ErrorNegocio("Indicá al menos una cantidad a retirar.");
        const dep = tx.find("depositos", a.depositoId)?.nombre ?? "el depósito";
        let valor = 0;
        for (const l of lineas) {
          const it = a.items.find((i) => i.id === l.itemAcopioId);
          if (!it) throw new ErrorNegocio("Ítem de acopio inexistente.");
          const prod = tx.must("productos", it.productoId);
          if (l.cantidad > pendienteItem(it) + 1e-9) throw new ErrorNegocio(`${nombreProducto(tx, it.productoId)}: no se puede retirar más que el pendiente (${formatQty(pendienteItem(it), prod.unidad)}).`);
          const fis = tx.fisico(it.productoId, a.depositoId);
          if (l.cantidad > fis + 1e-9)
            throw new ErrorNegocio(`Sin stock físico de ${prod.nombre} en ${dep}. Transferí o ingresá mercadería primero.`, "SIN_STOCK");
          valor += l.cantidad * it.precioUnitarioPactado;
        }
        // Regla: no retirar más proporción que la pagada.
        const pagadoNeto = proporcionPagada(a) * a.subtotal;
        if (valorRetirado(a) + valor > pagadoNeto + 1) {
          const u = tx.find("usuarios", tx.usuarioId);
          if (!puede(u, "acopios.autorizar"))
            throw new ErrorNegocio(`El retiro supera lo pagado (${formatPercent(proporcionPagada(a))}). Pedí autorización a Administración.`, "IMPAGO_BLOQUEADO");
          if (!data.autorizarSinPago) throw new ErrorNegocio("El retiro supera la proporción pagada del acopio.", "IMPAGO");
          tx.auditar("Autorizó retiro con saldo impago", "Acopio", a.id, `${a.numero} · retiro por ${formatMoney(valor)}`);
        }
        const cliente = tx.must("clientes", a.clienteId);
        const ret: RetiroAcopio = {
          id: newId("ret"),
          numero: tx.numero("RET"),
          acopioId: a.id,
          fecha: data.fecha,
          items: lineas.map((l) => ({ itemAcopioId: l.itemAcopioId, productoId: a.items.find((i) => i.id === l.itemAcopioId)!.productoId, cantidad: l.cantidad })),
          usuarioId: tx.usuarioId,
          observaciones: data.observaciones,
          ...tx.meta(),
        };
        const mostrador = data.modalidad === "RETIRA";
        const d: Despacho = {
          id: newId("des"),
          numero: tx.numero("REM"),
          sucursalId: a.sucursalId,
          depositoId: a.depositoId,
          clienteId: a.clienteId,
          origenTipo: "RETIRO_ACOPIO",
          origenId: ret.id,
          acopioId: a.id,
          estado: mostrador ? "RETIRADO_EN_MOSTRADOR" : "PENDIENTE",
          fechaProgramada: data.fechaProgramada ?? data.fecha,
          fechaEntrega: mostrador ? data.fecha : undefined,
          direccionEntrega: mostrador ? "Retira en mostrador" : data.direccionEntrega?.trim() || cliente.direccion,
          localidad: cliente.localidad,
          items: ret.items.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad, itemOrigenId: i.itemAcopioId, cantidadEntregada: mostrador ? i.cantidad : undefined })),
          firmaRecibido: mostrador ? cliente.razonSocial : undefined,
          observaciones: data.observaciones,
          egresoGenerado: false,
          ...tx.meta(),
        };
        ret.despachoId = d.id;
        tx.insert("retiros", ret);
        tx.insert("despachos", d);
        tx.patch("acopios", a.id, (x) => ({
          ...x,
          items: x.items.map((i) => {
            const l = lineas.find((y) => y.itemAcopioId === i.id);
            return l ? { ...i, cantidadRetirada: i.cantidadRetirada + l.cantidad } : i;
          }),
        }));
        if (mostrador) confirmarEgresoDeDespacho(tx, d.id, data.fecha);
        actualizarEstadoAcopio(tx, a.id);
        tx.auditar("Registró retiro de acopio", "Acopio", a.id, `${ret.numero} · ${mostrador ? "retira en mostrador" : `envío, remito ${d.numero}`}`);
        return { retiroId: ret.id, despachoId: d.id, numero: ret.numero, remito: d.numero };
      }),

    /** Agrega productos al acopio a precio actual y emite una factura adicional. */
    ampliarAcopio: (acopioId: string, lineas: { productoId: string; cantidad: number; precio: number }[]) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "acopios.editar");
        const a = tx.must("acopios", acopioId);
        if (a.estado === "CANCELADO") throw new ErrorNegocio("El acopio está cancelado.");
        const ls = lineas.filter((l) => l.productoId && l.cantidad > 0);
        if (!ls.length) throw new ErrorNegocio("Agregá al menos un producto.");
        const nuevos: ItemAcopio[] = ls.map((l) => ({
          id: newId("ita"),
          productoId: l.productoId,
          cantidadAcopiada: l.cantidad,
          cantidadRetirada: 0,
          precioUnitarioPactado: l.precio,
          costoUnitarioSnapshot: tx.must("productos", l.productoId).costoPromedio,
        }));
        const t = calcularTotales(nuevos.map((i) => ({ cantidad: i.cantidadAcopiada, precioUnitario: i.precioUnitarioPactado, descuentoPct: 0 })), 0, tx.config.ivaPct);
        const fc = crearFacturaVenta(tx, { clienteId: a.clienteId, sucursalId: a.sucursalId, neto: t.neto, iva: t.iva, total: t.total, acopioId: a.id, condicionPago: a.condicionPago ?? "ANTICIPO", observaciones: `Ampliación de acopio ${a.numero}` });
        tx.patch("acopios", a.id, (x) => ({
          ...x,
          items: [...x.items, ...nuevos],
          subtotal: r2(x.subtotal + t.subtotal),
          iva: r2(x.iva + t.iva),
          total: r2(x.total + t.total),
          comprobanteIds: [...(x.comprobanteIds ?? (x.comprobanteId ? [x.comprobanteId] : [])), fc.id],
        }));
        actualizarEstadoAcopio(tx, a.id);
        tx.auditar("Amplió acopio", "Acopio", a.id, `${a.numero} · +${formatMoney(t.total)} · factura ${fc.numero}`);
        return fc.id;
      }),

    /**
     * Canje: convierte el valor pendiente de un ítem en cantidad de otro producto
     * al precio de lista actual del cliente. El valor del acopio no cambia.
     */
    canjearProducto: (acopioId: string, data: { itemAcopioId: string; cantidadOrigen: number; productoDestinoId: string; precioDestino: number }) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "acopios.editar");
        const a = tx.must("acopios", acopioId);
        const it = a.items.find((i) => i.id === data.itemAcopioId);
        if (!it) throw new ErrorNegocio("Ítem inexistente.");
        if (data.cantidadOrigen <= 0 || data.cantidadOrigen > pendienteItem(it) + 1e-9) throw new ErrorNegocio("La cantidad a canjear debe ser mayor a 0 y no superar el pendiente.");
        if (data.precioDestino <= 0) throw new ErrorNegocio("El producto destino no tiene precio en la lista del cliente.");
        const valor = data.cantidadOrigen * it.precioUnitarioPactado;
        const destino = tx.must("productos", data.productoDestinoId);
        const discreta = !["M2", "M3", "KG", "LT", "ML"].includes(destino.unidad);
        const cantidad = discreta ? Math.floor(valor / data.precioDestino) : Math.round((valor / data.precioDestino) * 100) / 100;
        if (cantidad <= 0) throw new ErrorNegocio("El valor a canjear no alcanza para una unidad del producto destino.");
        const precioPactado = r2(valor / cantidad);
        tx.patch("acopios", a.id, (x) => ({
          ...x,
          items: [
            ...x.items.map((i) => (i.id === it.id ? { ...i, cantidadAcopiada: r2(i.cantidadAcopiada - data.cantidadOrigen) } : i)),
            { id: newId("ita"), productoId: destino.id, cantidadAcopiada: cantidad, cantidadRetirada: 0, precioUnitarioPactado: precioPactado, costoUnitarioSnapshot: destino.costoPromedio },
          ],
        }));
        actualizarEstadoAcopio(tx, a.id);
        const origen = tx.must("productos", it.productoId);
        tx.auditar("Canjeó producto en acopio", "Acopio", a.id, `${a.numero} · ${formatQty(data.cantidadOrigen, origen.unidad)} de ${origen.nombre} → ${formatQty(cantidad, destino.unidad)} de ${destino.nombre} (${formatMoney(valor)})`);
        return cantidad;
      }),

    extenderVencimiento: (acopioId: string, fecha: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "acopios.autorizar");
        const a = tx.must("acopios", acopioId);
        tx.patch("acopios", a.id, { fechaVencimiento: fecha });
        actualizarEstadoAcopio(tx, a.id);
        tx.auditar("Extendió vencimiento de acopio", "Acopio", a.id, `${a.numero} · nuevo vencimiento ${fecha.slice(0, 10)}`);
      }),

    /** Cancela el saldo no retirado; si estaba pagado genera nota de crédito a favor del cliente. */
    cancelarSaldoAcopio: (acopioId: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "acopios.autorizar");
        const a = tx.must("acopios", acopioId);
        if (a.estado === "CANCELADO" || a.estado === "COMPLETADO") throw new ErrorNegocio("El acopio no tiene saldo para cancelar.");
        const hayDespachosPend = tx.get("despachos").some((d) => d.acopioId === a.id && !d.egresoGenerado && d.estado !== "CANCELADO");
        if (hayDespachosPend) throw new ErrorNegocio("Hay retiros con envío pendientes: cancelalos o entregalos primero.");
        const pendienteNeto = a.items.reduce((s, i) => s + pendienteItem(i) * i.precioUnitarioPactado, 0);
        const pendienteConIva = r2(pendienteNeto * (1 + tx.config.ivaPct / 100));
        let ncId: string | undefined;
        if (pendienteConIva > 0) {
          const ids = a.comprobanteIds ?? (a.comprobanteId ? [a.comprobanteId] : []);
          const aplicado: { comprobanteId: string; importe: number }[] = [];
          let resto = pendienteConIva;
          for (const id of ids) {
            const c = tx.must("comprobantes", id);
            if (resto <= 0 || c.saldoPendiente <= 0) continue;
            const imp = Math.min(resto, c.saldoPendiente);
            aplicado.push({ comprobanteId: c.id, importe: r2(imp) });
            const saldo = r2(c.saldoPendiente - imp);
            tx.patch("comprobantes", c.id, { saldoPendiente: saldo, estado: saldo <= 0.009 ? "PAGADO" : "PARCIAL" });
            resto = r2(resto - imp);
          }
          const nc: Comprobante = {
            id: newId("cmp"),
            tipo: "NOTA_CREDITO",
            numero: tx.numeroFiscal(puntoVentaDe(tx, a.sucursalId), "NOTA_CREDITO"),
            clienteId: a.clienteId,
            acopioId: a.id,
            comprobanteOrigenId: a.comprobanteId,
            sucursalId: a.sucursalId,
            fecha: tx.ahora,
            subtotal: r2(pendienteNeto),
            iva: r2(pendienteConIva - pendienteNeto),
            total: pendienteConIva,
            saldoPendiente: -resto,
            estado: resto > 0 ? "PENDIENTE" : "PAGADO",
            aplicadoA: aplicado,
            observaciones: `Cancelación de saldo de acopio ${a.numero}${resto > 0 ? ` · saldo a favor ${formatMoney(resto)}` : ""}`,
            ...tx.meta(),
          };
          tx.insert("comprobantes", nc);
          ncId = nc.id;
        }
        tx.patch("acopios", a.id, { estado: "CANCELADO" });
        tx.auditar("Canceló saldo de acopio", "Acopio", a.id, `${a.numero} · ${formatMoney(pendienteConIva)} no retirado`);
        return ncId;
      }),
  };
}
