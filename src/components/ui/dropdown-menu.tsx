"use client";
import * as React from "react";
import * as DM from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;
export const DropdownMenuGroup = DM.Group;

export function DropdownMenuContent({ className, sideOffset = 4, align = "end", ...props }: React.ComponentPropsWithoutRef<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        sideOffset={sideOffset}
        align={align}
        className={cn("z-50 min-w-[180px] rounded-control border border-border bg-surface p-1 shadow-pop animate-fade-in", className)}
        {...props}
      />
    </DM.Portal>
  );
}

export function DropdownMenuItem({
  className,
  danger,
  ...props
}: React.ComponentPropsWithoutRef<typeof DM.Item> & { danger?: boolean }) {
  return (
    <DM.Item
      className={cn(
        "flex h-8 cursor-pointer select-none items-center gap-2 rounded-[4px] px-2 text-[13px] outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-subtle [&_svg]:size-4 [&_svg]:text-muted",
        danger ? "text-danger [&_svg]:text-danger" : "text-ink",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof DM.Label>) {
  return <DM.Label className={cn("px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentPropsWithoutRef<typeof DM.Separator>) {
  return <DM.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}
