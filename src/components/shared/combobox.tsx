"use client";

import * as React from "react";
import { Command } from "cmdk";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface OpcionCombo {
  value: string;
  label: string;
  detalle?: string;
  buscar?: string;
}

/** Selector con buscador (cmdk). Opcionalmente con acción "+ Nuevo…" al final. */
export function Combobox({
  value,
  onChange,
  opciones,
  placeholder = "Buscar…",
  vacio = "Sin resultados",
  disabled,
  className,
  id,
  accionNuevo,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  opciones: OpcionCombo[];
  placeholder?: string;
  vacio?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  accionNuevo?: { label: string; onSelect: () => void };
  "aria-label"?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const actual = opciones.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-control border border-border-strong bg-surface px-3 text-left text-form outline-none focus:border-ink focus:ring-1 focus:ring-ink disabled:bg-subtle disabled:text-muted",
            className,
          )}
        >
          <span className={cn("truncate", !actual && "text-disabled")}>{actual ? actual.label : placeholder}</span>
          <ChevronDown className="size-4 shrink-0 text-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0" align="start">
        <Command loop>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 text-disabled" />
            <Command.Input autoFocus placeholder={placeholder} className="h-9 w-full bg-transparent text-[13px] outline-none placeholder:text-disabled" />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto p-1">
            <Command.Empty className="py-5 text-center text-[13px] text-muted">{vacio}</Command.Empty>
            {opciones.map((o) => (
              <Command.Item
                key={o.value}
                value={`${o.label} ${o.detalle ?? ""} ${o.buscar ?? ""}`}
                onSelect={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-[4px] px-2 py-1.5 text-[13px] outline-none data-[selected=true]:bg-subtle"
              >
                <Check className={cn("size-3.5 shrink-0", o.value === value ? "opacity-100" : "opacity-0")} />
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {o.detalle && <span className="shrink-0 text-[11px] text-muted">{o.detalle}</span>}
              </Command.Item>
            ))}
            {accionNuevo && (
              <Command.Item
                value={`__nuevo ${accionNuevo.label}`}
                forceMount
                onSelect={() => {
                  setOpen(false);
                  accionNuevo.onSelect();
                }}
                className="mt-1 flex cursor-pointer items-center gap-2 rounded-[4px] border-t border-border px-2 py-2 text-[13px] font-medium outline-none data-[selected=true]:bg-subtle"
              >
                <Plus className="size-3.5" /> {accionNuevo.label}
              </Command.Item>
            )}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
