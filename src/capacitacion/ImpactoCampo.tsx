"use client";

import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useModoCapacitacion } from "./flag";
import { CAMPOS } from "./impactos";

/**
 * Una línea debajo de un control que cambia el comportamiento, según el valor elegido
 * (ej. `campo={\`formaPago.${formaPago}\`}`). Devuelve null con el modo apagado o sin texto.
 */
export function ImpactoCampo({ campo, className }: { campo: string; className?: string }) {
  const activo = useModoCapacitacion();
  const texto = CAMPOS[campo];
  if (!activo || !texto) return null;
  return (
    <p className={cn("mt-1 flex items-start gap-1.5 text-[12px] leading-snug text-ink/80", className)} data-capacitacion="campo">
      <Info className="mt-px size-3.5 shrink-0 text-accent" />
      <span>{texto}</span>
    </p>
  );
}
