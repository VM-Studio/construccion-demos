"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Check, ChevronDown, Plus, RefreshCw, Sparkles } from "lucide-react";
import { useStore } from "@/store";
import { useDb } from "@/store/selectors";
import { faltantes, type ClavePrerequisito } from "@/domain/prerequisitos";
import { cn } from "@/lib/utils";
import { useModoCapacitacion } from "./flag";
import { IMPACTOS, TEXTOS, type Direccion } from "./impactos";

const ICONO: Record<Direccion, React.ComponentType<{ className?: string }>> = { sube: ArrowUp, baja: ArrowDown, crea: Plus, cambia: RefreshCw, cierra: Check };

const conN = (t: string, n?: number) => (n === undefined ? t.replace(/\s?\{n\}/g, "") : t.replace(/\{n\}/g, String(n)));

/**
 * Qué va a pasar en el resto del sistema al apretar el botón de arriba. Va inmediatamente
 * debajo del botón primario (o arriba del footer en los dialogs). Devuelve null con el modo apagado.
 */
export function Impacto({ accion, n, className }: { accion: string; n?: number; className?: string }) {
  const activo = useModoCapacitacion();
  const db = useDb();
  const colapsado = useStore((s) => !!s.capacitacion.colapsados[accion]);
  const toggle = useStore((s) => s.toggleImpactoColapsado);
  const imp = IMPACTOS[accion];
  if (!activo || !imp) return null;
  const falta = faltantes((imp.requiere ?? []) as ClavePrerequisito[], db);
  return (
    <div className={cn("w-full rounded-control border-l-2 border-l-accent bg-accent-soft px-3 py-2.5 text-left text-[12.5px] leading-snug text-ink", className)} data-capacitacion="impacto">
      {falta.length > 0 && (
        <p className="mb-2 rounded-[4px] bg-danger-soft px-2 py-1 text-danger">
          {TEXTOS.antesNecesitas}{" "}
          {falta.map((f, i) => (
            <React.Fragment key={f.clave}>
              {i > 0 && ", "}
              <Link href={f.href} className="font-medium underline underline-offset-2">{f.nombre}</Link>
            </React.Fragment>
          ))}
        </p>
      )}
      <button type="button" onClick={() => toggle(accion)} aria-expanded={!colapsado} className="flex w-full items-start gap-1.5 text-left">
        <Sparkles className="mt-px size-3.5 shrink-0 text-accent" />
        <span className="flex-1 font-semibold">{conN(imp.resumen, n)}</span>
        <ChevronDown className={cn("mt-px size-3.5 shrink-0 text-muted transition-transform", colapsado && "-rotate-90")} />
      </button>
      {!colapsado && (
        <>
          <ul className="mt-1.5 flex flex-wrap gap-1.5 pl-5">
            {imp.efectos.map((e, i) => {
              const Icono = ICONO[e.direccion];
              return (
                <li key={i} className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-[4px] border border-accent/20 bg-surface/70 px-1.5 py-0.5">
                  <Link href={e.href} className="whitespace-nowrap font-medium text-ink hover:underline">{e.modulo} → {e.pagina}</Link>
                  <Icono className="size-3 shrink-0 text-accent" aria-label={e.direccion} />
                  <span className="text-muted">{conN(e.que, n)}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-1.5 pl-5 text-muted">{TEXTOS.porQue} {imp.porQue}</p>
        </>
      )}
    </div>
  );
}
