"use client";

import * as React from "react";
import { Command } from "cmdk";
import { Plus, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store";
import { useDb, usePosiciones, posicionEn, usePuede, useUnidadNegocio } from "@/store/selectors";
import { AltaRapidaSheet } from "./alta-rapida";
import { obtenerPrecio } from "@/domain/precios";
import { formatMoney, formatQty } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Producto } from "@/domain/types";

/**
 * Buscador de productos (Popover + cmdk) por código, nombre, marca o código de barras.
 * Muestra el disponible del depósito y el precio de la lista (o el costo en compras).
 */
export function ProductoPicker({
  onSelect,
  depositoId,
  listaId,
  proveedorId,
  mostrarCosto,
  excluir,
  filtro,
  precioDe,
  label = "Agregar producto",
  disabled,
  className,
  permitirAlta,
}: {
  onSelect: (p: Producto) => void;
  depositoId?: string | null;
  listaId?: string;
  proveedorId?: string;
  mostrarCosto?: boolean;
  excluir?: Set<string>;
  /** Limita los productos ofrecidos (unidad de negocio, lista congelada…). */
  filtro?: (p: Producto) => boolean;
  /** Precio a mostrar (p. ej. congelado del acopio). */
  precioDe?: (p: Producto) => number | undefined;
  label?: string;
  disabled?: boolean;
  className?: string;
  /** Mostrar "+ Crear artículo nuevo…" (por defecto sí, salvo listas cerradas como un acopio congelado). */
  permitirAlta?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [alta, setAlta] = React.useState(false);
  const puedeCrear = usePuede("productos.editar") && (permitirAlta ?? !precioDe);
  const unActiva = useUnidadNegocio();
  const [busqueda, setBusqueda] = React.useState("");
  const db = useDb();
  const posiciones = usePosiciones();
  const activos = React.useMemo(() => db.productos.filter((p) => p.activo && !excluir?.has(p.id) && (!filtro || filtro(p))), [db.productos, excluir, filtro]);
  const delProveedor = proveedorId ? activos.filter((p) => p.proveedorHabitualId === proveedorId) : [];
  const otros = proveedorId ? activos.filter((p) => p.proveedorHabitualId !== proveedorId) : activos;

  const item = (p: Producto) => {
    const pos = posicionEn(posiciones.get(p.id), depositoId ?? null);
    const valor = precioDe ? precioDe(p) : mostrarCosto ? p.costoUltimo : listaId ? obtenerPrecio(p.id, listaId, db.precios) : undefined;
    return (
      <Command.Item
        key={p.id}
        value={`${p.codigo} ${p.nombre} ${p.marca ?? ""} ${p.codigoBarras ?? ""}`}
        onSelect={() => {
          onSelect(p);
          setOpen(false);
        }}
        className="flex cursor-pointer items-center gap-3 rounded-[4px] px-2 py-1.5 text-[13px] outline-none data-[selected=true]:bg-subtle"
      >
        <span className="w-[72px] shrink-0 font-mono text-[11px] text-muted">{p.codigo}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ink">{p.nombre}</span>
          <span className="block truncate text-[11px] text-muted">{p.marca}</span>
        </span>
        <span className="hidden shrink-0 text-right text-[11px] sm:block">
          <span className={cn("block tnum", pos.disponible <= 0 ? "text-danger" : "text-muted")}>Disp. {formatQty(pos.disponible, p.unidad)}</span>
          {valor !== undefined && <span className="block font-medium text-ink tnum">{formatMoney(valor)}</span>}
        </span>
      </Command.Item>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" disabled={disabled} className={className}>
          <Plus />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(560px,calc(100vw-32px))] p-0" align="start">
        <Command loop className="flex flex-col" filter={(value, search) => (search.toLowerCase().split(/\s+/).filter(Boolean).every((w) => value.toLowerCase().includes(w)) ? 1 : 0)}>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 text-disabled" />
            <Command.Input autoFocus value={busqueda} onValueChange={setBusqueda} placeholder="Buscar por código, nombre, marca o código de barras…" className="h-10 w-full bg-transparent text-[13px] outline-none placeholder:text-disabled" />
          </div>
          <Command.List className="max-h-[340px] overflow-y-auto p-1">
            <Command.Empty className="py-6 text-center text-[13px] text-muted">{activos.length ? "No se encontraron artículos." : "Todavía no hay artículos cargados."}</Command.Empty>
            {delProveedor.length > 0 && (
              <Command.Group heading="Del proveedor" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-muted">
                {delProveedor.map(item)}
              </Command.Group>
            )}
            <Command.Group heading={proveedorId ? "Otros productos" : undefined} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-muted">
              {otros.map(item)}
            </Command.Group>
            {puedeCrear && (
              <Command.Item
                value={`__nuevo ${busqueda}`}
                forceMount
                onSelect={() => {
                  setOpen(false);
                  setAlta(true);
                }}
                className="mt-1 flex cursor-pointer items-center gap-2 rounded-[4px] border-t border-border px-2 py-2 text-[13px] font-medium outline-none data-[selected=true]:bg-subtle"
              >
                <Plus className="size-3.5" /> Crear artículo nuevo…
              </Command.Item>
            )}
          </Command.List>
        </Command>
      </PopoverContent>
      <AltaRapidaSheet
        tipo="producto"
        open={alta}
        onOpenChange={setAlta}
        unidadNegocioId={unActiva}
        onCreado={(id) => {
          const p = useStore.getState().db.productos.find((x) => x.id === id);
          if (p) onSelect(p);
        }}
      />
    </Popover>
  );
}
