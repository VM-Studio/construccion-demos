"use client";
import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function Checkbox({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-border-strong bg-surface outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1 disabled:opacity-50 data-[state=checked]:border-ink data-[state=checked]:bg-ink data-[state=indeterminate]:border-ink data-[state=indeterminate]:bg-ink data-[state=checked]:text-white data-[state=indeterminate]:text-white",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        {props.checked === "indeterminate" ? <Minus className="size-3" /> : <Check className="size-3" strokeWidth={3} />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
