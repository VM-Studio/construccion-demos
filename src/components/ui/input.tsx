import * as React from "react";
import { cn } from "@/lib/utils";
import { numeroAR } from "@/lib/numero";

export const controlBase =
  "w-full rounded-control border border-border-strong bg-surface px-3 text-form text-ink placeholder:text-disabled outline-none transition-colors focus:border-ink focus-visible:outline-none focus:ring-1 focus:ring-ink disabled:bg-subtle disabled:text-muted aria-[invalid=true]:border-danger";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input ref={ref} type={type} className={cn(controlBase, "h-9", className)} {...props} />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(controlBase, "min-h-[72px] py-2", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

/** Input numérico que entrega number y acepta coma decimal. */
export function NumberInput({
  value,
  onValueChange,
  className,
  min,
  step,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number;
  onValueChange: (v: number) => void;
}) {
  const [text, setText] = React.useState(String(value ?? 0).replace(".", ","));
  const last = React.useRef(value);
  React.useEffect(() => {
    if (value !== last.current) {
      setText(String(value ?? 0).replace(".", ","));
      last.current = value;
    }
  }, [value]);
  return (
    <input
      inputMode="decimal"
      className={cn(controlBase, "h-9 text-right tnum", className)}
      value={text}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d.,-]/g, "");
        setText(raw);
        // Punto decimal ("1757509.28") o de miles ("5.900") según el caso: ver numeroAR.
        const n = numeroAR(raw);
        if (Number.isFinite(n)) {
          const v = min !== undefined && n < Number(min) ? Number(min) : n;
          last.current = v;
          onValueChange(v);
        }
      }}
      onFocus={(e) => e.currentTarget.select()}
      step={step}
      {...props}
    />
  );
}
