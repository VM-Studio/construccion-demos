"use client";
import * as React from "react";
import { Flag, Maximize2, Minimize2, PlayCircle, Warehouse } from "lucide-react";
import { useDb, usePuede, useSucursalActiva } from "@/store/selectors";
import type { Despacho } from "@/domain/types";
import { minutosEspera, minutosPreparacion, minutosTotal, nivelTiempo, promedio } from "@/domain/despachos";
import { VacioGuiado } from "@/components/shared/vacio-guiado";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatDate, formatNumber } from "@/lib/format";
import { diaLocal } from "@/lib/periodos";
import { cn } from "@/lib/utils";
import { useAccionesDespacho, useAhora } from "./despachos-view";
import { Impacto } from "@/capacitacion";

/**
 * "Depósito en vivo": kanban Espera / Preparación / Finalizados de hoy con cronómetros, con el
 * mismo diseño que el resto de las páginas. "Pantalla completa" lo agranda para un televisor del
 * depósito (Esc para salir). Se actualiza solo cada 2 s con lo que cargan los demás usuarios.
 */
export function DepositoEnVivo() {
  const db = useDb();
  const sucursal = useSucursalActiva();
  const puede = usePuede("despachos.operar");
  const ahora = useAhora(15_000);
  const { iniciar, finalizar, dialogo } = useAccionesDespacho();
  const [deposito, setDeposito] = React.useState(db.sucursales.find((s) => s.id === sucursal)?.depositoId ?? db.depositos[0]?.id ?? "");
  const [completa, setCompleta] = React.useState(false);
  const hoy = diaLocal(new Date());
  const ds = db.despachos.filter((d) => d.depositoId === deposito && (d.estado === "ESPERA" || d.estado === "PREPARACION" || (["FINALIZADO", "EN_VIAJE", "ENTREGADO"].includes(d.estado) && d.fechaFin && diaLocal(d.fechaFin) === hoy)));
  const cols: { titulo: string; estados: Despacho["estado"][]; tono: string }[] = [
    { titulo: "En espera", estados: ["ESPERA"], tono: "border-t-border-strong" },
    { titulo: "En preparación", estados: ["PREPARACION"], tono: "border-t-warning" },
    { titulo: "Finalizados hoy", estados: ["FINALIZADO", "EN_VIAJE", "ENTREGADO"], tono: "border-t-success" },
  ];
  const prom = promedio(ds.filter((d) => d.fechaFin).map((d) => minutosPreparacion(d, ahora)));
  React.useEffect(() => {
    if (!completa) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCompleta(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [completa]);

  const selector = <div className="w-[220px]"><Select aria-label="Depósito" value={deposito} onValueChange={setDeposito} options={db.depositos.map((d) => ({ value: d.id, label: d.nombre }))} /></div>;
  const resumen = `${formatDate(ahora, "EEEE d 'de' MMMM · HH:mm")} · preparación promedio ${prom === null ? "—" : `${prom} min`} · se actualiza solo`;

  const tablero = (
    <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-3", completa && "min-h-0 flex-1")}>
      {cols.map((c) => {
        const lista = ds.filter((d) => c.estados.includes(d.estado)).sort((a, b) => (a.fechaInicioPreparacion ?? a.fechaEspera).localeCompare(b.fechaInicioPreparacion ?? b.fechaEspera));
        return (
          <section key={c.titulo} className={cn("flex flex-col rounded-card border border-border border-t-4 bg-surface", c.tono, completa ? "min-h-0" : "min-h-[320px]")}>
            <h2 className={cn("flex items-center justify-between border-b border-border px-4 font-semibold", completa ? "py-3 text-[18px]" : "py-2.5 text-[14px]")}>
              {c.titulo} <span className={cn("tnum", completa ? "text-[22px]" : "text-[16px]")}>{lista.length}</span>
            </h2>
            <div className={cn("flex-1 space-y-2.5 p-3", completa && "min-h-0 overflow-y-auto")}>
              {puede && c.estados.includes("ESPERA") && lista.length > 0 && <Impacto accion="iniciarPreparacion" />}
              {puede && c.estados.includes("PREPARACION") && lista.length > 0 && <Impacto accion="finalizarDespacho" />}
              {lista.map((d) => {
                const cli = db.clientes.find((x) => x.id === d.clienteId);
                const enEstado = d.estado === "ESPERA" ? minutosEspera(d, ahora) : d.estado === "PREPARACION" ? minutosPreparacion(d, ahora) : minutosTotal(d, ahora);
                const nivel = nivelTiempo(d.estado === "PREPARACION" || d.estado === "ESPERA" ? minutosTotal(d, ahora) : enEstado);
                return (
                  <article key={d.id} className={cn("rounded-card border border-border", completa ? "p-4" : "p-3")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className={cn("truncate font-semibold leading-tight", completa ? "text-[20px]" : "text-[14px]")}>{cli?.nombreFantasia ?? cli?.razonSocial}</div>
                        <div className={cn("mt-0.5 text-muted", completa ? "text-[14px]" : "text-[12px]")}>{d.numero} · {d.modalidad === "ENVIO" ? "Envío" : "Retira"} · {formatNumber(d.items.reduce((a, i) => a + i.cantidad, 0))} u.</div>
                      </div>
                      <div className={cn("text-right font-semibold leading-none tnum", completa ? "text-[32px]" : "text-[22px]", nivel === "critico" ? "text-danger" : nivel === "alto" ? "text-warning" : "text-ink")}>
                        {enEstado ?? 0}<span className="text-[12px] font-normal text-muted"> min</span>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <span className={cn("rounded-control bg-subtle px-2 py-0.5 font-medium", completa ? "text-[15px]" : "text-[12px]")}>{d.posicion}</span>
                      {puede && d.estado === "ESPERA" && <Button size={completa ? "md" : "sm"} onClick={() => iniciar(d)}><PlayCircle /> Iniciar preparación</Button>}
                      {puede && d.estado === "PREPARACION" && <Button size={completa ? "md" : "sm"} onClick={() => finalizar(d)}><Flag /> Finalizar</Button>}
                      {c.estados.includes("FINALIZADO") && <span className="text-[12px] text-muted">{formatDate(d.fechaFin, "HH:mm")}</span>}
                    </div>
                  </article>
                );
              })}
              {!lista.length && <p className="py-8 text-center text-[13px] text-disabled">Sin despachos</p>}
            </div>
          </section>
        );
      })}
    </div>
  );

  if (completa)
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-app p-5">
        <header className="mb-4 flex flex-wrap items-center gap-4">
          <div>
            <div className="text-[22px] font-semibold tracking-tight">Depósito en vivo · {db.depositos.find((d) => d.id === deposito)?.nombre}</div>
            <div className="text-[14px] text-muted">{resumen}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {selector}
            <Button variant="secondary" onClick={() => setCompleta(false)}><Minimize2 /> Salir de pantalla completa</Button>
          </div>
        </header>
        {tablero}
        {dialogo}
      </div>
    );

  return (
    <>
      <PageHeader titulo="Depósito en vivo" descripcion={resumen} acciones={<>{selector}<Button variant="secondary" onClick={() => setCompleta(true)}><Maximize2 /> Pantalla completa</Button></>} />
      {!ds.length && (
        <div className="mb-4 rounded-card border border-border bg-surface">
          <VacioGuiado pagina="enVivo" icono={Warehouse} className="py-6" />
        </div>
      )}
      {tablero}
      {dialogo}
    </>
  );
}
