import type { Chofer, Despacho, HojaRuta, Vehiculo } from "@/domain/types";
import { newId } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { ErrorNegocio, ejecutar, exigir } from "../helpers";
import { actualizarEstadoAcopio, actualizarEstadoPedido, confirmarEgresoDeDespacho, pendienteDeProgramar } from "../ops";
import type { Tx } from "../tx";
import type { GetFn, SetFn } from "../types";

const mismaFecha = (a: string, b: string) => a.slice(0, 10) === b.slice(0, 10);

function quitarDeHojas(tx: Tx, despachoId: string) {
  for (const h of tx.get("hojasRuta"))
    if (h.despachoIds.includes(despachoId) && h.estado === "PLANIFICADA") tx.patch("hojasRuta", h.id, { despachoIds: h.despachoIds.filter((x) => x !== despachoId) });
}

function despacharEnTx(tx: Tx, id: string, vehiculoId?: string, choferId?: string) {
  const d = tx.must("despachos", id);
  if (d.estado !== "PENDIENTE" && d.estado !== "EN_PREPARACION") throw new ErrorNegocio(`El remito ${d.numero} no está listo para despachar.`);
  const veh = vehiculoId ?? d.vehiculoId;
  const cho = choferId ?? d.choferId;
  if (!veh || !cho) throw new ErrorNegocio(`Asigná vehículo y chofer al remito ${d.numero}.`);
  tx.patch("despachos", id, { vehiculoId: veh, choferId: cho });
  confirmarEgresoDeDespacho(tx, id);
  tx.patch("despachos", id, { estado: "EN_VIAJE" });
  tx.auditar("Despachó remito", "Despacho", id, `${d.numero} · en viaje`);
}

/** Despachos, hoja de ruta, vehículos y choferes. */
export function crearSliceDespachos(set: SetFn, get: GetFn) {
  return {
    /** Crea un despacho PENDIENTE para un pedido con lo que falta despachar. */
    generarDespachoPedido: (pedidoId: string, opts: { items?: { itemId: string; cantidad: number }[]; fechaProgramada?: string } = {}) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.editar");
        const p = tx.must("pedidos", pedidoId);
        if (["BORRADOR", "CANCELADO"].includes(p.estado)) throw new ErrorNegocio("El pedido tiene que estar confirmado.");
        const cliente = tx.must("clientes", p.clienteId);
        const items = p.items
          .map((it) => {
            const pend = pendienteDeProgramar(tx, p, it);
            const pedido = opts.items ? (opts.items.find((x) => x.itemId === it.id)?.cantidad ?? 0) : pend;
            if (pedido > pend + 1e-9) throw new ErrorNegocio("La cantidad supera lo pendiente de despachar.");
            return pedido > 0 ? { productoId: it.productoId, cantidad: pedido, itemOrigenId: it.id } : null;
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
        if (!items.length) throw new ErrorNegocio("No hay mercadería pendiente de despachar en este pedido.");
        const mostrador = p.modalidadEntrega === "RETIRA";
        const d: Despacho = {
          id: newId("des"),
          numero: tx.numero("REM"),
          sucursalId: p.sucursalId,
          depositoId: p.depositoId,
          clienteId: p.clienteId,
          origenTipo: "PEDIDO",
          origenId: p.id,
          estado: "PENDIENTE",
          fechaProgramada: opts.fechaProgramada ?? p.fechaEntregaComprometida ?? tx.ahora,
          direccionEntrega: mostrador ? "Retira en mostrador" : p.direccionEntrega ?? `${cliente.direccion}, ${cliente.localidad}`,
          localidad: cliente.localidad,
          items,
          egresoGenerado: false,
          ...tx.meta(),
        };
        tx.insert("despachos", d);
        if (p.estado === "CONFIRMADO") tx.patch("pedidos", p.id, { estado: "EN_PREPARACION" });
        tx.auditar("Generó despacho", "Pedido", p.id, `${p.numero} → remito ${d.numero}`);
        return { despachoId: d.id, numero: d.numero };
      }),

    /** Despacho manual desde un pedido o un acopio (toolbar "Nuevo despacho"). */
    prepararDespacho: (id: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "despachos.operar");
        const d = tx.must("despachos", id);
        if (d.estado !== "PENDIENTE") throw new ErrorNegocio("Sólo se preparan despachos pendientes.");
        tx.patch("despachos", id, { estado: "EN_PREPARACION" });
        tx.auditar("Preparó despacho", "Despacho", id, `${d.numero} · orden de preparación impresa`);
      }),

    asignarVehiculo: (id: string, vehiculoId: string, choferId: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "despachos.operar");
        const d = tx.must("despachos", id);
        tx.patch("despachos", id, { vehiculoId: vehiculoId || undefined, choferId: choferId || undefined });
        tx.auditar("Asignó vehículo", "Despacho", id, d.numero);
      }),

    /** EN_PREPARACION → EN_VIAJE: genera los egresos de stock. */
    despacharDespacho: (id: string, vehiculoId?: string, choferId?: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "despachos.operar");
        despacharEnTx(tx, id, vehiculoId, choferId);
      }),

    /** Entrega en mostrador (pedidos con modalidad RETIRA). */
    entregarEnMostrador: (id: string, recibio: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "despachos.operar");
        const d = tx.must("despachos", id);
        if (d.estado !== "PENDIENTE" && d.estado !== "EN_PREPARACION") throw new ErrorNegocio("El despacho no está pendiente.");
        confirmarEgresoDeDespacho(tx, id);
        tx.patch("despachos", id, (x) => ({ ...x, estado: "RETIRADO_EN_MOSTRADOR" as const, fechaEntrega: tx.ahora, firmaRecibido: recibio, items: x.items.map((i) => ({ ...i, cantidadEntregada: i.cantidad })) }));
        if (d.origenTipo === "PEDIDO") actualizarEstadoPedido(tx, d.origenId);
        if (d.acopioId) actualizarEstadoAcopio(tx, d.acopioId);
        tx.auditar("Entregó en mostrador", "Despacho", id, `${d.numero} · recibió ${recibio}`);
      }),

    /**
     * EN_VIAJE → ENTREGADO. Con cantidades menores (entrega parcial) reingresa
     * el resto al depósito y crea automáticamente un nuevo despacho PENDIENTE.
     */
    marcarEntregado: (id: string, data: { fecha: string; recibio: string; observaciones?: string; cantidades?: number[] }) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "despachos.operar");
        const d = tx.must("despachos", id);
        if (d.estado !== "EN_VIAJE") throw new ErrorNegocio("Sólo se pueden entregar despachos en viaje.");
        if (!data.recibio.trim()) throw new ErrorNegocio("Indicá quién recibió la mercadería.");
        const cant = d.items.map((it, i) => Math.min(it.cantidad, Math.max(0, data.cantidades?.[i] ?? it.cantidad)));
        const resto = d.items.map((it, i) => ({ ...it, cantidad: it.cantidad - cant[i] })).filter((x) => x.cantidad > 1e-9);
        tx.patch("despachos", id, (x) => ({
          ...x,
          estado: "ENTREGADO" as const,
          fechaEntrega: data.fecha,
          firmaRecibido: data.recibio,
          observaciones: data.observaciones || x.observaciones,
          items: x.items.map((it, i) => ({ ...it, cantidadEntregada: cant[i] })),
        }));
        let nuevoId: string | undefined;
        if (resto.length) {
          for (const it of resto)
            tx.movimiento({ productoId: it.productoId, depositoId: d.depositoId, tipo: "DEVOLUCION_CLIENTE", cantidad: it.cantidad, signo: 1, referenciaTipo: "DESPACHO", referenciaId: d.id, observacion: "Reingreso por entrega parcial" });
          if (d.origenTipo === "PEDIDO")
            tx.patch("pedidos", d.origenId, (p) => ({
              ...p,
              items: p.items.map((i) => {
                const r = resto.filter((x) => x.itemOrigenId === i.id).reduce((a, x) => a + x.cantidad, 0);
                return r ? { ...i, cantidadDespachada: (i.cantidadDespachada ?? 0) - r } : i;
              }),
            }));
          const nuevo: Despacho = {
            ...d,
            id: newId("des"),
            numero: tx.numero("REM"),
            estado: "PENDIENTE",
            items: resto.map((x) => ({ productoId: x.productoId, cantidad: x.cantidad, itemOrigenId: x.itemOrigenId })),
            fechaProgramada: new Date(new Date(data.fecha).getTime() + 86_400_000).toISOString(),
            fechaEntrega: undefined,
            fechaSalida: undefined,
            firmaRecibido: undefined,
            vehiculoId: undefined,
            choferId: undefined,
            egresoGenerado: false,
            reprogramaciones: 0,
            observaciones: `Saldo de entrega parcial del remito ${d.numero}`,
            ...tx.meta(),
          };
          tx.insert("despachos", nuevo);
          nuevoId = nuevo.id;
        }
        if (d.origenTipo === "PEDIDO") actualizarEstadoPedido(tx, d.origenId);
        if (d.acopioId) actualizarEstadoAcopio(tx, d.acopioId);
        tx.auditar(resto.length ? "Registró entrega parcial" : "Marcó despacho entregado", "Despacho", id, `${d.numero} · recibió ${data.recibio}`);
        return nuevoId;
      }),

    reprogramarDespacho: (id: string, fecha: string, motivo?: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "despachos.operar");
        const d = tx.must("despachos", id);
        if (d.estado !== "PENDIENTE" && d.estado !== "EN_PREPARACION") throw new ErrorNegocio("Sólo se reprograman despachos que todavía no salieron.");
        if (!mismaFecha(d.fechaProgramada, fecha)) quitarDeHojas(tx, id);
        tx.patch("despachos", id, { fechaProgramada: fecha, reprogramaciones: (d.reprogramaciones ?? 0) + 1, observaciones: motivo || d.observaciones });
        tx.auditar("Reprogramó despacho", "Despacho", id, `${d.numero} · ${formatDate(fecha)}${motivo ? ` · ${motivo}` : ""}`);
      }),

    /** Cancela un despacho que no salió: los ítems vuelven al pedido o al acopio. */
    cancelarDespacho: (id: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "despachos.operar");
        const d = tx.must("despachos", id);
        if (d.egresoGenerado || !["PENDIENTE", "EN_PREPARACION"].includes(d.estado)) throw new ErrorNegocio("Sólo se cancelan despachos que todavía no salieron del depósito.");
        tx.patch("despachos", id, { estado: "CANCELADO" });
        quitarDeHojas(tx, id);
        if (d.origenTipo === "RETIRO_ACOPIO" && d.acopioId) {
          tx.patch("acopios", d.acopioId, (a) => ({
            ...a,
            items: a.items.map((i) => {
              const q = d.items.filter((x) => x.itemOrigenId === i.id).reduce((s, x) => s + x.cantidad, 0);
              return q ? { ...i, cantidadRetirada: i.cantidadRetirada - q } : i;
            }),
          }));
          actualizarEstadoAcopio(tx, d.acopioId);
        } else actualizarEstadoPedido(tx, d.origenId);
        tx.auditar("Canceló despacho", "Despacho", id, `${d.numero} · ítems devueltos al ${d.origenTipo === "PEDIDO" ? "pedido" : "acopio"}`);
      }),

    // ───────────── Hoja de ruta ─────────────
    asignarAHojaRuta: (despachoId: string, vehiculoId: string, fecha: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "despachos.operar");
        const d = tx.must("despachos", despachoId);
        if (!["PENDIENTE", "EN_PREPARACION"].includes(d.estado)) throw new ErrorNegocio("El despacho ya salió o fue cerrado.");
        const v = tx.must("vehiculos", vehiculoId);
        quitarDeHojas(tx, despachoId);
        let hoja = tx.get("hojasRuta").find((h) => h.vehiculoId === vehiculoId && mismaFecha(h.fecha, fecha) && h.estado !== "CERRADA");
        if (hoja?.estado === "EN_CURSO") throw new ErrorNegocio("La hoja de ese vehículo ya está en curso.");
        if (!hoja) {
          const nueva: HojaRuta = { id: newId("hr"), fecha, vehiculoId, choferId: v.choferId ?? "", despachoIds: [], estado: "PLANIFICADA", ...tx.meta() };
          tx.insert("hojasRuta", nueva);
          hoja = nueva;
        }
        tx.patch("hojasRuta", hoja.id, (h) => ({ ...h, despachoIds: [...h.despachoIds, despachoId] }));
        tx.patch("despachos", despachoId, { vehiculoId, choferId: hoja.choferId || v.choferId });
      }),

    quitarDeHojaRuta: (despachoId: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "despachos.operar");
        quitarDeHojas(tx, despachoId);
        tx.patch("despachos", despachoId, { vehiculoId: undefined, choferId: undefined });
      }),

    moverEnHojaRuta: (hojaId: string, despachoId: string, dir: -1 | 1) =>
      ejecutar(get, set, (tx) => {
        const h = tx.must("hojasRuta", hojaId);
        const i = h.despachoIds.indexOf(despachoId);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= h.despachoIds.length) return;
        const ids = [...h.despachoIds];
        [ids[i], ids[j]] = [ids[j], ids[i]];
        tx.patch("hojasRuta", hojaId, { despachoIds: ids });
      }),

    cambiarChoferHoja: (hojaId: string, choferId: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "despachos.operar");
        const h = tx.must("hojasRuta", hojaId);
        tx.patch("hojasRuta", hojaId, { choferId });
        for (const id of h.despachoIds) tx.patch("despachos", id, { choferId });
      }),

    /** Pone todos los despachos de la hoja EN_VIAJE (dispara egresos) y la hoja EN_CURSO. */
    iniciarRecorrido: (hojaId: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "despachos.operar");
        const h = tx.must("hojasRuta", hojaId);
        if (h.estado !== "PLANIFICADA") throw new ErrorNegocio("La hoja ya fue iniciada.");
        if (!h.despachoIds.length) throw new ErrorNegocio("La hoja no tiene paradas.");
        if (!h.choferId) throw new ErrorNegocio("Asigná un chofer a la hoja de ruta.");
        for (const id of h.despachoIds) {
          const d = tx.must("despachos", id);
          if (d.estado === "PENDIENTE" || d.estado === "EN_PREPARACION") despacharEnTx(tx, id, h.vehiculoId, h.choferId);
        }
        tx.patch("hojasRuta", hojaId, { estado: "EN_CURSO" });
        tx.auditar("Inició recorrido", "HojaRuta", hojaId, `${h.despachoIds.length} paradas`);
      }),

    cerrarHojaRuta: (hojaId: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "despachos.operar");
        const h = tx.must("hojasRuta", hojaId);
        const abiertos = h.despachoIds.map((id) => tx.must("despachos", id)).filter((d) => d.estado === "EN_VIAJE");
        if (abiertos.length) throw new ErrorNegocio(`Quedan ${abiertos.length} remitos en viaje: marcalos entregados o reprogramalos.`);
        tx.patch("hojasRuta", hojaId, { estado: "CERRADA" });
        tx.auditar("Cerró hoja de ruta", "HojaRuta", hojaId, `${h.despachoIds.length} paradas`);
      }),

    // ───────────── Vehículos y choferes ─────────────
    guardarVehiculo: (data: Omit<Vehiculo, "id" | "creadoEn" | "actualizadoEn">, id?: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "vehiculos.editar");
        if (!data.patente.trim()) throw new ErrorNegocio("La patente es obligatoria.");
        if (id) {
          tx.patch("vehiculos", id, data);
          return id;
        }
        const v: Vehiculo = { ...data, id: newId("veh"), ...tx.meta() };
        tx.insert("vehiculos", v);
        tx.auditar("Creó vehículo", "Vehiculo", v.id, data.patente);
        return v.id;
      }),

    guardarChofer: (data: Omit<Chofer, "id" | "creadoEn" | "actualizadoEn">, id?: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "vehiculos.editar");
        if (!data.nombre.trim()) throw new ErrorNegocio("El nombre es obligatorio.");
        if (id) {
          tx.patch("choferes", id, data);
          return id;
        }
        const c: Chofer = { ...data, id: newId("cho"), ...tx.meta() };
        tx.insert("choferes", c);
        tx.auditar("Creó chofer", "Chofer", c.id, data.nombre);
        return c.id;
      }),

    /** Usado por el módulo de acopios para retiros con envío. */
    confirmarEgresoDeDespacho: (despachoId: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "despachos.operar");
        confirmarEgresoDeDespacho(tx, despachoId);
      }),
  };
}
