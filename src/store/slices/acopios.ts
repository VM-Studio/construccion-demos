import { addDays, parseISO } from "date-fns";
import type { Acopio, AjusteAcopio, Circuito, Comprobante, FormaPagoAcopio, MedioCobro } from "@/domain/types";
import { numeroCorto } from "@/domain/numeracion";
import { pagadoAcopio } from "@/domain/acopios";
import { formatMoney } from "@/lib/format";
import { newId, round2 } from "@/lib/utils";
import { ErrorNegocio, ejecutar, exigir } from "../helpers";
import { actualizarEstadoAcopio, crearFacturaVenta, puntoVentaDe, saldoAcopio } from "../ops";
import { registrarCobro } from "./finanzas";
import type { GetFn, SetFn } from "../types";

export interface AcopioInput {
  clienteId: string;
  sucursalId: string;
  depositoId: string;
  vendedorId?: string;
  fechaCreacion: string;
  fechaVencimiento: string;
  circuito: Circuito;
  obraIds: string[];
  importe: number;
  alicuotaIIBBPct: number;
  formaPago: FormaPagoAcopio;
  listaPreciosBaseId: string;
  unidadNegocioId: string;
  /** Precios ajustados manualmente antes de congelar (productoId → precio). */
  ajustesPrecio?: Record<string, number>;
  observaciones?: string;
  /** Si es anticipo: medios con los que paga ahora. */
  medios?: MedioCobro[];
}

/** Acopios de clientes por monto: alta con precios congelados, traspasos, ajustes, vencimiento y cancelación. */
export function crearSliceAcopios(set: SetFn, get: GetFn) {
  return {
    crearAcopio: (data: AcopioInput) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "acopios.editar");
        if (!data.clienteId) throw new ErrorNegocio("Elegí un cliente.");
        if (!(data.importe > 0)) throw new ErrorNegocio("Ingresá el importe del acopio.");
        if (parseISO(data.fechaVencimiento) <= parseISO(data.fechaCreacion)) throw new ErrorNegocio("El vencimiento tiene que ser posterior a la fecha de creación.");
        const c = tx.must("clientes", data.clienteId);
        const precios = new Map(tx.get("precios").filter((p) => p.listaPreciosId === data.listaPreciosBaseId).map((p) => [p.productoId, p.precio]));
        const productos = tx.get("productos").filter((p) => p.activo && p.unidadNegocioId === data.unidadNegocioId);
        const preciosCongelados = productos.map((p) => ({
          productoId: p.id,
          precio: data.ajustesPrecio?.[p.id] ?? precios.get(p.id) ?? 0,
          costoSnapshot: p.costoPromedio,
        }));
        if (!data.obraIds.length) throw new ErrorNegocio("Asociá el acopio a al menos una obra del cliente.");
        if (!preciosCongelados.some((p) => p.precio > 0)) throw new ErrorNegocio("La lista elegida no tiene precios para esta unidad de negocio: no hay nada que congelar.", "SIN_PRECIOS");
        const ajustados = Object.keys(data.ajustesPrecio ?? {}).filter((k) => data.ajustesPrecio![k] !== precios.get(k));
        const importeConIIBB = round2(data.importe * (1 + (data.alicuotaIIBBPct || 0) / 100));
        const a: Acopio = {
          id: newId("aco"),
          numero: tx.numero("AC", data.circuito, puntoVentaDe(tx, data.sucursalId)),
          circuito: data.circuito,
          clienteId: c.id,
          sucursalId: data.sucursalId,
          depositoId: data.depositoId,
          vendedorId: data.vendedorId ?? c.vendedorId ?? tx.usuarioId,
          obraIds: data.obraIds,
          fechaCreacion: data.fechaCreacion,
          fechaVencimiento: data.fechaVencimiento,
          importe: round2(data.importe),
          alicuotaIIBBPct: data.alicuotaIIBBPct || 0,
          importeConIIBB,
          formaPago: data.formaPago,
          listaPreciosBaseId: data.listaPreciosBaseId,
          unidadNegocioId: data.unidadNegocioId,
          preciosCongelados,
          comprobanteIds: [],
          reciboIds: [],
          estado: "VIGENTE",
          observaciones: data.observaciones,
          ...tx.meta(),
        };
        tx.insert("acopios", a);
        const fac = crearFacturaVenta(tx, {
          clienteId: c.id,
          sucursalId: data.sucursalId,
          circuito: data.circuito,
          fecha: data.fechaCreacion,
          total: importeConIIBB,
          acopioId: a.id,
          vencimientoDias: data.formaPago === "ANTICIPO" ? 0 : 30,
          observaciones: `Acopio ${a.numero}`,
        });
        a.comprobanteIds.push(fac.id);
        if (data.formaPago === "ANTICIPO" && data.medios?.length) {
          const cob = registrarCobro(tx, { clienteId: c.id, circuito: data.circuito, sucursalId: data.sucursalId, fecha: data.fechaCreacion, medios: data.medios, imputaciones: [{ comprobanteId: fac.id, importe: fac.total }] });
          a.reciboIds.push(cob.id);
        }
        tx.patch("acopios", a.id, { comprobanteIds: a.comprobanteIds, reciboIds: a.reciboIds });
        tx.auditar("Creó acopio", "Acopio", a.id, `${a.numero} · ${c.razonSocial} · ${formatMoney(a.importe)} · ${preciosCongelados.length} precios congelados`);
        if (ajustados.length) tx.auditar("Ajustó precios antes de congelar", "Acopio", a.id, `${ajustados.length} productos con precio manual`);
        return { id: a.id, numero: a.numero, comprobanteId: fac.id };
      }),

    /** Traspasa saldo de un acopio a otro del mismo cliente: ACD de salida y de entrada. */
    traspasarSaldo: (origenId: string, destinoId: string, monto: number, descripcion?: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "acopios.traspasar");
        const o = tx.must("acopios", origenId);
        const d = tx.must("acopios", destinoId);
        if (o.id === d.id) throw new ErrorNegocio("Elegí otro acopio de destino.");
        if (o.clienteId !== d.clienteId) throw new ErrorNegocio("Solo se puede traspasar entre acopios del mismo cliente.");
        if (d.estado === "CANCELADO") throw new ErrorNegocio("El acopio de destino está cancelado.");
        const saldo = saldoAcopio(tx, o.id);
        if (!(monto > 0)) throw new ErrorNegocio("Ingresá un monto mayor a cero.");
        if (monto > saldo + 0.005) throw new ErrorNegocio(`El monto supera el saldo disponible (${formatMoney(saldo)}).`);
        const desc = descripcion?.trim() || `${numeroCorto(d.numero).replace(" ", " ")}. Se traspasa el saldo del ${numeroCorto(o.numero)}, a pedido del cliente.`;
        const pv = puntoVentaDe(tx, d.sucursalId);
        const salida: AjusteAcopio = {
          id: newId("acd"),
          numero: tx.numero("ACD", o.circuito, puntoVentaDe(tx, o.sucursalId)),
          circuito: o.circuito,
          acopioId: o.id,
          fecha: tx.ahora,
          tipo: "TRASPASO_SALIDA",
          acopioRelacionadoId: d.id,
          monto: -round2(monto),
          descripcion: `${numeroCorto(o.numero)}. Se traspasa el saldo al ${numeroCorto(d.numero)}, a pedido del cliente.`,
          usuarioId: tx.usuarioId,
          ...tx.meta(),
        };
        const entrada: AjusteAcopio = {
          ...salida,
          id: newId("acd"),
          numero: tx.numero("ACD", d.circuito, pv),
          circuito: d.circuito,
          acopioId: d.id,
          tipo: "TRASPASO_ENTRADA",
          acopioRelacionadoId: o.id,
          monto: round2(monto),
          descripcion: desc,
        };
        tx.insert("ajustesAcopio", salida);
        tx.insert("ajustesAcopio", entrada);
        actualizarEstadoAcopio(tx, o.id);
        actualizarEstadoAcopio(tx, d.id);
        tx.auditar("Traspasó saldo de acopio", "Acopio", d.id, `${o.numero} → ${d.numero} · ${formatMoney(monto)}`);
        return { salida: salida.numero, entrada: entrada.numero };
      }),

    /** Ajuste manual de saldo (DUENO/ADMIN) con motivo: genera un ACD. */
    ajustarSaldoAcopio: (id: string, monto: number, motivo: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "acopios.autorizar");
        const a = tx.must("acopios", id);
        if (!monto) throw new ErrorNegocio("Ingresá un monto distinto de cero.");
        if (!motivo.trim()) throw new ErrorNegocio("El motivo es obligatorio.");
        const aj: AjusteAcopio = {
          id: newId("acd"),
          numero: tx.numero("ACD", a.circuito, puntoVentaDe(tx, a.sucursalId)),
          circuito: a.circuito,
          acopioId: a.id,
          fecha: tx.ahora,
          tipo: "AJUSTE",
          monto: round2(monto),
          descripcion: `${numeroCorto(a.numero)}. ${motivo.trim()}`,
          usuarioId: tx.usuarioId,
          ...tx.meta(),
        };
        tx.insert("ajustesAcopio", aj);
        actualizarEstadoAcopio(tx, a.id);
        tx.auditar("Ajustó saldo de acopio", "Acopio", a.id, `${aj.numero} · ${formatMoney(monto)} · ${motivo}`);
        return aj.numero;
      }),

    extenderVencimientoAcopio: (id: string, nuevaFecha: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "acopios.autorizar");
        const a = tx.must("acopios", id);
        if (parseISO(nuevaFecha) <= parseISO(a.fechaVencimiento)) throw new ErrorNegocio("La nueva fecha tiene que ser posterior al vencimiento actual.");
        tx.patch("acopios", id, { fechaVencimiento: nuevaFecha });
        actualizarEstadoAcopio(tx, id);
        tx.auditar("Extendió vencimiento de acopio", "Acopio", id, `${a.numero} → ${nuevaFecha.slice(0, 10)}`);
      }),

    /** Cancela el acopio; si estaba facturado y pagado, el saldo vuelve al cliente con una NC. */
    cancelarAcopio: (id: string, motivo: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "acopios.autorizar");
        const a = tx.must("acopios", id);
        if (a.estado === "CANCELADO") throw new ErrorNegocio("El acopio ya está cancelado.");
        if (!motivo.trim()) throw new ErrorNegocio("El motivo es obligatorio.");
        const saldo = Math.max(0, saldoAcopio(tx, id));
        const pagado = pagadoAcopio(a, tx.get("comprobantes"));
        let ncNumero: string | undefined;
        if (saldo > 0.009) {
          const factura = tx.get("comprobantes").find((c) => a.comprobanteIds.includes(c.id) && c.tipo === "FACTURA");
          const devolver = round2(Math.min(saldo, pagado || saldo));
          const nc: Comprobante = {
            id: newId("cmp"),
            tipo: "NOTA_CREDITO",
            letra: factura?.letra,
            circuito: a.circuito,
            numero: tx.numero("NC", a.circuito, puntoVentaDe(tx, a.sucursalId)),
            clienteId: a.clienteId,
            acopioId: a.id,
            comprobanteOrigenId: factura?.id,
            sucursalId: a.sucursalId,
            fecha: tx.ahora,
            subtotal: a.circuito === 1 ? round2(devolver / 1.21) : devolver,
            iva: a.circuito === 1 ? round2(devolver - devolver / 1.21) : 0,
            total: devolver,
            saldoPendiente: 0,
            estado: "PAGADO",
            observaciones: `Cancelación de acopio ${a.numero}: ${motivo}`,
            ...tx.meta(),
          };
          // Si la factura tiene saldo impago se aplica ahí; lo pagado queda a favor del cliente.
          const impago = factura?.saldoPendiente ?? 0;
          const aplicar = Math.min(impago, devolver);
          if (factura && aplicar > 0) {
            nc.aplicadoA = [{ comprobanteId: factura.id, importe: aplicar }];
            tx.patch("comprobantes", factura.id, { saldoPendiente: round2(impago - aplicar), estado: impago - aplicar < 0.01 ? "PAGADO" : "PARCIAL" });
          }
          nc.saldoPendiente = -round2(devolver - aplicar);
          nc.estado = devolver - aplicar < 0.01 ? "PAGADO" : "PENDIENTE";
          tx.insert("comprobantes", nc);
          ncNumero = nc.numero;
        }
        tx.patch("acopios", id, { estado: "CANCELADO", observaciones: [a.observaciones, `Cancelado: ${motivo}`].filter(Boolean).join(" · ") });
        tx.auditar("Canceló acopio", "Acopio", id, `${a.numero} · saldo devuelto ${formatMoney(saldo)}${ncNumero ? ` · ${ncNumero}` : ""}`);
        return ncNumero;
      }),

    /** Recalcula estados derivados de todos los acopios (vencidos / agotados). */
    refrescarEstadosAcopios: () =>
      ejecutar(get, set, (tx) => {
        for (const a of tx.get("acopios")) if (a.estado !== "CANCELADO") actualizarEstadoAcopio(tx, a.id);
      }),
  };
}

export const vencimientoPorDefecto = (fecha: string, dias: number) => addDays(parseISO(fecha), dias).toISOString();
