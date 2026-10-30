"use client";
/**
 * Lista especial del cliente: parte de una lista general con un % de ajuste, puede tener markup
 * sobre costo por rubro (ej. hierro al 12 %) y precios puntuales por artículo, que mandan.
 */
import * as React from "react";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePuede } from "@/store/selectors";
import type { ListaPrecios, ReglaRubro } from "@/domain/types";
import { origenPrecioEspecial, precioLista } from "@/domain/precios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NumberInput } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { ProductoPicker } from "@/components/shared/producto-picker";
import { formatMoney } from "@/lib/format";

const ORIGEN = { MANUAL: "Precio especial", RUBRO: "Markup del rubro", BASE: "Lista base ± ajuste", SIN_PRECIO: "Sin precio" } as const;

export function PreciosEspecialesCliente({ clienteId }: { clienteId: string }) {
  const db = useDb();
  const puede = usePuede("precios.editar");
  const cli = db.clientes.find((c) => c.id === clienteId);
  const lista = db.listasPrecios.find((l) => l.clienteId === clienteId);
  const generales = db.listasPrecios.filter((l) => !l.clienteId && l.activa);
  const [f, setF] = React.useState({ listaBaseId: lista?.listaBaseId ?? (cli && generales.some((g) => g.id === cli.listaPreciosId) ? cli.listaPreciosId : (generales[0]?.id ?? "")), ajustePct: lista?.ajustePct ?? 0, reglas: (lista?.reglasRubro ?? []) as ReglaRubro[] });
  React.useEffect(() => {
    if (lista) setF({ listaBaseId: lista.listaBaseId ?? "", ajustePct: lista.ajustePct ?? 0, reglas: lista.reglasRubro ?? [] });
  }, [lista]);
  if (!cli) return null;
  const guardar = async (activa = true) => {
    const data: Omit<ListaPrecios, "id" | "creadoEn" | "actualizadoEn"> = {
      nombre: `Especial ${cli.nombreFantasia ?? cli.razonSocial}`,
      descripcion: `Lista especial de ${cli.razonSocial}`,
      markupPorDefecto: generales.find((g) => g.id === f.listaBaseId)?.markupPorDefecto ?? 0,
      activa,
      clienteId,
      listaBaseId: f.listaBaseId,
      ajustePct: f.ajustePct,
      reglasRubro: f.reglas.filter((r) => r.rubroId),
    };
    const r = await useStore.getState().guardarLista(data, lista?.id);
    if (!r.ok) toast.error(r.error);
  };
  const preciosManuales = lista ? db.precios.filter((p) => p.listaPreciosId === lista.id) : [];
  const activa = !!lista && lista.activa && cli.listaPreciosId === lista.id;
  if (!lista || !lista.activa)
    return (
      <Card className="p-6 text-center text-[13px]">
        <p className="mb-3 text-muted">{cli.razonSocial} usa la lista {db.listasPrecios.find((l) => l.id === cli.listaPreciosId)?.nombre ?? "general"}.</p>
        {puede && <Button onClick={() => guardar(true)}><Plus /> {lista ? "Volver a activar la lista especial" : "Crear lista especial"}</Button>}
      </Card>
    );
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Lista especial {activa && <Badge variant="success" className="ml-2">En uso</Badge>}</CardTitle>
          {puede && <Button size="sm" variant="ghost" onClick={() => guardar(false)}>Volver a la lista general</Button>}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label="Parte de la lista">
              <Select disabled={!puede} value={f.listaBaseId} onValueChange={(v) => setF({ ...f, listaBaseId: v })} options={generales.map((g) => ({ value: g.id, label: `${g.nombre} (${g.markupPorDefecto} %)` }))} />
            </FormField>
            <FormField label="Ajuste sobre esa lista (%)" hint="Negativo = descuento (ej. −5)">
              <NumberInput disabled={!puede} value={f.ajustePct} onValueChange={(v) => setF({ ...f, ajustePct: v })} />
            </FormField>
          </div>
          <div>
            <h4 className="mb-2 text-[13px] font-semibold">Markup por rubro (sobre costo)</h4>
            <div className="space-y-2">
              {f.reglas.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-[260px]"><Select size="sm" disabled={!puede} value={r.rubroId} onValueChange={(v) => setF({ ...f, reglas: f.reglas.map((x, j) => (j === i ? { ...x, rubroId: v } : x)) })} options={[{ value: "", label: "Elegí el rubro" }, ...db.rubros.map((ru) => ({ value: ru.id, label: ru.nombre }))]} /></div>
                  <NumberInput disabled={!puede} aria-label="Markup del rubro" value={r.markupPct} onValueChange={(v) => setF({ ...f, reglas: f.reglas.map((x, j) => (j === i ? { ...x, markupPct: v } : x)) })} className="h-8 w-24" />
                  <span className="text-[13px] text-muted">%</span>
                  {puede && <Button size="icon-sm" variant="ghost" aria-label="Quitar regla" onClick={() => setF({ ...f, reglas: f.reglas.filter((_, j) => j !== i) })}><Trash2 className="text-muted" /></Button>}
                </div>
              ))}
              {puede && <Button size="sm" variant="ghost" onClick={() => setF({ ...f, reglas: [...f.reglas, { rubroId: "", markupPct: 12 }] })}><Plus /> Agregar rubro</Button>}
            </div>
          </div>
          {puede && <div className="flex justify-end"><Button onClick={() => guardar(true)}><Save /> Guardar</Button></div>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Precios especiales por artículo</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <table className="w-full text-table">
            <thead className="text-[12px] text-muted"><tr><th className="h-8 text-left font-medium">Artículo</th><th className="h-8 text-right font-medium">Lista base</th><th className="h-8 w-[160px] text-right font-medium">Precio del cliente</th><th className="h-8 w-10" /></tr></thead>
            <tbody>
              {preciosManuales.map((pp) => {
                const p = db.productos.find((x) => x.id === pp.productoId);
                return (
                  <tr key={pp.id} className="border-t border-border">
                    <td className="py-1.5"><span className="mr-1.5 font-mono text-[11px] text-muted">{p?.codigo}</span>{p?.nombre}</td>
                    <td className="py-1.5 text-right text-muted tnum">{formatMoney(precioLista(pp.productoId, f.listaBaseId, db))}</td>
                    <td className="py-1.5 pl-2"><NumberInput disabled={!puede} aria-label={`Precio especial de ${p?.nombre}`} value={pp.precio} min={0} className="h-8" onValueChange={(v) => void useStore.getState().actualizarPrecio(pp.productoId, lista.id, v)} /></td>
                    <td className="py-1.5 pl-1">{puede && <Button size="icon-sm" variant="ghost" aria-label="Quitar precio especial" onClick={() => void useStore.getState().quitarPrecioLista(pp.productoId, lista.id)}><Trash2 className="text-muted" /></Button>}</td>
                  </tr>
                );
              })}
              {!preciosManuales.length && <tr><td colSpan={4} className="py-6 text-center text-[13px] text-muted">Sin precios puntuales: se usan el markup del rubro o la lista base.</td></tr>}
            </tbody>
          </table>
          {puede && (
            <ProductoPicker
              onSelect={(p) => void useStore.getState().actualizarPrecio(p.id, lista.id, precioLista(p.id, lista.id, db) || precioLista(p.id, f.listaBaseId, db))}
              excluir={new Set(preciosManuales.map((x) => x.productoId))}
            />
          )}
          <p className="text-[12px] text-muted">Ejemplo con el primer artículo: {(() => {
            const p = db.productos.find((x) => x.activo);
            return p ? `${p.nombre} → ${formatMoney(precioLista(p.id, lista.id, db))} (${ORIGEN[origenPrecioEspecial(p.id, lista, db)]})` : "—";
          })()}</p>
        </CardContent>
      </Card>
    </div>
  );
}
