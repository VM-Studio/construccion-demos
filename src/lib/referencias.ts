import type { EstadoInicial, MovimientoStock } from "@/domain/types";

/** Etiqueta y link de la referencia de un movimiento de stock. */
export function referenciaMovimiento(db: EstadoInicial, m: Pick<MovimientoStock, "referenciaTipo" | "referenciaId">): { label: string; href: string } {
  switch (m.referenciaTipo) {
    case "OC": {
      const oc = db.ordenesCompra.find((x) => x.id === m.referenciaId);
      return { label: oc?.numero ?? "OC", href: `/compras/oc/${m.referenciaId}` };
    }
    case "REMITO": {
      const r = db.remitos.find((x) => x.id === m.referenciaId);
      return { label: r?.numero ?? "Remito", href: `/remitos/${m.referenciaId}` };
    }
    case "TRANSFERENCIA": {
      const t = db.transferencias.find((x) => x.id === m.referenciaId);
      return { label: t?.numero ?? "Transferencia", href: `/stock/transferencias?id=${m.referenciaId}` };
    }
    case "AJUSTE": {
      const a = db.ajustes.find((x) => x.id === m.referenciaId);
      return { label: a?.numero ?? "Ajuste", href: `/stock/ajustes?id=${m.referenciaId}` };
    }
    default:
      return { label: m.referenciaId, href: "#" };
  }
}

/** Nombre de usuario por id. */
export function nombreUsuario(db: EstadoInicial, id: string): string {
  return db.usuarios.find((u) => u.id === id)?.nombre ?? (id === "sistema" ? "Sistema" : id);
}
