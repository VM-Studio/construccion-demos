"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

/** Panel lateral. `side="right"` (default, 480/640) o `side="left"` (navegación mobile). */
export function SheetContent({
  className,
  children,
  width = 480,
  side = "right",
  title,
  hideClose,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  width?: 280 | 480 | 640 | 760 | 960;
  side?: "right" | "left";
  title: string;
  hideClose?: boolean;
}) {
  const w = { 280: "sm:w-[280px]", 480: "sm:w-[480px]", 640: "sm:w-[640px]", 760: "sm:w-[760px]", 960: "sm:w-[min(960px,95vw)]" }[width];
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/30 animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 z-50 flex w-full flex-col bg-surface shadow-pop outline-none animate-fade-in",
          side === "right" ? "right-0 border-l border-border" : "left-0 border-r border-border",
          side === "left" ? "w-[280px] max-w-[85vw]" : w,
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
        <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
        {!hideClose && (
          <DialogPrimitive.Close
            aria-label="Cerrar"
            className="absolute right-3 top-3 z-10 rounded-control p-1.5 text-muted hover:bg-subtle hover:text-ink"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        )}
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
