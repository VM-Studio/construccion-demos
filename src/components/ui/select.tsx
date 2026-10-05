"use client";
import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/** Select simple con opciones. Usa "__all" internamente para valores vacíos. */
export function Select({
  value,
  onValueChange,
  options,
  placeholder = "Seleccionar…",
  className,
  disabled,
  id,
  size = "md",
  "aria-label": ariaLabel,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  size?: "sm" | "md";
  "aria-label"?: string;
}) {
  const EMPTY = "__empty";
  return (
    <SelectPrimitive.Root
      value={value === "" ? EMPTY : value}
      onValueChange={(v) => onValueChange(v === EMPTY ? "" : v)}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          "inline-flex w-full items-center justify-between gap-2 rounded-control border border-border-strong bg-surface px-3 text-left text-ink outline-none focus:border-ink focus:ring-1 focus:ring-ink disabled:bg-subtle disabled:text-muted data-[placeholder]:text-disabled",
          size === "sm" ? "h-8 text-[13px]" : "h-9 text-form",
          className,
        )}
      >
        <span className="truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon>
          <ChevronDown className="size-4 text-muted" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-[min(360px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-control border border-border bg-surface shadow-pop animate-fade-in"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value || EMPTY}
                value={o.value === "" ? EMPTY : o.value}
                disabled={o.disabled}
                className="relative flex h-8 cursor-pointer select-none items-center rounded-[4px] pl-7 pr-3 text-[13px] text-ink outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-subtle"
              >
                <SelectPrimitive.ItemIndicator className="absolute left-2">
                  <Check className="size-3.5" />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
