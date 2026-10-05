import * as React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

const variants: Record<BadgeVariant, string> = {
  neutral: "border-border-strong bg-subtle text-muted",
  success: "border-success/25 bg-success-soft text-success",
  warning: "border-warning/25 bg-warning-soft text-warning",
  danger: "border-danger/25 bg-danger-soft text-danger",
  info: "border-info/25 bg-info-soft text-info",
  accent: "border-accent/30 bg-accent-soft text-accent",
};

export function Badge({
  variant = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-[4px] border px-1.5 text-[11px] font-medium leading-none",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
