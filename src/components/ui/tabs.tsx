"use client";
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("flex items-center gap-1 overflow-x-auto border-b border-border", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "-mb-px inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3 text-[13px] font-medium text-muted outline-none transition-colors hover:text-ink focus-visible:bg-subtle data-[state=active]:border-ink data-[state=active]:text-ink [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("outline-none", className)} {...props} />;
}

/** Selector segmentado compacto (para toggles tipo "Por día / Por semana"). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-control border border-border bg-subtle p-0.5", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-7 whitespace-nowrap rounded-[4px] px-2.5 text-[12px] font-medium text-muted transition-colors",
            value === o.value ? "bg-surface text-ink shadow-[0_0_0_1px_var(--color-border)]" : "hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
