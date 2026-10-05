"use client";

import * as React from "react";
import { PackageOpen, Trash2 } from "lucide-react";
import { NumberInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDb, usePosiciones, posicionEn } from "@/store/selectors";
import { calcularTotales } from "@/domain/ventas";
import { formatMoney, formatQty, unidadCorta } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Producto } from "@/domain/types";
import { ProductoPicker } from "./producto-picker";

export interface LineaBase {
  id: string;
  productoId: string;
  cantidad: number;
  precio?: number;
  descuentoPct?: number;
}

export interface ColumnaExtra<T> {
  header: string;
  width?: number;
  align?: "left" | "right";
  cell: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode;
}

/**
 * Grilla editable de líneas reutilizable en OC, presupuestos, pedidos, acopios,
 * transferencias y ajustes. Calcula subtotales y totales con `calcularTotales`.
 */
export function ItemsGrid<T extends LineaBase>({
  items,
  onChange,
  crearItem,
  depositoId,
  listaId,
  proveedorId,
  mostrarCosto,
  precioLabel = "Precio unit.",
  conPrecio = true,
  conDescuento = true,
  extras = [],
  avisoLinea,
  totales,
  readOnly,
  vacio = "Agregá productos con el buscador.",
}: {
  items: T[];
  onChange: (items: T[]) => void;
  crearItem: (p: Producto) => T;
  depositoId?: string | null;
  listaId?: string;
  proveedorId?: string;
  mostrarCosto?: boolean;
  precioLabel?: string;
  conPrecio?: boolean;
  conDescuento?: boolean;
  extras?: ColumnaExtra<T>[];
  /** Mensaje bajo la línea (p. ej. "Supera el disponible"), con tono. */
  avisoLinea?: (item: T, p: Producto) => { texto: string; tono: "danger" | "warning" | "muted" } | undefined;
  totales?: { descuentoPct: number; ivaPct: number; onDescuentoChange?: (v: number) => void; extra?: React.ReactNode };
  readOnly?: boolean;
  vacio?: string;
}) {
  const db = useDb();
  const posiciones = usePosiciones();
  const productos = React.useMemo(() => new Map(db.productos.map((p) => [p.id, p])), [db.productos]);
  const update = (id: string, patch: Partial<T>) => onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));
  const usados = React.useMemo(() => new Set(items.map((i) => i.productoId)), [items]);

  const subtotalLinea = (i: T) => i.cantidad * (i.precio ?? 0) * (1 - (i.descuentoPct ?? 0) / 100);
  const t = totales
    ? calcularTotales(items.map((i) => ({ cantidad: i.cantidad, precioUnitario: i.precio ?? 0, descuentoPct: i.descuentoPct ?? 0 })), totales.descuentoPct, totales.ivaPct)
    : null;

  return (
    <div className="min-w-0">
      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full min-w-[720px] border-collapse text-table">
          <thead className="bg-[#FAFAF8]">
            <tr className="text-[12px] text-muted">
              <th className="h-9 px-3 text-left font-medium">Producto</th>
              <th className="h-9 w-[130px] px-3 text-right font-medium">Cantidad</th>
              {extras.map((e) => (
                <th key={e.header} style={{ width: e.width }} className={cn("h-9 px-3 font-medium", e.align === "right" ? "text-right" : "text-left")}>
                  {e.header}
                </th>
              ))}
              {conPrecio && <th className="h-9 w-[140px] px-3 text-right font-medium">{precioLabel}</th>}
              {conPrecio && conDescuento && <th className="h-9 w-[90px] px-3 text-right font-medium">Desc. %</th>}
              {conPrecio && <th className="h-9 w-[130px] px-3 text-right font-medium">Subtotal</th>}
              {!readOnly && <th className="h-9 w-10" />}
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const p = productos.get(i.productoId);
              if (!p) return null;
              const pos = posicionEn(posiciones.get(p.id), depositoId ?? null);
              const aviso = avisoLinea?.(i, p);
              return (
                <tr key={i.id} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[11px] text-muted">{p.codigo}</span>
                      <span className="text-ink">{p.nombre}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-muted">
                      {p.marca && <span>{p.marca}</span>}
                      {depositoId !== undefined && (
                        <span className={cn("tnum", pos.disponible < i.cantidad && "text-danger")}>Disponible {formatQty(pos.disponible, p.unidad)}</span>
                      )}
                      {p.unidadesPorPallet && <span>{p.unidadesPorPallet} por pallet</span>}
                    </div>
                    {aviso && <div className={cn("mt-0.5 text-[11px]", aviso.tono === "danger" ? "text-danger" : aviso.tono === "warning" ? "text-warning" : "text-muted")}>{aviso.texto}</div>}
                  </td>
                  <td className="px-3 py-2">
                    {readOnly ? (
                      <div className="text-right tnum">{formatQty(i.cantidad, p.unidad)}</div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <NumberInput aria-label={`Cantidad de ${p.nombre}`} value={i.cantidad} min={0} onValueChange={(v) => update(i.id, { cantidad: v } as Partial<T>)} className="h-8" />
                        <span className="w-9 shrink-0 text-[11px] text-muted">{unidadCorta(p.unidad)}</span>
                      </div>
                    )}
                  </td>
                  {extras.map((e) => (
                    <td key={e.header} className={cn("px-3 py-2", e.align === "right" && "text-right")}>
                      {e.cell(i, (patch) => update(i.id, patch))}
                    </td>
                  ))}
                  {conPrecio && (
                    <td className="px-3 py-2">
                      {readOnly ? (
                        <div className="text-right tnum">{formatMoney(i.precio ?? 0)}</div>
                      ) : (
                        <NumberInput aria-label={`${precioLabel} de ${p.nombre}`} value={i.precio ?? 0} min={0} onValueChange={(v) => update(i.id, { precio: v } as Partial<T>)} className="h-8" />
                      )}
                    </td>
                  )}
                  {conPrecio && conDescuento && (
                    <td className="px-3 py-2">
                      {readOnly ? (
                        <div className="text-right tnum">{i.descuentoPct ?? 0} %</div>
                      ) : (
                        <NumberInput aria-label={`Descuento de ${p.nombre}`} value={i.descuentoPct ?? 0} min={0} onValueChange={(v) => update(i.id, { descuentoPct: Math.min(100, v) } as Partial<T>)} className="h-8" />
                      )}
                    </td>
                  )}
                  {conPrecio && <td className="px-3 py-2 pt-3.5 text-right font-medium tnum">{formatMoney(subtotalLinea(i))}</td>}
                  {!readOnly && (
                    <td className="px-1 py-2">
                      <Button variant="ghost" size="icon-sm" aria-label={`Quitar ${p.nombre}`} onClick={() => remove(i.id)}>
                        <Trash2 className="text-muted" />
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
            {!items.length && (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-[13px] text-muted">
                  <PackageOpen className="mx-auto mb-2 size-5 text-disabled" />
                  {vacio}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {!readOnly && (
            <ProductoPicker
              onSelect={(p) => onChange([...items, crearItem(p)])}
              depositoId={depositoId}
              listaId={listaId}
              proveedorId={proveedorId}
              mostrarCosto={mostrarCosto}
              excluir={usados}
            />
          )}
        </div>
        {t && totales && (
          <dl className="grid w-full max-w-[320px] grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-[13px] sm:ml-auto">
            <dt className="text-muted">Subtotal</dt>
            <dd className="text-right tnum">{formatMoney(t.subtotal)}</dd>
            <dt className="flex items-center gap-2 text-muted">
              Descuento
              {totales.onDescuentoChange && !readOnly ? (
                <NumberInput aria-label="Descuento general" value={totales.descuentoPct} min={0} onValueChange={(v) => totales.onDescuentoChange?.(Math.min(100, v))} className="h-7 w-16" />
              ) : (
                <span>{totales.descuentoPct} %</span>
              )}
            </dt>
            <dd className="text-right tnum">− {formatMoney(t.descuento)}</dd>
            <dt className="text-muted">IVA {totales.ivaPct} %</dt>
            <dd className="text-right tnum">{formatMoney(t.iva)}</dd>
            <dt className="border-t border-border pt-1.5 font-semibold">Total</dt>
            <dd className="border-t border-border pt-1.5 text-right font-semibold tnum">{formatMoney(t.total)}</dd>
            {totales.extra}
          </dl>
        )}
      </div>
    </div>
  );
}
