import type { Chofer, Despacho, HojaRuta, ModalidadEntrega, Vehiculo } from "@/domain/types";
import { newId } from "@/lib/utils";
import { ErrorNegocio, ejecutar, exigir } from "../helpers";
import { crearRemitoNP, marcarHecho, pasarAPicking, pendienteSinRemito, puntoVentaDe } from "../ops";
import type { Tx } from "../tx";
import type { GetFn, SetFn } from "../types";

const mismaFecha = (a: string, b: string) => a.slice(0, 10) === b.slice(0, 10);

function quitarDeHojas(tx: Tx, despachoId: string) {
  for (const h of tx.get("hojasRuta"))
    if (h.despachoIds.includes(despachoId)) {
      if (h.estado === "EN_CURSO") throw new ErrorNegocio("La hoja de ruta ya está en curso.");
      tx.patch("hojasRuta", h.id, { despachoIds: h.despachoIds.filter((x) => x !== despachoId) });
    }
}

export interface DespachoInput {
  notaPedidoId: string;
  lineas?: { itemId: string; cantidad: number }[];
  modalidad?: ModalidadEntrega;
  fechaProgramada?: string;
  posicion?: string;
  direccionEntrega?: string;
  observaciones?: string;
}

/** Crea un despacho en ESPERA para una NP (programar entrega). */
export function crearDespachoTx(tx: Tx, data: DespachoInput): Despacho {
  const np = tx.must("notasPedido", data.notaPedidoId);
  if (np.estado === "BORRADOR" || np.estado === "ANULADA") throw new ErrorNegocio("La nota de pedido no está confirmada.");
  const enDespachos = (itemId: string) =>
    tx
      .get("despachos")
      .filter((d) => d.notaPedidoId === np.id && (d.estado === "ESPERA" || d.estado === "PREPARACION") && !d.remitoId)
      .flatMap((d) => d.items)
      .filter((i) => i.itemNPId === itemId)
      .reduce((a, i) => a + i.cantidad, 0);
  const lineas = (data.lineas ?? np.items.map((i) => ({ itemId: i.id, cantidad: pendienteSinRemito(tx, np, i.id) - enDespachos(i.id) }))).filter((l) => l.cantidad > 0);
  if (!lineas.length) throw new ErrorNegocio("No hay cantidades pendientes para programar.");
  const c = tx.must("clientes", np.clienteId);
  const modalidad = data.modalidad ?? np.modalidadEntrega;
  const obraId = np.items.find((i) => i.id === lineas[0].itemId)?.obraId;
  const obra = obraId ? tx.find("obras", obraId) : undefined;
  const dep = tx.find("depositos", np.depositoId);
  const d: Despacho = {
    id: newId("des"),
    numero: tx.numero("DES", null, puntoVentaDe(tx, np.sucursalId)),
    sucursalId: np.sucursalId,
    depositoId: np.depositoId,
    clienteId: c.id,
    notaPedidoId: np.id,
    modalidad,
    estado: "ESPERA",
    posicion: data.posicion ?? (modalidad === "RETIRA" ? (dep?.posiciones.find((p) => /mostrador/i.test(p)) ?? dep?.posiciones[0] ?? "") : (dep?.posiciones[0] ?? "")),
    fechaProgramada: data.fechaProgramada ?? tx.ahora,
    fechaEspera: tx.ahora,
    direccionEntrega: data.direccionEntrega ?? np.direccionEntrega ?? (obra ? [obra.direccion, obra.localidad].filter(Boolean).join(", ") : modalidad === "RETIRA" ? "Retira en mostrador" : c.direccion),
    obraId,
    items: lineas.map((l) => ({ productoId: np.items.find((i) => i.id === l.itemId)!.productoId, cantidad: l.cantidad, itemNPId: l.itemId })),
    observaciones: data.observaciones,
    ...tx.meta(),
  };
  tx.insert("despachos", d);
  tx.patch("notasPedido", np.id, { fechaEntregaProgramada: d.fechaProgramada, modalidadEntrega: modalidad });
  tx.auditar("Programó entrega", "Despacho", d.id, `${d.numero} · ${np.numero} · ${c.razonSocial}`);
  return d;
}

/** Despachos: espera → preparación → finalizado (con tiempos), hoja de ruta, vehículos y choferes. */
export function crearSliceDespachos(set: SetFn, get: GetFn) {
  const finalizar = (tx: Tx, id: string) => {
    const d = tx.must("despachos", id);
    if (d.estado !== "PREPARACION") throw new ErrorNegocio("Solo se puede finalizar un despacho en preparación.");
    if (!d.remitoId) throw new ErrorNegocio("El despacho no tiene remito.");
    marcarHecho(tx, d.remitoId);
    tx.patch("despachos", id, { estado: "FINALIZADO", fechaFin: tx.ahora, fechaEntrega: d.modalidad === "RETIRA" ? tx.ahora : undefined });
    tx.auditar("Finalizó despacho", "Despacho", id, d.numero);
    return tx.must("despachos", id);
  };

  return {
    crearDespacho: (data: DespachoInput) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.editar");
        const d = crearDespachoTx(tx, data);
        return { id: d.id, numero: d.numero };
      }),

    /** Programa varias líneas pendientes (mismo cliente y depósito) en un despacho por NP. */
    programarEntregas: (lineas: { notaPedidoId: string; itemId: string; cantidad: number }[], opts: { fechaProgramada?: string; modalidad?: ModalidadEntrega } = {}) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.editar");
        if (!lineas.length) throw new ErrorNegocio("Seleccioná al menos una línea.");
        const nps = [...new Set(lineas.map((l) => l.notaPedidoId))].map((id) => tx.must("notasPedido", id));
        if (new Set(nps.map((n) => n.clienteId)).size > 1 || new Set(nps.map((n) => n.depositoId)).size > 1)
          throw new ErrorNegocio("Las líneas tienen que ser del mismo cliente y del mismo depósito.");
        return nps.map((np) => crearDespachoTx(tx, { notaPedidoId: np.id, lineas: lineas.filter((l) => l.notaPedidoId === np.id), ...opts }).numero);
      }),

    /** ESPERA → PREPARACION: asigna posición y crea (o pasa) el remito a PICKING. */
    iniciarPreparacion: (id: string, posicion?: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "despachos.operar");
        const d = tx.must("despachos", id);
        if (d.estado !== "ESPERA") throw new ErrorNegocio("El despacho no está en espera.");
        let remitoId = d.remitoId;
        if (remitoId) {
          const r = tx.must("remitos", remitoId);
          if (r.estado === "INICIAL") pasarAPicking(tx, r.id);
        } else if (d.notaPedidoId) {
          const r = crearRemitoNP(tx, d.notaPedidoId, d.items.filter((i) => i.itemNPId).map((i) => ({ itemId: i.itemNPId!, cantidad: i.cantidad })), "PICKING");
          tx.patch("remitos", r.id, { despachoId: d.id });
          remitoId = r.id;
        }
        tx.patch("despachos", id, { estado: "PREPARACION", fechaInicioPreparacion: tx.ahora, posicion: posicion ?? d.posicion, remitoId, operarioId: tx.usuarioId });
        tx.auditar("Inició preparación", "Despacho", id, `${d.numero} · ${posicion ?? d.posicion}`);
        return remitoId;
      }),

    /** PREPARACION → FINALIZADO: remito HECHO (egreso de stock). Devuelve el remito para subir el firmado. */
    finalizarDespacho: (id: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "despachos.operar");
        return finalizar(tx, id).remitoId;
      }),

    asignarPosicion: (id: string, posicion: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "despachos.operar");
        tx.patch("despachos", id, { posicion });
      }),

    reprogramarDespacho: (id: string, fecha: string, motivo?: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "ventas.editar");
        const d = tx.must("despachos", id);
        if (d.estado !== "ESPERA") throw new ErrorNegocio("Solo se pueden reprogramar despachos en espera.");
        tx.patch("despachos", id, { fechaProgramada: fecha, reprogramaciones: (d.reprogramaciones ?? 0) + 1, observaciones: [d.observaciones, motivo].filter(Boolean).join(" · ") || undefined });
        tx.auditar("Reprogramó despacho", "Despacho", id, `${d.numero} → ${fecha.slice(0, 10)}`);
      }),

    cancelarDespacho: (id: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "despachos.operar");
        const d = tx.must("despachos", id);
        if (d.estado !== "ESPERA" && d.estado !== "PREPARACION") throw new ErrorNegocio("Solo se pueden cancelar despachos que no salieron.");
        if (d.remitoId) {
          const r = tx.must("remitos", d.remitoId);
          if (r.estado !== "HECHO") tx.patch("remitos", r.id, { estado: "ANULADO" });
        }
        quitarDeHojas(tx, id);
        tx.patch("despachos", id, { estado: "CANCELADO" });
        tx.auditar("Canceló despacho", "Despacho", id, d.numero);
      }),

    /** Envío entregado en obra (desde la hoja de ruta). */
    marcarEntregado: (id: string, observaciones?: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "despachos.operar");
        const d = tx.must("despachos", id);
        if (d.estado !== "EN_VIAJE" && d.estado !== "FINALIZADO") throw new ErrorNegocio("El despacho no está en viaje.");
        tx.patch("despachos", id, { estado: "ENTREGADO", fechaEntrega: tx.ahora, observaciones: [d.observaciones, observaciones].filter(Boolean).join(" · ") || undefined });
        tx.auditar("Entregó despacho", "Despacho", id, d.numero);
        return d.remitoId;
      }),

    // ───────────── Hoja de ruta ─────────────
    asignarAHojaRuta: (despachoId: string, vehiculoId: string, fecha: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "despachos.operar");
        const d = tx.must("despachos", despachoId);
        if (d.modalidad !== "ENVIO") throw new ErrorNegocio("Solo los envíos van en la hoja de ruta.");
        if (!["ESPERA", "PREPARACION", "FINALIZADO"].includes(d.estado)) throw new ErrorNegocio("El despacho ya salió o fue cerrado.");
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

    /** Inicia el recorrido: los despachos finalizados (cargados) pasan a EN_VIAJE. */
    iniciarRecorrido: (hojaId: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "despachos.operar");
        const h = tx.must("hojasRuta", hojaId);
        if (h.estado !== "PLANIFICADA") throw new ErrorNegocio("La hoja ya fue iniciada.");
        if (!h.despachoIds.length) throw new ErrorNegocio("La hoja no tiene paradas.");
        if (!h.choferId) throw new ErrorNegocio("Asigná un chofer a la hoja de ruta.");
        const sinCargar = h.despachoIds.map((id) => tx.must("despachos", id)).filter((d) => d.estado !== "FINALIZADO");
        if (sinCargar.length) throw new ErrorNegocio(`Hay ${sinCargar.length} despachos sin finalizar en el depósito: terminá la preparación primero.`);
        for (const id of h.despachoIds) tx.patch("despachos", id, { estado: "EN_VIAJE", vehiculoId: h.vehiculoId, choferId: h.choferId });
        tx.patch("hojasRuta", hojaId, { estado: "EN_CURSO" });
        tx.auditar("Inició recorrido", "HojaRuta", hojaId, `${h.despachoIds.length} paradas`);
      }),

    cerrarHojaRuta: (hojaId: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "despachos.operar");
        const h = tx.must("hojasRuta", hojaId);
        const abiertos = h.despachoIds.map((id) => tx.must("despachos", id)).filter((d) => d.estado === "EN_VIAJE");
        if (abiertos.length) throw new ErrorNegocio(`Quedan ${abiertos.length} envíos en viaje: marcalos entregados.`);
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
  };
}
