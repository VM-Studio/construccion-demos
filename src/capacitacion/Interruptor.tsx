"use client";

import * as React from "react";
import { toast } from "sonner";
import { GraduationCap, History } from "lucide-react";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { usePuedeCambiarModo } from "./flag";
import { TEXTOS } from "./impactos";
import { PanelQuePaso } from "./PanelQuePaso";
import { ToasterCapacitacion } from "./AvisoCambios";

/** Prende o apaga el modo y avisa la primera vez que se activa en la sesión. */
function useCambiarModo() {
  const set = useStore((s) => s.setModoCapacitacion);
  const marcar = useStore((s) => s.marcarAvisoCapacitacion);
  return (v: boolean) => {
    if (!set(v)) return toast.error(TEXTOS.sinPermiso);
    if (v && !useStore.getState().capacitacion.avisado) {
      toast.success(TEXTOS.activado);
      marcar();
    } else if (!v) toast(TEXTOS.desactivado);
  };
}

const CLAVE_SESION = "cd-capacitacion-historial";

/** El historial no va al store persistido: vive en la pestaña (sessionStorage) para sobrevivir a una recarga. */
function useHistorialDeSesion() {
  React.useEffect(() => {
    try {
      const guardado = sessionStorage.getItem(CLAVE_SESION);
      if (guardado && !useStore.getState().capacitacion.historial.length)
        useStore.setState((s) => ({ capacitacion: { ...s.capacitacion, historial: JSON.parse(guardado) } }));
    } catch {}
    return useStore.subscribe((s, prev) => {
      if (s.capacitacion.historial === prev.capacitacion.historial) return;
      try {
        sessionStorage.setItem(CLAVE_SESION, JSON.stringify(s.capacitacion.historial));
      } catch {}
    });
  }, []);
}

/** Ícono del encabezado (a la izquierda del avatar): Switch, explicación y link a "¿Qué pasó?". */
export function InterruptorCapacitacion() {
  useHistorialDeSesion();
  const modo = useStore((s) => s.capacitacion.modo);
  const n = useStore((s) => s.capacitacion.historial.length);
  const abrirPanel = useStore((s) => s.abrirPanelQuePaso);
  const puede = usePuedeCambiarModo();
  const cambiar = useCambiarModo();
  if (!modo && !puede) return null;
  return (
    <>
      <Popover>
        <Tooltip content={TEXTOS.nombre}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={TEXTOS.nombre} className="relative">
              <GraduationCap />
              {modo && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent ring-2 ring-surface" aria-hidden />}
            </Button>
          </PopoverTrigger>
        </Tooltip>
        <PopoverContent align="end" className="w-[300px] p-0">
          <div className="space-y-2 px-4 py-3">
            <label className="flex items-center justify-between gap-3 text-[13px] font-semibold text-ink">
              {TEXTOS.nombre}
              <Switch checked={modo} disabled={!puede} onCheckedChange={cambiar} aria-label={TEXTOS.nombre} />
            </label>
            <p className="text-[12px] leading-snug text-muted">{TEXTOS.explicacion}</p>
            {!puede && <p className="text-[12px] text-muted">{TEXTOS.sinPermiso}</p>}
          </div>
          {modo && (
            <button onClick={() => abrirPanel(true)} className="flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-left text-[13px] text-ink hover:bg-subtle">
              <History className="size-4 text-muted" />
              <span className="flex-1">{TEXTOS.verQuePaso}</span>
              {n > 0 && <span className="text-[12px] text-muted tnum">{n}</span>}
            </button>
          )}
        </PopoverContent>
      </Popover>
      <PanelQuePaso />
      {modo && <ToasterCapacitacion />}
    </>
  );
}

/** El mismo Switch para Configuración → Datos del demo. */
export function InterruptorCapacitacionConfig({ className }: { className?: string }) {
  const modo = useStore((s) => s.capacitacion.modo);
  const puede = usePuedeCambiarModo();
  const cambiar = useCambiarModo();
  return (
    <label className={cn("flex items-start gap-3 text-[13px]", className)}>
      <Switch checked={modo} disabled={!puede} onCheckedChange={cambiar} aria-label={TEXTOS.nombre} />
      <span>
        <span className="block font-medium text-ink">{TEXTOS.nombre}</span>
        <span className="block text-[12px] text-muted">{TEXTOS.explicacion}</span>
      </span>
    </label>
  );
}
