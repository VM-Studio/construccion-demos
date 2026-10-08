"use client";

import * as React from "react";
import Link from "next/link";
import { Toaster, toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Pin, RefreshCw, X } from "lucide-react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import { IMPACTOS, TEXTOS } from "./impactos";
import type { Diferencia, Medicion } from "./slice";

const MAX_EN_TOAST = 8;
const TOASTER_ID = "capacitacion";

/** Contenedor propio de los avisos (arriba a la derecha, debajo del encabezado) para no taparse con los toasts comunes. */
export function ToasterCapacitacion() {
  return <Toaster id={TOASTER_ID} position="top-right" offset={{ top: 64, right: 16 }} mobileOffset={{ top: 64, right: 16, left: 16 }} visibleToasts={3} />;
}
const DURACION = 8000;

/** Una fila de diferencia: "Stock › Cemento › Casa Central · Pendiente 0 → 40 (+40)". Es un link a la pantalla donde se ve. */
export function FilaDiferencia({ d, onNavegar }: { d: Diferencia; onNavegar?: () => void }) {
  const contenido = (
    <>
      <span className="font-medium text-ink">{d.grupo}</span>
      <span className="text-disabled"> › </span>
      <span className="text-ink">{d.titulo}</span>
      {d.cambios.map((c, i) => (
        <span key={i}>
          <span className="text-disabled"> · </span>
          {c.campo && <span className="text-muted">{c.campo} </span>}
          <span className="tnum text-ink">{c.antes} → {c.despues}</span>
          {c.delta && (
            <span className={cn("ml-1 inline-flex items-center gap-0.5 font-medium tnum", c.signo > 0 ? "text-success" : c.signo < 0 ? "text-danger" : "text-ink")}>
              {c.signo > 0 ? <ArrowUpRight className="size-3" /> : c.signo < 0 ? <ArrowDownRight className="size-3" /> : <RefreshCw className="size-3" />}({c.delta})
            </span>
          )}
        </span>
      ))}
    </>
  );
  const cls = "block rounded-[4px] px-2 py-1 text-[12.5px] leading-snug hover:bg-subtle";
  return d.href ? (
    <Link href={d.href} onClick={onNavegar} className={cls}>
      {contenido}
    </Link>
  ) : (
    <span className={cls}>{contenido}</span>
  );
}

function Aviso({ id, m, fijo }: { id: string | number; m: Medicion; fijo: boolean }) {
  const impacto = IMPACTOS[m.accionId];
  const abrirPanel = useStore((s) => s.abrirPanelQuePaso);
  const filas = fijo ? m.diferencias : m.diferencias.slice(0, MAX_EN_TOAST);
  const resto = m.diferencias.length - filas.length;
  const cerrar = () => toast.dismiss(id);
  return (
    <div className="w-[min(460px,calc(100vw-32px))] rounded-card border border-border border-l-2 border-l-accent bg-surface p-3 shadow-pop" role="status">
      <div className="mb-1.5 flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-ink">{m.diferencias.length ? TEXTOS.avisoTitulo : TEXTOS.avisoSinCambios}</p>
          {impacto && <p className="text-[12px] text-muted">{impacto.titulo}</p>}
        </div>
        <button onClick={cerrar} aria-label={TEXTOS.cerrar} className="rounded p-0.5 text-disabled hover:text-ink">
          <X className="size-3.5" />
        </button>
      </div>
      {filas.length > 0 && (
        <div className={cn("-mx-1 space-y-0.5", fijo && "max-h-[50vh] overflow-y-auto")}>
          {filas.map((d, i) => (
            <FilaDiferencia key={i} d={d} onNavegar={fijo ? undefined : cerrar} />
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2 text-[12px]">
        <span className="text-muted">{resto > 0 ? `y ${resto} cambios más` : ""}</span>
        <span className="flex gap-3">
          {!fijo && m.diferencias.length > 0 && (
            <button className="inline-flex items-center gap-1 font-medium text-ink hover:underline" onClick={() => toast.custom((t) => <Aviso id={t} m={m} fijo />, { id, duration: Infinity, toasterId: TOASTER_ID })}>
              <Pin className="size-3" /> {TEXTOS.verDetalle}
            </button>
          )}
          <button
            className="font-medium text-ink hover:underline"
            onClick={() => {
              cerrar();
              abrirPanel(true);
            }}
          >
            {TEXTOS.verQuePaso}
          </button>
        </span>
      </div>
    </div>
  );
}

/** Toast grande con los cambios reales de una acción (8 s; "Ver detalle" lo deja fijo). */
export function mostrarAvisoCambios(m: Medicion) {
  toast.custom((t) => <Aviso id={t} m={m} fijo={false} />, { id: m.id, duration: DURACION, unstyled: true, toasterId: TOASTER_ID });
}
