"use client";
import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useDb } from "@/store/selectors";
import type { Acopio } from "@/domain/types";
import { movimientosAcopio, resumenArticulos } from "@/domain/acopios";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const th = "h-9 px-2 text-left font-medium whitespace-nowrap";
const thR = "h-9 px-2 text-right font-medium whitespace-nowrap";

/**
 * Movimientos del acopio agrupados por documento (NP / DP / ACD) con saldo corrido,
 * idéntico en estructura al documento "Detalle de acopio".
 */
export function MovimientosAcopio({ acopio, accionVacio }: { acopio: Acopio; /** Acción a mostrar cuando el acopio todavía no tiene retiros. */ accionVacio?: React.ReactNode }) {
  const db = useDb();
  const [obra, setObra] = React.useState("");
  const [buscar, setBuscar] = React.useState("");
  const [soloPendiente, setSoloPendiente] = React.useState(false);
  const grupos = React.useMemo(() => movimientosAcopio(acopio, db.notasPedido, db.devoluciones, db.ajustesAcopio, db), [acopio, db]);
  const remitoPorNumero = React.useMemo(() => new Map(db.remitos.map((r) => [r.numero, r.id])), [db.remitos]);
  const npPorNumero = React.useMemo(() => new Map(db.notasPedido.map((n) => [n.numero, n.id])), [db.notasPedido]);
  const q = buscar.trim().toLowerCase();
  const visibles = grupos
    .map((g) => ({ ...g, lineas: g.lineas.filter((l) => (!obra || l.obraId === obra) && (!q || `${l.codigo} ${l.descripcion}`.toLowerCase().includes(q)) && (!soloPendiente || (g.tipoDoc === "NP" && l.saldo > 0))) }))
    .filter((g) => g.lineas.length > 0);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-[240px]">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-disabled" />
          <Input aria-label="Buscar producto" placeholder="Producto o código…" value={buscar} onChange={(e) => setBuscar(e.target.value)} className="h-8 pl-8" />
        </div>
        <div className="w-[220px]">
          <Select size="sm" aria-label="Obra" value={obra} onValueChange={setObra} options={[{ value: "", label: "Todas las obras" }, ...db.obras.filter((o) => acopio.obraIds.includes(o.id)).map((o) => ({ value: o.id, label: o.nombre }))]} />
        </div>
        <label className="flex items-center gap-2 text-[12px] text-muted">
          <Switch checked={soloPendiente} onCheckedChange={setSoloPendiente} aria-label="Solo con pendiente de entrega" /> Solo con pendiente de entrega
        </label>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-[12.5px]">
            <thead className="sticky top-0 bg-[#F0EFEB] text-[11.5px] text-muted">
              <tr>
                <th className={th}>Código</th>
                <th className={th}>Descripción</th>
                <th className={th}>Obra</th>
                <th className={thR}>Cantidad</th>
                <th className={thR}>Entregados</th>
                <th className={thR}>Saldo</th>
                <th className={th}>Remitos</th>
                <th className={th}>Facturas</th>
                <th className={thR}>Precio</th>
                <th className={thR}>Subtotal</th>
                <th className={thR}>Saldo disponible</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((g) => (
                <React.Fragment key={g.id}>
                  <tr className="border-t border-border bg-[#FAFAF8]">
                    <td colSpan={11} className="px-2 py-1.5 text-[12px] font-semibold text-ink">
                      {g.tipoDoc === "NP" && npPorNumero.get(g.numero) ? (
                        <Link href={`/ventas/notas-pedido/${npPorNumero.get(g.numero)}`} className="hover:underline">{g.numero}</Link>
                      ) : (
                        g.numero
                      )}
                      <span className="font-normal text-muted"> · {formatDate(g.fecha)} · Monto </span>
                      <span className={cn("tnum", g.monto < 0 && "text-success")}>{formatMoney(g.monto)}</span>
                    </td>
                  </tr>
                  {g.lineas.map((l, i) => (
                    <tr key={`${g.id}-${i}`} className="border-t border-border align-top">
                      <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[11.5px]">{l.codigo}</td>
                      <td className={cn("px-2 py-1.5", g.tipoDoc === "ACD" && "text-muted")}>{l.descripcion}</td>
                      <td className="px-2 py-1.5 text-muted">{l.obra}</td>
                      <td className="px-2 py-1.5 text-right tnum">{formatNumber(l.cantidad, 3)}</td>
                      <td className="px-2 py-1.5 text-right tnum">{l.entregados}</td>
                      <td className={cn("px-2 py-1.5 text-right tnum", g.tipoDoc === "NP" && l.saldo > 0 && "font-semibold text-warning")}>{l.saldo}</td>
                      <td className="px-2 py-1.5 font-mono text-[11px]">
                        {l.remitos.map((r, k) => (
                          <React.Fragment key={r.numero + k}>
                            {k > 0 && ", "}
                            {r.id || remitoPorNumero.get(r.numero) ? <Link href={`/remitos/${r.id ?? remitoPorNumero.get(r.numero)}`} className="hover:underline">{r.numero}</Link> : r.numero}
                          </React.Fragment>
                        ))}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-[11px] text-muted">{l.facturas.join(", ")}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right tnum">{formatMoney(l.precio)}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right tnum">{formatMoney(l.subtotal)}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right font-medium tnum">{formatMoney(l.saldoDisponible)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              {!visibles.length && (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-muted">
                    {grupos.length ? (
                      "Sin movimientos para el filtro."
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <span>Todavía no hay retiros. Cada nota de pedido contra este acopio aparece acá con el saldo corrido.</span>
                        {accionVacio}
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/** Tabla final del detalle: todos los artículos de la lista congelada. */
export function ArticulosAcopio({ acopio }: { acopio: Acopio }) {
  const db = useDb();
  const [buscar, setBuscar] = React.useState("");
  const [conMov, setConMov] = React.useState(true);
  const filas = React.useMemo(() => resumenArticulos(acopio, db.notasPedido, db.devoluciones, db.productos, db.remitos), [acopio, db]);
  const q = buscar.trim().toLowerCase();
  const vis = filas.filter((f) => (!conMov || f.saldo !== 0 || f.cantidad !== 0 || f.pendiente !== 0) && (!q || `${f.codigo} ${f.articulo}`.toLowerCase().includes(q)));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-[240px]">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-disabled" />
          <Input aria-label="Buscar artículo" placeholder="Artículo o código…" value={buscar} onChange={(e) => setBuscar(e.target.value)} className="h-8 pl-8" />
        </div>
        <label className="flex items-center gap-2 text-[12px] text-muted">
          <Switch checked={conMov} onCheckedChange={setConMov} aria-label="Solo con movimiento" /> Solo con movimiento
        </label>
        <span className="text-[12px] text-muted">{vis.length} de {filas.length} artículos de la lista congelada</span>
      </div>
      <Card>
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full min-w-[760px] text-[12.5px]">
            <thead className="sticky top-0 bg-[#F0EFEB] text-[11.5px] text-muted">
              <tr>
                <th className={th}>Código</th>
                <th className={th}>Artículo</th>
                <th className={thR}>Precio congelado</th>
                <th className={thR}>Cantidad</th>
                <th className={thR}>Baja de artículos</th>
                <th className={thR}>Saldo</th>
                <th className={thR}>Pendiente de entrega</th>
              </tr>
            </thead>
            <tbody>
              {vis.map((f) => (
                <tr key={f.productoId} className="border-t border-border">
                  <td className="px-2 py-1.5 font-mono text-[11.5px]">{f.codigo}</td>
                  <td className="px-2 py-1.5">{f.articulo}</td>
                  <td className="px-2 py-1.5 text-right tnum">{formatMoney(f.precio)}</td>
                  <td className="px-2 py-1.5 text-right tnum">{formatNumber(f.cantidad, 3)}</td>
                  <td className="px-2 py-1.5 text-right tnum">{formatNumber(f.bajas, 3)}</td>
                  <td className={cn("px-2 py-1.5 text-right font-medium tnum", f.saldo < 0 && "text-ink")}>{f.saldo.toFixed(3).replace(".", ",")}</td>
                  <td className={cn("px-2 py-1.5 text-right tnum", f.pendiente > 0 ? "text-warning" : "text-disabled")}>{f.pendiente || "—"}</td>
                </tr>
              ))}
              {!vis.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted">
                    {!filas.length ? (
                      "El acopio no tiene precios congelados."
                    ) : conMov && !q ? (
                      <>
                        Todavía no se retiró ningún artículo.{" "}
                        <button type="button" className="font-medium text-ink underline underline-offset-2" onClick={() => setConMov(false)}>Ver toda la lista congelada</button>
                      </>
                    ) : (
                      "Ningún artículo coincide con la búsqueda."
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
