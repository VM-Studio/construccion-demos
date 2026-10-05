"use client";
import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "icon" | "icon-sm";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink-hover border border-ink",
  secondary: "bg-surface text-ink border border-border-strong hover:bg-subtle",
  ghost: "bg-transparent text-ink hover:bg-subtle border border-transparent",
  danger: "bg-danger text-white hover:bg-[#991b1b] border border-danger",
  link: "bg-transparent text-ink underline-offset-4 hover:underline border-none px-0 h-auto",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5",
  md: "h-9 px-3.5 text-[14px] gap-2",
  icon: "h-9 w-9 p-0",
  "icon-sm": "h-8 w-8 p-0",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-control font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
