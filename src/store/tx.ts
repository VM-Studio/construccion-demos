import type {
  Auditoria,
  EstadoInicial,
  MovimientoStock,
  ReferenciaTipo,
  TipoComprobante,
  TipoMovimientoStock,
} from "@/domain/types";
import { reservarNumero, siguienteNumeroFiscal, type EntidadNumerada } from "@/domain/numeracion";
import { newId } from "@/lib/utils";

type Colecciones = {
  [K in keyof EstadoInicial]: EstadoInicial[K] extends unknown[] ? K : never;
}[keyof EstadoInicial];
type ElementoDe<K extends Colecciones> = EstadoInicial[K] extends Array<infer U> ? U : never;

/**
 * Transacción sobre el estado del demo: copia perezosa por colección
 * (sólo se clonan los arrays que se tocan) para que los selectores
 * memoizados por referencia sigan funcionando.
 */
export class Tx {
  readonly ahora = new Date().toISOString();
  private draft: EstadoInicial;
  private tocadas = new Set<string>();

  constructor(
    db: EstadoInicial,
    readonly usuarioId: string,
  ) {
    this.draft = { ...db };
  }

  /** Lectura (sin clonar). */
  get<K extends Colecciones>(k: K): ElementoDe<K>[] {
    return this.draft[k] as unknown as ElementoDe<K>[];
  }

  private escribir<K extends Colecciones>(k: K): ElementoDe<K>[] {
    if (!this.tocadas.has(k)) {
      (this.draft as unknown as Record<string, unknown[]>)[k] = [...(this.draft[k] as unknown as unknown[])];
      this.tocadas.add(k);
    }
    return this.draft[k] as unknown as ElementoDe<K>[];
  }

  find<K extends Colecciones>(k: K, id: string): ElementoDe<K> | undefined {
    return (this.get(k) as unknown as { id: string }[]).find((x) => x.id === id) as ElementoDe<K> | undefined;
  }

  must<K extends Colecciones>(k: K, id: string): ElementoDe<K> {
    const x = this.find(k, id);
    if (!x) throw new Error(`No se encontró ${String(k)} ${id}`);
    return x;
  }

  insert<K extends Colecciones>(k: K, item: ElementoDe<K>): ElementoDe<K> {
    this.escribir(k).push(item);
    return item;
  }

  /** Reemplaza un elemento por una copia con el patch aplicado (o el resultado de la función). */
  patch<K extends Colecciones>(
    k: K,
    id: string,
    patch: Partial<ElementoDe<K>> | ((x: ElementoDe<K>) => ElementoDe<K>),
  ): ElementoDe<K> {
    const arr = this.escribir(k) as unknown as { id: string }[];
    const i = arr.findIndex((x) => x.id === id);
    if (i < 0) throw new Error(`No se encontró ${String(k)} ${id}`);
    const actual = arr[i] as unknown as ElementoDe<K>;
    const nuevo = typeof patch === "function" ? patch(actual) : ({ ...(actual as object), ...(patch as object) } as ElementoDe<K>);
    (nuevo as unknown as { actualizadoEn: string }).actualizadoEn = this.ahora;
    arr[i] = nuevo as unknown as { id: string };
    return nuevo;
  }

  remove<K extends Colecciones>(k: K, id: string) {
    const arr = this.escribir(k) as unknown as { id: string }[];
    const i = arr.findIndex((x) => x.id === id);
    if (i >= 0) arr.splice(i, 1);
  }

  setConfig(patch: Partial<EstadoInicial["config"]>) {
    this.draft.config = { ...this.draft.config, ...patch };
  }

  get config() {
    return this.draft.config;
  }

  /** Reserva el próximo número interno (OC-00012, PED-00045…). */
  numero(entidad: EntidadNumerada): string {
    const [n, num] = reservarNumero(this.draft.numeradores, entidad);
    this.draft.numeradores = num;
    return n;
  }

  /** Reserva el próximo número fiscal por punto de venta (0001-00001234). */
  numeroFiscal(puntoVenta: string, tipo: TipoComprobante): string {
    const [n, num] = siguienteNumeroFiscal(this.draft.numeradores, puntoVenta, tipo);
    this.draft.numeradores = num;
    return n;
  }

  meta() {
    return { creadoEn: this.ahora, actualizadoEn: this.ahora };
  }

  /**
   * ÚNICO punto donde cambia el stock físico: registra el movimiento
   * (inmutable) y actualiza `cantidadFisica` del depósito.
   */
  movimiento(m: {
    productoId: string;
    depositoId: string;
    tipo: TipoMovimientoStock;
    cantidad: number;
    signo: 1 | -1;
    costoUnitario?: number;
    referenciaTipo: ReferenciaTipo;
    referenciaId: string;
    observacion?: string;
    fecha?: string;
  }): MovimientoStock {
    if (m.cantidad <= 0) throw new Error("La cantidad de un movimiento debe ser positiva");
    const producto = this.must("productos", m.productoId);
    const mov: MovimientoStock = {
      id: newId("mov"),
      productoId: m.productoId,
      depositoId: m.depositoId,
      tipo: m.tipo,
      cantidad: m.cantidad,
      signo: m.signo,
      costoUnitario: m.costoUnitario ?? producto.costoPromedio,
      referenciaTipo: m.referenciaTipo,
      referenciaId: m.referenciaId,
      usuarioId: this.usuarioId,
      observacion: m.observacion,
      fecha: m.fecha ?? this.ahora,
      ...this.meta(),
    };
    this.insert("movimientos", mov);
    const stockId = this.get("stock").find((s) => s.productoId === m.productoId && s.depositoId === m.depositoId)?.id;
    if (stockId) {
      this.patch("stock", stockId, (s) => ({ ...s, cantidadFisica: round3(s.cantidadFisica + m.signo * m.cantidad) }));
    } else {
      this.insert("stock", {
        id: newId("stk"),
        productoId: m.productoId,
        depositoId: m.depositoId,
        cantidadFisica: m.signo * m.cantidad,
        ...this.meta(),
      });
    }
    return mov;
  }

  /** Stock físico actual de un producto en un depósito. */
  fisico(productoId: string, depositoId: string): number {
    return this.get("stock").find((s) => s.productoId === productoId && s.depositoId === depositoId)?.cantidadFisica ?? 0;
  }

  fisicoTotal(productoId: string): number {
    return this.get("stock")
      .filter((s) => s.productoId === productoId)
      .reduce((a, s) => a + s.cantidadFisica, 0);
  }

  auditar(accion: string, entidad: string, entidadId: string, detalle = "") {
    const a: Auditoria = {
      id: newId("aud"),
      fecha: this.ahora,
      usuarioId: this.usuarioId,
      accion,
      entidad,
      entidadId,
      detalle,
      ...this.meta(),
    };
    this.insert("auditoria", a);
  }

  commit(): EstadoInicial {
    return this.draft;
  }
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
