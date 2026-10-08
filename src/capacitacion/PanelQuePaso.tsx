"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { useStore } from "@/store";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { useModoCapacitacion } from "./flag";
import { IMPACTOS, NOMBRES_CREADOS, TEXTOS } from "./impactos";
import { FilaDiferencia } from "./AvisoCambios";
import type { Medicion } from "./slice";

/** "12 artículos, 3 clientes, 1 proveedor, 1 OC, 1 ingreso…" a partir de lo medido en la sesión. */
export function resumenSesion(historial: Medicion[]): string {
  const cuenta = new Map<string, number>();
  for (const m of historial) for (const d of m.diferencias) if (d.creado) cuenta.set(d.creado, (cuenta.get(d.creado) ?? 0) + (d.cantidad ?? 1));
  return Object.keys(NOMBRES_CREADOS)
    .filter((k) => cuenta.get(k))
    .map((k) => {
      const n = cuenta.get(k)!;
      const [s, p] = NOMBRES_CREADOS[k];
      return `${n} ${n === 1 ? s : p}`;
    })
    .join(", ");
}

/**
 * Panel lateral "¿Qué pasó?": todo lo que se hizo en la sesión, en orden, con los cambios
 * reales medidos. Es el repaso del final de la reunión. Devuelve null con el modo apagado.
 */
export function PanelQuePaso() {
  const activo = useModoCapacitacion();
  const abierto = useStore((s) => s.capacitacion.panelAbierto);
  const abrir = useStore((s) => s.abrirPanelQuePaso);
  const historial = useStore((s) => s.capacitacion.historial);
  const limpiar = useStore((s) => s.limpiarHistorial);
  const usuarios = useStore((s) => s.db.usuarios);
  if (!activo) return null;
  const cronologico = [...historial].reverse();
  const resumen = resumenSesion(historial);
  return (
    <Sheet open={abierto} onOpenChange={abrir}>
      <SheetContent title={TEXTOS.panelTitulo} width={480}>
        <div className="border-b border-border px-5 pb-3 pt-4 pr-12">
          <h2 className="text-[16px] font-semibold text-ink">{TEXTOS.panelTitulo}</h2>
          <p className="mt-0.5 text-[13px] text-muted">{TEXTOS.panelSubtitulo}</p>
          {resumen && (
            <p className="mt-3 rounded-control border-l-2 border-l-accent bg-accent-soft px-3 py-2 text-[13px] text-ink">
              <span className="font-semibold">{TEXTOS.resumenSesion}</span> {resumen}.
            </p>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {cronologico.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-muted">{TEXTOS.panelVacio}</p>
          ) : (
            <ol className="space-y-4">
              {cronologico.map((m, i) => (
                <li key={m.id} className="relative border-l border-border pl-4">
                  <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full border-2 border-surface bg-accent" />
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[12px] text-muted tnum">{i + 1} · {formatDate(m.fecha, "HH:mm")}</span>
                    <span className="text-[13px] font-semibold text-ink">{IMPACTOS[m.accionId]?.titulo ?? m.accionId}</span>
                    <span className="text-[12px] text-muted">{usuarios.find((u) => u.id === m.usuarioId)?.nombre}</span>
                  </div>
                  {m.diferencias.length ? (
                    <div className="-mx-2 mt-1 space-y-0.5">
                      {m.diferencias.map((d, k) => (
                        <FilaDiferencia key={k} d={d} onNavegar={() => abrir(false)} />
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-[12px] text-muted">{TEXTOS.sinCambiosMedidos}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
        {cronologico.length > 0 && (
          <div className="flex justify-end border-t border-border px-5 py-3">
            <Button size="sm" variant="secondary" onClick={limpiar}><Trash2 /> {TEXTOS.limpiar}</Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
