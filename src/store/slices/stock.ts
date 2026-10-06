import type { AjusteStock, ItemAjuste, ItemTransferencia, TransferenciaStock } from "@/domain/types";
import { formatQty } from "@/lib/format";
import { newId } from "@/lib/utils";
import { ErrorNegocio, ejecutar, exigir } from "../helpers";
import { disponible, nombreProducto } from "../ops";
import type { GetFn, SetFn } from "../types";

/** Stock: transferencias entre depósitos y ajustes. Nunca se toca cantidadFisica directo. */
export function crearSliceStock(set: SetFn, get: GetFn) {
  return {
    crearTransferencia: (data: { depositoOrigenId: string; depositoDestinoId: string; items: ItemTransferencia[]; observacion?: string }) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "stock.transferir");
        if (data.depositoOrigenId === data.depositoDestinoId) throw new ErrorNegocio("El depósito de origen y destino deben ser distintos.");
        const items = data.items.filter((i) => i.cantidad > 0);
        if (!items.length) throw new ErrorNegocio("Agregá al menos un producto con cantidad.");
        for (const it of items) {
          const disp = disponible(tx, it.productoId, data.depositoOrigenId);
          if (it.cantidad > disp + 1e-9) {
            const u = tx.find("productos", it.productoId)?.unidad ?? "UN";
            throw new ErrorNegocio(`${nombreProducto(tx, it.productoId)}: el disponible en origen es ${formatQty(Math.max(0, disp), u)} (lo pendiente de entrega no se puede transferir).`);
          }
        }
        const t: TransferenciaStock = {
          id: newId("trf"),
          numero: tx.numero("TRF", null, "0001"),
          depositoOrigenId: data.depositoOrigenId,
          depositoDestinoId: data.depositoDestinoId,
          items,
          estado: "PENDIENTE",
          usuarioId: tx.usuarioId,
          fecha: tx.ahora,
          observacion: data.observacion,
          ...tx.meta(),
        };
        tx.insert("transferencias", t);
        tx.auditar("Creó transferencia", "TransferenciaStock", t.id, `${t.numero} · ${items.length} productos`);
        return t;
      }),

    despacharTransferencia: (id: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "stock.transferir");
        const t = tx.must("transferencias", id);
        if (t.estado !== "PENDIENTE") throw new ErrorNegocio("Sólo se pueden despachar transferencias pendientes.");
        for (const it of t.items) {
          const fis = tx.fisico(it.productoId, t.depositoOrigenId);
          if (fis + 1e-9 < it.cantidad) throw new ErrorNegocio(`Sin stock físico suficiente de ${nombreProducto(tx, it.productoId)} en origen.`);
        }
        for (const it of t.items)
          tx.movimiento({ productoId: it.productoId, depositoId: t.depositoOrigenId, tipo: "TRANSFERENCIA_SALIDA", cantidad: it.cantidad, signo: -1, referenciaTipo: "TRANSFERENCIA", referenciaId: t.id });
        tx.patch("transferencias", id, { estado: "EN_TRANSITO", fechaDespacho: tx.ahora });
        tx.auditar("Despachó transferencia", "TransferenciaStock", id, t.numero);
      }),

    recibirTransferencia: (id: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "stock.transferir");
        const t = tx.must("transferencias", id);
        if (t.estado !== "EN_TRANSITO") throw new ErrorNegocio("Sólo se pueden recibir transferencias en tránsito.");
        for (const it of t.items)
          tx.movimiento({ productoId: it.productoId, depositoId: t.depositoDestinoId, tipo: "TRANSFERENCIA_ENTRADA", cantidad: it.cantidad, signo: 1, referenciaTipo: "TRANSFERENCIA", referenciaId: t.id });
        tx.patch("transferencias", id, { estado: "RECIBIDA", fechaRecepcion: tx.ahora });
        tx.auditar("Recibió transferencia", "TransferenciaStock", id, t.numero);
      }),

    cancelarTransferencia: (id: string) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "stock.transferir");
        const t = tx.must("transferencias", id);
        if (t.estado !== "PENDIENTE") throw new ErrorNegocio("Sólo se pueden cancelar transferencias pendientes.");
        tx.patch("transferencias", id, { estado: "CANCELADA" });
        tx.auditar("Canceló transferencia", "TransferenciaStock", id, t.numero);
      }),

    crearAjuste: (data: { depositoId: string; items: ItemAjuste[]; observacion?: string }) =>
      ejecutar(get, set, (tx) => {
        exigir(tx, "stock.ajustar");
        const items = data.items.filter((i) => i.cantidad > 0);
        if (!items.length) throw new ErrorNegocio("Agregá al menos un producto con cantidad.");
        let valor = 0;
        for (const it of items) {
          const p = tx.must("productos", it.productoId);
          valor += it.cantidad * p.costoPromedio;
          if (it.signo === -1 && tx.fisico(it.productoId, data.depositoId) + 1e-9 < it.cantidad)
            throw new ErrorNegocio(`${nombreProducto(tx, it.productoId)}: no se puede descontar más que el stock físico.`);
        }
        if (valor > 500_000 && !data.observacion?.trim())
          throw new ErrorNegocio("El ajuste supera $ 500.000: la observación es obligatoria.", "OBSERVACION");
        const aj: AjusteStock = {
          id: newId("aju"),
          numero: tx.numero("AJU", null, "0001"),
          depositoId: data.depositoId,
          items,
          usuarioId: tx.usuarioId,
          fecha: tx.ahora,
          observacion: data.observacion,
          ...tx.meta(),
        };
        tx.insert("ajustes", aj);
        for (const it of items)
          tx.movimiento({
            productoId: it.productoId,
            depositoId: data.depositoId,
            tipo: it.signo === 1 ? "AJUSTE_POSITIVO" : "AJUSTE_NEGATIVO",
            cantidad: it.cantidad,
            signo: it.signo,
            referenciaTipo: "AJUSTE",
            referenciaId: aj.id,
            observacion: it.motivo,
          });
        tx.auditar("Registró ajuste de stock", "AjusteStock", aj.id, `${aj.numero} · ${items.length} productos`);
        return aj;
      }),
  };
}
