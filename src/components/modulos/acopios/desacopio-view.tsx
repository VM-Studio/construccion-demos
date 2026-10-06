"use client";
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ExternalLink, FileSearch } from "lucide-react";
import { useAcopiosResumen, useDb, useVeCircuito2 } from "@/store/selectors";
import { PageHeader } from "@/components/shared/page-header";
import { Combobox } from "@/components/shared/combobox";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CabeceraAcopio } from "./acopio-detalle";
import { ArticulosAcopio, MovimientosAcopio } from "./acopio-tablas";
import { DescargarDesacopio } from "./descargar-desacopio";

/** Pantalla de consulta para atender al cliente: elegir cliente → acopio → ver y descargar. */
export function DesacopioView() {
  const db = useDb();
  const params = useSearchParams();
  const veC2 = useVeCircuito2();
  const resumen = useAcopiosResumen().filter((r) => veC2 || r.acopio.circuito !== 2);
  const inicial = params.get("acopio") ? db.acopios.find((a) => a.id === params.get("acopio")) : undefined;
  const [clienteId, setClienteId] = React.useState(inicial?.clienteId ?? params.get("cliente") ?? "");
  const [acopioId, setAcopioId] = React.useState(inicial?.id ?? "");
  const delCliente = resumen.filter((r) => r.acopio.clienteId === clienteId).sort((a, b) => b.acopio.fechaCreacion.localeCompare(a.acopio.fechaCreacion));
  React.useEffect(() => {
    if (!acopioId && delCliente.length === 1) setAcopioId(delCliente[0].acopio.id);
  }, [acopioId, delCliente]);
  const acopio = db.acopios.find((a) => a.id === acopioId);
  const conAcopio = [...new Set(resumen.map((r) => r.acopio.clienteId))];
  return (
    <div>
      <PageHeader titulo="Estado de desacopio" descripcion="Buscá el cliente, elegí el acopio y descargalo en PDF o Excel con el mismo formato que usan hoy." />
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-start gap-4">
          <div className="w-full max-w-[380px]">
            <Combobox
              aria-label="Cliente"
              value={clienteId}
              onChange={(v) => {
                setClienteId(v);
                setAcopioId("");
              }}
              placeholder="Buscar cliente por nombre o código…"
              opciones={conAcopio.map((id) => {
                const c = db.clientes.find((x) => x.id === id);
                return { value: id, label: c?.nombreFantasia ?? c?.razonSocial ?? id, detalle: c?.codigo, buscar: `${c?.razonSocial} ${c?.cuit}` };
              })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {delCliente.map((r) => (
              <button key={r.acopio.id} onClick={() => setAcopioId(r.acopio.id)} className={cn("flex items-center gap-2 rounded-control border px-3 py-1.5 text-left text-[12.5px] transition-colors", acopioId === r.acopio.id ? "border-ink bg-subtle" : "border-border hover:border-border-strong")}>
                <span className="font-mono">{r.acopio.numero}</span>
                <span className="text-muted tnum">{formatMoney(r.saldo)}</span>
                <StatusBadge tipo="ACOPIO" estado={r.estado} />
              </button>
            ))}
          </div>
        </div>
      </Card>
      {!acopio ? (
        <Card>
          <EmptyState icono={FileSearch} titulo={clienteId ? "Elegí un acopio" : "Elegí un cliente"} descripcion="El estado de desacopio muestra cada nota de pedido, devolución y traspaso con el saldo corrido, y la tabla de artículos." />
        </Card>
      ) : (
        <>
          <CabeceraAcopio
            acopio={acopio}
            acciones={
              <>
                <Link href={`/acopios/${acopio.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-[13px] font-medium text-muted hover:bg-subtle hover:text-ink">
                  <ExternalLink className="size-4" /> Abrir acopio
                </Link>
                <DescargarDesacopio acopioId={acopio.id} variant="primary" />
              </>
            }
          />
          <h2 className="mb-2 text-[14px] font-semibold">Movimientos</h2>
          <MovimientosAcopio acopio={acopio} />
          <h2 className="mb-2 mt-6 text-[14px] font-semibold">Artículos de la lista congelada</h2>
          <ArticulosAcopio acopio={acopio} />
        </>
      )}
    </div>
  );
}
