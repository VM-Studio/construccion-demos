"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Calculator, Check, ChevronDown, FileUp, Rocket } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePuede } from "@/store/selectors";
import { pasosCargaInicial, type AccionPaso } from "@/domain/cargaInicial";
import type { Permiso } from "@/domain/permisos";
import { ImportarCsvDialog } from "@/components/shared/importar-csv-dialog";
import { ActualizacionMasivaDialog } from "@/components/modulos/productos/actualizacion-masiva";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const PERMISO_ACCION: Record<AccionPaso, Permiso> = {
  importarArticulos: "productos.editar",
  importarClientes: "clientes.editar",
  importarProveedores: "proveedores.editar",
  calcularPrecios: "precios.editar",
};

/**
 * Guía de carga inicial: visible mientras falte algún paso (y el usuario no la haya ocultado).
 * Cada paso se tilda solo según los datos y dice qué se va a ver después.
 */
export function GuiaCargaInicial({ className }: { className?: string }) {
  const db = useDb();
  const router = useRouter();
  const oculta = useStore((s) => !!s.ui.guiaOculta[s.ui.usuarioId ?? ""]);
  const setOculta = useStore((s) => s.setGuiaOculta);
  const [abierta, setAbierta] = React.useState(true);
  const [accion, setAccion] = React.useState<AccionPaso | null>(null);
  const permisos: Record<AccionPaso, boolean> = {
    importarArticulos: usePuede(PERMISO_ACCION.importarArticulos),
    importarClientes: usePuede(PERMISO_ACCION.importarClientes),
    importarProveedores: usePuede(PERMISO_ACCION.importarProveedores),
    calcularPrecios: usePuede(PERMISO_ACCION.calcularPrecios),
  };
  const configurar = usePuede("config.ver");

  const pasos = React.useMemo(() => pasosCargaInicial(db), [db]);
  const hechos = pasos.filter((p) => p.hecho).length;
  if (oculta || hechos === pasos.length) return null;
  const siguiente = pasos.find((p) => !p.hecho);

  return (
    <Card className={cn("overflow-hidden", className)} data-tour="guia-carga">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Rocket className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-semibold text-ink">Guía de carga inicial</h2>
          <p className="text-[12px] text-muted">Cada paso habilita el siguiente. Se tildan solos a medida que cargás.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-28">
            <div className="mb-1 text-right text-[12px] font-medium text-ink tnum">{hechos} de {pasos.length}</div>
            <Progress value={hechos / pasos.length} tone="accent" />
          </div>
          <Button size="sm" variant="ghost" onClick={() => setOculta(true)}>No mostrar más</Button>
          <Button size="icon-sm" variant="ghost" aria-label={abierta ? "Contraer la guía" : "Expandir la guía"} aria-expanded={abierta} onClick={() => setAbierta(!abierta)}>
            <ChevronDown className={cn("transition-transform", !abierta && "-rotate-90")} />
          </Button>
        </div>
      </div>
      {abierta && (
        <ol className="divide-y divide-border">
          {pasos.map((p, i) => {
            const actual = p.id === siguiente?.id;
            return (
              <li key={p.id} className={cn("flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center", actual && "bg-accent-soft/40")}>
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tnum",
                      p.hecho ? "border-success bg-success text-white" : actual ? "border-accent text-accent" : "border-border-strong text-muted",
                    )}
                    aria-label={p.hecho ? "Hecho" : `Paso ${i + 1}`}
                  >
                    {p.hecho ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className={cn("text-[13px] font-medium", p.hecho ? "text-muted line-through decoration-border-strong" : "text-ink")}>{p.titulo}</span>
                      {p.progreso && <span className="text-[12px] text-muted tnum">{p.progreso}</span>}
                    </div>
                    {!p.hecho && <p className="text-[12.5px] text-muted">{p.descripcion}</p>}
                    {!p.hecho && <p className="text-[12px] text-muted"><span className="font-medium text-ink">Qué vas a ver después:</span> {p.despues}</p>}
                  </div>
                </div>
                {!p.hecho && (
                  <div className="flex shrink-0 flex-wrap gap-2 pl-9 sm:pl-0">
                    {p.secundaria && permisos[p.secundaria.accion] && (
                      <Button size="sm" variant="secondary" onClick={() => setAccion(p.secundaria!.accion)}>
                        {p.secundaria.accion === "calcularPrecios" ? <Calculator /> : <FileUp />} {p.secundaria.label}
                      </Button>
                    )}
                    <Button size="sm" variant={actual ? "primary" : "secondary"} onClick={() => router.push(p.href)}>
                      {p.ir} <ArrowRight />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {configurar && abierta && <p className="border-t border-border px-4 py-2 text-[11.5px] text-muted">Si la ocultás, se vuelve a mostrar desde Configuración → Datos del demo.</p>}
      <ImportarCsvDialog tipo="articulos" open={accion === "importarArticulos"} onOpenChange={(v) => !v && setAccion(null)} />
      <ImportarCsvDialog tipo="clientes" open={accion === "importarClientes"} onOpenChange={(v) => !v && setAccion(null)} />
      <ImportarCsvDialog tipo="proveedores" open={accion === "importarProveedores"} onOpenChange={(v) => !v && setAccion(null)} />
      <ActualizacionMasivaDialog open={accion === "calcularPrecios"} onOpenChange={(v) => !v && setAccion(null)} inicial={{ alcance: "TODO", modo: "MARKUP" }} />
    </Card>
  );
}
