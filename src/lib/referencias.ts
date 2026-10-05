import type { EstadoInicial, MovimientoStock } from "@/domain/types";

/** Etiqueta y link de la referencia de un movimiento de stock. */
export function referenciaMovimiento(db: EstadoInicial, m: Pick<MovimientoStock, "referenciaTipo" | "referenciaId">): { label: string; href: string } {
  switch (m.referenciaTipo) {
    case "OC": {
      const oc = db.ordenesCompra.find((x) => x.id === m.referenciaId);
      return { label: oc?.numero ?? "OC", href: `/compras/oc/${m.referenciaId}` };
    }
    case "DESPACHO": {
      const d = db.despachos.find((x) => x.id === m.referenciaId);
      return { label: d?.numero ?? "Remito", href: `/despachos?despacho=${m.referenciaId}` };
    }
    case "TRANSFERENCIA": {
      const t = db.transferencias.find((x) => x.id === m.referenciaId);
      return { label: t?.numero ?? "Transferencia", href: `/stock?tab=transferencias&id=${m.referenciaId}` };
    }
    case "AJUSTE": {
      const a = db.ajustes.find((x) => x.id === m.referenciaId);
      return { label: a?.numero ?? "Ajuste", href: `/stock?tab=ajustes&id=${m.referenciaId}` };
    }
    case "PEDIDO": {
      const p = db.pedidos.find((x) => x.id === m.referenciaId);
      return { label: p?.numero ?? "Pedido", href: `/ventas/pedidos/${m.referenciaId}` };
    }
    case "ACOPIO": {
      const a = db.acopios.find((x) => x.id === m.referenciaId);
      return { label: a?.numero ?? "Acopio", href: `/acopios/${m.referenciaId}` };
    }
  }
}

/** Nombre de usuario por id. */
export function nombreUsuario(db: EstadoInicial, id: string): string {
  return db.usuarios.find((u) => u.id === id)?.nombre ?? (id === "sistema" ? "Sistema" : id);
}
