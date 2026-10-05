"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowRight, TrendingUp } from "lucide-react";
import { useStore } from "@/store";
import { useDb } from "@/store/selectors";
import { calcularActualizacionMasiva, type ModoActualizacion, type Redondeo } from "@/domain/precios";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { NumberInput } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Segmented } from "@/components/ui/tabs";
import { formatMoney, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export type Alcance = "TODO" | "RUBRO" | "PROVEEDOR" | "MARCA" | "SELECCIONADOS";

/**
 * Actualización masiva de precios: alcance, listas, modo (aumento, baja o
 * recálculo desde costo + markup) y redondeo, con vista previa antes de aplicar.
 */
export function ActualizacionMasivaDialog({
  open,
  onOpenChange,
  seleccionados,
  inicial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  seleccionados?: Set<string>;
  inicial?: { alcance: Alcance; productoIds?: string[]; modo?: "AUMENTAR" | "MARKUP"; pct?: number };
}) {
  const db = useDb();
  const aplicar = useStore((s) => s.aplicarCambiosPrecios);
  const [alcance, setAlcance] = React.useState<Alcance>(inicial?.alcance ?? (seleccionados?.size ? "SELECCIONADOS" : "TODO"));
  const [valorAlcance, setValorAlcance] = React.useState("");
  const [listas, setListas] = React.useState<Set<string>>(() => new Set(db.listasPrecios.filter((l) => l.activa).map((l) => l.id)));
  const [modo, setModo] = React.useState<"AUMENTAR" | "DISMINUIR" | "MARKUP">(inicial?.modo ?? "AUMENTAR");
  const [pct, setPct] = React.useState(inicial?.pct ?? 5);
  const [redondeo, setRedondeo] = React.useState<Redondeo>(10);
  const [idsFijos, setIdsFijos] = React.useState<string[] | undefined>(inicial?.productoIds);

  React.useEffect(() => {
    if (!open) return;
    setAlcance(inicial?.alcance ?? (seleccionados?.size ? "SELECCIONADOS" : "TODO"));
    setIdsFijos(inicial?.productoIds);
    if (inicial?.modo) setModo(inicial.modo);
    if (inicial?.pct !== undefined) setPct(inicial.pct);
    setValorAlcance("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const marcas = React.useMemo(() => [...new Set(db.productos.map((p) => p.marca).filter(Boolean) as string[])].sort(), [db.productos]);

  const productoIds = React.useMemo(() => {
    const activos = db.productos.filter((p) => p.activo);
    switch (alcance) {
      case "TODO":
        return activos.map((p) => p.id);
      case "RUBRO":
        return valorAlcance ? activos.filter((p) => p.rubroId === valorAlcance).map((p) => p.id) : [];
      case "PROVEEDOR":
        return valorAlcance ? activos.filter((p) => p.proveedorHabitualId === valorAlcance).map((p) => p.id) : [];
      case "MARCA":
        return valorAlcance ? activos.filter((p) => p.marca === valorAlcance).map((p) => p.id) : [];
      case "SELECCIONADOS":
        return idsFijos ?? [...(seleccionados ?? [])];
    }
  }, [alcance, valorAlcance, db.productos, seleccionados, idsFijos]);

  const modoCalc: ModoActualizacion =
    modo === "MARKUP"
      ? { tipo: "MARKUP", markups: Object.fromEntries(db.listasPrecios.map((l) => [l.id, l.markupPorDefecto])) }
      : { tipo: modo, pct };
  const cambios = React.useMemo(
    () => calcularActualizacionMasiva(db.precios, db.productos, { productoIds, listaIds: [...listas] }, modoCalc, redondeo),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db.precios, db.productos, productoIds, listas, modo, pct, redondeo],
  );
  const reales = cambios.filter((c) => c.nuevo !== c.anterior);
  const nProductos = new Set(reales.map((c) => c.productoId)).size;
  const prod = (id: string) => db.productos.find((p) => p.id === id);
  const lista = (id: string) => db.listasPrecios.find((l) => l.id === id);

  const confirmar = () => {
    const desc =
      modo === "MARKUP" ? "Recalculado desde costo + markup" : `${modo === "AUMENTAR" ? "Aumento" : "Baja"} de ${pct} %`;
    const r = aplicar(reales, `${desc} · ${[...listas].map((l) => lista(l)?.nombre).join(", ")}`);
    if (r.ok) {
      toast.success(`Precios actualizados en ${r.data} productos`, { description: desc });
      onOpenChange(false);
    } else toast.error(r.error);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="xl"
        title="Actualizar precios"
        description="Aplicá aumentos por inflación o recalculá desde el costo. Revisá la vista previa antes de confirmar."
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button disabled={!reales.length} onClick={confirmar}>
              <TrendingUp />
              Aplicar a {nProductos} productos
            </Button>
          </>
        }
      >
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          <div className="space-y-4">
            <FormField label="Alcance">
              <Select
                value={alcance}
                onValueChange={(v) => {
                  setAlcance(v as Alcance);
                  setValorAlcance("");
                  if (v !== "SELECCIONADOS") setIdsFijos(undefined);
                }}
                options={[
                  { value: "TODO", label: "Todo el catálogo" },
                  { value: "RUBRO", label: "Por rubro" },
                  { value: "PROVEEDOR", label: "Por proveedor" },
                  { value: "MARCA", label: "Por marca" },
                  { value: "SELECCIONADOS", label: `Productos seleccionados (${idsFijos?.length ?? seleccionados?.size ?? 0})` },
                ]}
              />
            </FormField>
            {alcance === "RUBRO" && (
              <Select aria-label="Rubro" placeholder="Elegí un rubro" value={valorAlcance} onValueChange={setValorAlcance} options={db.rubros.map((r) => ({ value: r.id, label: r.nombre }))} />
            )}
            {alcance === "PROVEEDOR" && (
              <Select aria-label="Proveedor" placeholder="Elegí un proveedor" value={valorAlcance} onValueChange={setValorAlcance} options={db.proveedores.map((p) => ({ value: p.id, label: p.razonSocial }))} />
            )}
            {alcance === "MARCA" && <Select aria-label="Marca" placeholder="Elegí una marca" value={valorAlcance} onValueChange={setValorAlcance} options={marcas.map((m) => ({ value: m, label: m }))} />}

            <FormField label="Listas afectadas">
              <div className="space-y-2 rounded-control border border-border p-3">
                {db.listasPrecios.map((l) => (
                  <label key={l.id} className="flex cursor-pointer items-center gap-2 text-[13px]">
                    <Checkbox
                      checked={listas.has(l.id)}
                      onCheckedChange={(v) => {
                        const n = new Set(listas);
                        if (v) n.add(l.id);
                        else n.delete(l.id);
                        setListas(n);
                      }}
                    />
                    {l.nombre}
                    <span className="ml-auto text-[11px] text-muted">markup {l.markupPorDefecto} %</span>
                  </label>
                ))}
              </div>
            </FormField>

            <FormField label="Modo">
              <Select
                value={modo}
                onValueChange={(v) => setModo(v as typeof modo)}
                options={[
                  { value: "AUMENTAR", label: "Aumentar %" },
                  { value: "DISMINUIR", label: "Disminuir %" },
                  { value: "MARKUP", label: "Recalcular desde costo + markup de la lista" },
                ]}
              />
            </FormField>
            {modo !== "MARKUP" && (
              <FormField label="Porcentaje">
                <div className="flex items-center gap-2">
                  <NumberInput aria-label="Porcentaje" value={pct} min={0} onValueChange={setPct} className="w-28" />
                  <span className="text-muted">%</span>
                </div>
              </FormField>
            )}
            <FormField label="Redondeo">
              <Segmented
                value={String(redondeo) as "1" | "10" | "100"}
                onChange={(v) => setRedondeo(Number(v) as Redondeo)}
                options={[
                  { value: "1", label: "a $ 1" },
                  { value: "10", label: "a $ 10" },
                  { value: "100", label: "a $ 100" },
                ]}
              />
            </FormField>
          </div>

          <div className="min-w-0">
            <div className="mb-2 flex items-baseline justify-between">
              <h4 className="text-[14px] font-semibold">Vista previa · {nProductos} productos afectados</h4>
              <span className="text-[12px] text-muted">{reales.length} precios cambian</span>
            </div>
            <div className="max-h-[420px] overflow-auto rounded-card border border-border">
              <table className="w-full text-table">
                <thead className="sticky top-0 bg-[#FAFAF8]">
                  <tr className="text-[12px] text-muted">
                    <th className="h-9 px-3 text-left font-medium">Producto</th>
                    <th className="h-9 px-3 text-left font-medium">Lista</th>
                    <th className="h-9 px-3 text-right font-medium">Actual → Nuevo</th>
                    <th className="h-9 px-3 text-right font-medium">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {reales.slice(0, 300).map((c) => {
                    const d = c.anterior ? (c.nuevo - c.anterior) / c.anterior : 0;
                    return (
                      <tr key={`${c.productoId}-${c.listaPreciosId}`} className="h-9 border-t border-border">
                        <td className="max-w-0 truncate px-3">
                          <span className="mr-2 font-mono text-[11px] text-muted">{prod(c.productoId)?.codigo}</span>
                          {prod(c.productoId)?.nombre}
                        </td>
                        <td className="px-3 text-muted">{lista(c.listaPreciosId)?.nombre}</td>
                        <td className="whitespace-nowrap px-3 text-right tnum">
                          <span className="text-muted">{formatMoney(c.anterior)}</span>
                          <ArrowRight className="mx-1 inline size-3 text-disabled" />
                          <span className="font-medium">{formatMoney(c.nuevo)}</span>
                        </td>
                        <td className={cn("px-3 text-right tnum", d > 0 ? "text-success" : d < 0 ? "text-danger" : "text-muted")}>{formatPercent(d, { signo: true })}</td>
                      </tr>
                    );
                  })}
                  {!reales.length && (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-[13px] text-muted">
                        {productoIds.length ? "Con estos parámetros no cambia ningún precio." : "Elegí el alcance para ver qué productos se actualizan."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {reales.length > 300 && <p className="mt-1 text-[12px] text-muted">Se muestran los primeros 300 cambios.</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
