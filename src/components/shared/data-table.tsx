"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Search, SearchX } from "lucide-react";
import { cn, normalizar } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./empty-state";
import type { LucideIcon } from "lucide-react";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
  width?: number | string;
  sortable?: boolean;
  /** Valor para ordenar (por defecto, el texto de la celda no se usa: definilo si `sortable`). */
  sortValue?: (row: T) => string | number | null | undefined;
  /** Contenido de la fila de totales. */
  footer?: React.ReactNode;
  /** Ocultar en pantallas chicas (columnas no prioritarias). */
  hideOnMobile?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
  /** Texto en el que busca el buscador. Sin esto no se muestra buscador. */
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  /** Slot de filtros (izquierda de la toolbar). */
  filters?: React.ReactNode;
  /** Slot de acciones (derecha de la toolbar). */
  actions?: React.ReactNode;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selected?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  initialSort?: { key: string; dir: "asc" | "desc" };
  pageSize?: 25 | 50 | 100;
  /** Estado vacío: configuración simple o un nodo completo (p. ej. `<VacioGuiado />`). */
  empty?: { icono?: LucideIcon; titulo: string; descripcion?: React.ReactNode; accion?: React.ReactNode } | React.ReactElement;
  /** Mostrar fila de totales (usa `footer` de cada columna). */
  showFooter?: boolean;
  rowClassName?: (row: T) => string | undefined;
  className?: string;
  /** Altura máxima con scroll interno y header pegajoso. */
  maxHeight?: number | string;
  toolbarClassName?: string;
  /** Sin borde/card (para usar dentro de otra card). */
  bare?: boolean;
}

function useDebounced<T>(value: T, ms = 200) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Tabla genérica densa: búsqueda (debounce 200 ms), orden por columna,
 * paginación en memoria (25/50/100), selección, totales y estados vacíos.
 */
export function DataTable<T>({
  rows,
  columns,
  getRowId,
  searchText,
  searchPlaceholder = "Buscar…",
  filters,
  actions,
  onRowClick,
  selectable,
  selected,
  onSelectionChange,
  initialSort,
  pageSize: initialPageSize = 25,
  empty,
  showFooter,
  rowClassName,
  className,
  maxHeight,
  toolbarClassName,
  bare,
}: DataTableProps<T>) {
  const [query, setQuery] = React.useState("");
  const q = useDebounced(query, 200);
  const [sort, setSort] = React.useState(initialSort ?? null);
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState<number>(initialPageSize);

  const filtered = React.useMemo(() => {
    if (!q.trim() || !searchText) return rows;
    const terms = normalizar(q.trim()).split(/\s+/);
    return rows.filter((r) => {
      const t = normalizar(searchText(r));
      return terms.every((term) => t.includes(term));
    });
  }, [rows, q, searchText]);

  const sorted = React.useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb), "es") * dir;
    });
  }, [filtered, sort, columns]);

  React.useEffect(() => setPage(0), [q, rows.length, pageSize]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = sorted.slice(current * pageSize, current * pageSize + pageSize);

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key === key ? (s.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" }));

  const allVisibleSelected = selectable && visible.length > 0 && visible.every((r) => selected?.has(getRowId(r)));
  const someSelected = selectable && visible.some((r) => selected?.has(getRowId(r)));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allVisibleSelected) visible.forEach((r) => next.delete(getRowId(r)));
    else visible.forEach((r) => next.add(getRowId(r)));
    onSelectionChange?.(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange?.(next);
  };

  const alignClass = (a?: "left" | "right" | "center") => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");
  const hasToolbar = searchText || filters || actions;

  return (
    <div className={cn(!bare && "rounded-card border border-border bg-surface", "min-w-0", className)}>
      {hasToolbar && (
        <div className={cn("flex flex-col gap-2 border-b border-border p-3 lg:flex-row lg:items-center lg:justify-between", toolbarClassName)}>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {searchText && (
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-disabled" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="h-8 w-full rounded-control border border-border-strong bg-surface pl-8 pr-3 text-[13px] outline-none placeholder:text-disabled focus:border-ink focus:ring-1 focus:ring-ink"
                />
              </div>
            )}
            {filters}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}

      <div className="w-full overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
        <table className="w-full border-collapse text-table">
          <thead className="sticky top-0 z-[1] bg-[#FAFAF8]">
            <tr>
              {selectable && (
                <th className="h-9 w-10 border-b border-border px-3">
                  <Checkbox
                    aria-label="Seleccionar todo"
                    checked={allVisibleSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                  />
                </th>
              )}
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{ width: c.width }}
                  className={cn(
                    "h-9 whitespace-nowrap border-b border-border px-3 text-[12px] font-medium text-muted",
                    alignClass(c.align),
                    c.hideOnMobile && "hidden md:table-cell",
                  )}
                >
                  {c.sortable && c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={cn("inline-flex items-center gap-1 hover:text-ink", c.align === "right" && "flex-row-reverse")}
                    >
                      {c.header}
                      {sort?.key === c.key ? (
                        sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                      ) : (
                        <ChevronsUpDown className="size-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const id = getRowId(row);
              const isSel = selected?.has(id);
              return (
                <tr
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "h-10 border-b border-border last:border-b-0",
                    onRowClick && "cursor-pointer",
                    isSel ? "bg-accent-soft/60" : "hover:bg-[#FAFAF8]",
                    rowClassName?.(row),
                  )}
                >
                  {selectable && (
                    <td className="w-10 px-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox aria-label="Seleccionar fila" checked={!!isSel} onCheckedChange={() => toggleOne(id)} />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn("px-3 py-1.5 align-middle text-ink", alignClass(c.align), c.align === "right" && "whitespace-nowrap", c.hideOnMobile && "hidden md:table-cell", c.className)}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          {showFooter && sorted.length > 0 && (
            <tfoot className="sticky bottom-0 bg-[#FAFAF8]">
              <tr className="h-10 border-t border-border-strong font-semibold">
                {selectable && <td />}
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-3 text-ink", alignClass(c.align), c.hideOnMobile && "hidden md:table-cell")}>
                    {c.footer}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
        {rows.length === 0 ? (
          React.isValidElement(empty) ? (
            empty
          ) : (
            <EmptyState icono={empty?.icono} titulo={empty?.titulo ?? "Todavía no hay registros"} descripcion={empty?.descripcion} accion={empty?.accion} />
          )
        ) : sorted.length === 0 ? (
          <EmptyState
            icono={SearchX}
            titulo="Sin resultados para el filtro"
            descripcion="Probá con otra búsqueda o limpiá los filtros."
            accion={
              query ? (
                <Button variant="secondary" size="sm" onClick={() => setQuery("")}>
                  Limpiar búsqueda
                </Button>
              ) : undefined
            }
          />
        ) : null}
      </div>

      {sorted.length > 25 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-[12px] text-muted">
          <span className="tnum">
            {current * pageSize + 1}–{Math.min(sorted.length, (current + 1) * pageSize)} de {sorted.length}
          </span>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">Filas por página</span>
            <Select
              size="sm"
              className="w-[72px]"
              aria-label="Filas por página"
              value={String(pageSize)}
              onValueChange={(v) => setPageSize(Number(v))}
              options={[
                { value: "25", label: "25" },
                { value: "50", label: "50" },
                { value: "100", label: "100" },
              ]}
            />
            <Button variant="ghost" size="icon-sm" aria-label="Página anterior" disabled={current === 0} onClick={() => setPage(current - 1)}>
              <ChevronLeft />
            </Button>
            <span className="tnum">
              {current + 1} / {pages}
            </span>
            <Button variant="ghost" size="icon-sm" aria-label="Página siguiente" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
