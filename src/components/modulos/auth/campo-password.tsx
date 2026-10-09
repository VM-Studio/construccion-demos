"use client";
import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { fortalezaPassword } from "@/domain/usuarios";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const NIVELES = ["Muy débil", "Débil", "Aceptable", "Buena", "Fuerte"];

/** Input de contraseña con mostrar/ocultar e indicador de fortaleza opcional. */
export function CampoPassword({ id, value, onChange, autoComplete, conFortaleza, autoFocus }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; conFortaleza?: boolean; autoFocus?: boolean }) {
  const [ver, setVer] = React.useState(false);
  const f = fortalezaPassword(value);
  return (
    <div>
      <div className="relative">
        <Input id={id} type={ver ? "text" : "password"} autoComplete={autoComplete} autoFocus={autoFocus} value={value} onChange={(e) => onChange(e.target.value)} className="pr-10" />
        <button type="button" onClick={() => setVer(!ver)} aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink">
          {ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {conFortaleza && value && (
        <div className="mt-1.5">
          <div className="flex gap-1">{[0, 1, 2, 3].map((i) => <span key={i} className={cn("h-1 flex-1 rounded-full", i < f ? (f <= 1 ? "bg-danger" : f === 2 ? "bg-warning" : "bg-success") : "bg-subtle")} />)}</div>
          <p className="mt-1 text-[12px] text-muted">{value.length < 10 ? `Faltan ${10 - value.length} caracteres (mínimo 10)` : NIVELES[f]}</p>
        </div>
      )}
    </div>
  );
}
