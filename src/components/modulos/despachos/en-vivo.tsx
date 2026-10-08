"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Flag, Minimize2, PlayCircle, Warehouse } from "lucide-react";
import { useDb, usePuede, useSucursalActiva } from "@/store/selectors";
import type { Despacho } from "@/domain/types";
import { minutosEspera, minutosPreparacion, minutosTotal, nivelTiempo, promedio } from "@/domain/despachos";
import { useEmpresa } from "@/store/selectors";
import { VacioGuiado } from "@/components/shared/vacio-guiado";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatDate, formatNumber } from "@/lib/format";
import { diaLocal } from "@/lib/periodos";
import { cn } from "@/lib/utils";
import { useAccionesDespacho, useAhora } from "./despachos-view";

/** "Depósito en vivo": kanban de pantalla completa (Espera / Preparación / Finalizados de hoy) con cronómetros. */
export function DepositoEnVivo() {
  const db = useDb();
  const router = useRouter();
  const empresa = useEmpresa();
  const sucursal = useSucursalActiva();
  const puede = usePuede("despachos.operar");
  const ahora = useAhora(15_000);
  const { iniciar, finalizar, dialogo } = useAccionesDespacho();
  const [deposito, setDeposito] = React.useState(db.sucursales.find((s) => s.id === sucursal)?.depositoId ?? db.depositos[0]?.id ?? "");
  const hoy = diaLocal(new Date());
  const ds = db.despachos.filter((d) => d.depositoId === deposito && (d.estado === "ESPERA" || d.estado === "PREPARACION" || (["FINALIZADO", "EN_VIAJE", "ENTREGADO"].includes(d.estado) && d.fechaFin && diaLocal(d.fechaFin) === hoy)));
  const cols: { titulo: string; estados: Despacho["estado"][]; tono: string }[] = [
    { titulo: "En espera", estados: ["ESPERA"], tono: "border-t-border-strong" },
    { titulo: "En preparación", estados: ["PREPARACION"], tono: "border-t-warning" },
    { titulo: "Finalizados hoy", estados: ["FINALIZADO", "EN_VIAJE", "ENTREGADO"], tono: "border-t-success" },
  ];
  const prom = promedio(ds.filter((d) => d.fechaFin).map((d) => minutosPreparacion(d, ahora)));
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && router.push("/despachos");
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-app p-5">
      <header className="mb-4 flex flex-wrap items-center gap-4">
        <div>
          <div className="text-[22px] font-semibold tracking-tight">{empresa.empresa} · Depósito en vivo</div>
          <div className="text-[14px] text-muted">{formatDate(ahora, "EEEE d 'de' MMMM · HH:mm")} · preparación promedio {prom === null ? "—" : `${prom} min`}</div>
        </div>
        <div className="ml-auto w-[220px]"><Select aria-label="Depósito" value={deposito} onValueChange={setDeposito} options={db.depositos.map((d) => ({ value: d.id, label: d.nombre }))} /></div>
        <Button variant="secondary" onClick={() => router.push("/despachos")}><Minimize2 /> Salir</Button>
      </header>
      {!ds.length && (
        <div className="mb-4 rounded-card border border-border bg-surface">
          <VacioGuiado pagina="enVivo" icono={Warehouse} className="py-6" />
        </div>
      )}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-3">
        {cols.map((c) => {
          const lista = ds.filter((d) => c.estados.includes(d.estado)).sort((a, b) => (a.fechaInicioPreparacion ?? a.fechaEspera).localeCompare(b.fechaInicioPreparacion ?? b.fechaEspera));
          return (
            <section key={c.titulo} className={cn("flex min-h-0 flex-col rounded-card border border-border border-t-4 bg-surface", c.tono)}>
              <h2 className="flex items-center justify-between border-b border-border px-4 py-3 text-[18px] font-semibold">
                {c.titulo} <span className="text-[22px] tnum">{lista.length}</span>
              </h2>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                {lista.map((d) => {
                  const cli = db.clientes.find((x) => x.id === d.clienteId);
                  const enEstado = d.estado === "ESPERA" ? minutosEspera(d, ahora) : d.estado === "PREPARACION" ? minutosPreparacion(d, ahora) : minutosTotal(d, ahora);
                  const nivel = nivelTiempo(d.estado === "PREPARACION" || d.estado === "ESPERA" ? minutosTotal(d, ahora) : enEstado);
                  return (
                    <article key={d.id} className="rounded-card border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[20px] font-semibold leading-tight">{cli?.nombreFantasia ?? cli?.razonSocial}</div>
                          <div className="mt-1 text-[14px] text-muted">{d.numero} · {d.modalidad === "ENVIO" ? "Envío" : "Retira"} · {formatNumber(d.items.reduce((a, i) => a + i.cantidad, 0))} u.</div>
                        </div>
                        <div className={cn("text-right text-[32px] font-semibold leading-none tnum", nivel === "critico" ? "text-danger" : nivel === "alto" ? "text-warning" : "text-ink")}>
                          {enEstado ?? 0}<span className="text-[14px] font-normal text-muted"> min</span>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="rounded-control bg-subtle px-2.5 py-1 text-[15px] font-medium">{d.posicion}</span>
                        {puede && d.estado === "ESPERA" && <Button onClick={() => iniciar(d)}><PlayCircle /> Iniciar preparación</Button>}
                        {puede && d.estado === "PREPARACION" && <Button onClick={() => finalizar(d)}><Flag /> Finalizar</Button>}
                        {c.estados.includes("FINALIZADO") && <span className="text-[13px] text-muted">{formatDate(d.fechaFin, "HH:mm")}</span>}
                      </div>
                    </article>
                  );
                })}
                {!lista.length && <p className="py-10 text-center text-[15px] text-disabled">Sin despachos</p>}
              </div>
            </section>
          );
        })}
      </div>
      {dialogo}
    </div>
  );
}
