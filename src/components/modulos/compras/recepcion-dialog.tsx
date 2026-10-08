"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle, PackageCheck, TrendingUp } from "lucide-react";
import { useStore } from "@/store";
import { guardarAdjunto } from "@/lib/adjuntos";
import { useDb, usePuede } from "@/store/selectors";
import type { AvisoSubaCosto } from "@/store/slices/compras";
import type { DiferenciaRecepcion } from "@/domain/types";
import { DIFERENCIA_LABEL, opciones } from "@/domain/estados";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, NumberInput } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { ActualizacionMasivaDialog } from "@/components/modulos/productos/actualizacion-masiva";
import { formatMoney, formatPercent, formatQty, unidadCorta } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Impacto, medir } from "@/capacitacion";

interface Linea {
  itemOCId: string;
  productoId: string;
  pedido: number;
  recibido: number;
  pendiente: number;
  cantidad: number;
  costo: number;
  diferencia: DiferenciaRecepcion;
}

function hoyInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Registro de ingreso de mercadería contra una OC. Actualiza stock, costo último y
 * promedio; si el costo sube más del umbral, ofrece actualizar precios en el momento.
 */
export function RecepcionDialog({ ordenCompraId, open, onOpenChange, onDone }: { ordenCompraId: string | null; open: boolean; onOpenChange: (v: boolean) => void; onDone?: (recepcionId: string) => void }) {
  const db = useDb();
  const recibir = useStore((s) => s.recibirMercaderia);
  const verCostos = usePuede("margenes.ver");
  const oc = ordenCompraId ? db.ordenesCompra.find((o) => o.id === ordenCompraId) : undefined;
  const [remito, setRemito] = React.useState("");
  const [factura, setFactura] = React.useState("");
  const [archivos, setArchivos] = React.useState<File[]>([]);
  const [fecha, setFecha] = React.useState(hoyInput());
  const [deposito, setDeposito] = React.useState("");
  const [obs, setObs] = React.useState("");
  const [lineas, setLineas] = React.useState<Linea[]>([]);
  const [avisos, setAvisos] = React.useState<AvisoSubaCosto[] | null>(null);
  const [masiva, setMasiva] = React.useState(false);

  React.useEffect(() => {
    if (!open || !oc) return;
    setRemito("");
    setFactura("");
    setArchivos([]);
    setFecha(hoyInput());
    setDeposito(oc.depositoDestinoId);
    setObs("");
    setLineas(
      oc.items
        .map((i) => {
          const pendiente = Math.max(0, i.cantidadPedida - i.cantidadRecibida);
          return {
            itemOCId: i.id,
            productoId: i.productoId,
            pedido: i.cantidadPedida,
            recibido: i.cantidadRecibida,
            pendiente,
            cantidad: pendiente,
            costo: Math.round(i.costoUnitario * (1 - i.descuentoPct / 100) * 100) / 100,
            diferencia: "OK" as DiferenciaRecepcion,
          };
        })
        .filter((l) => l.pendiente > 0),
    );
  }, [open, oc]);

  const inicialMasiva = React.useMemo(
    () => (avisos ? { alcance: "SELECCIONADOS" as const, productoIds: avisos.map((a) => a.productoId), modo: "MARKUP" as const } : undefined),
    [avisos],
  );

  if (!oc) return null;
  const prov = db.proveedores.find((p) => p.id === oc.proveedorId);
  const prod = (id: string) => db.productos.find((p) => p.id === id);
  const up = (id: string, patch: Partial<Linea>) => setLineas((ls) => ls.map((l) => (l.itemOCId === id ? { ...l, ...patch } : l)));
  const todo = lineas.every((l) => l.cantidad === l.pendiente);
  const neto = lineas.reduce((a, l) => a + l.cantidad * l.costo, 0);
  const umbral = (db.config.umbralSubaCostoPct ?? 3) / 100;

  const accionId = oc.origen === "ACOPIO" ? "registrarRecepcionDeAcopio" : "registrarRecepcion";

  const confirmar = async () => {
    const [y, m, d] = fecha.split("-").map(Number);
    const ahora = new Date();
    const f = new Date(y, m - 1, d, ahora.getHours(), ahora.getMinutes()).toISOString();
    const r = await medir(accionId, { proveedorId: oc.proveedorId, productoIds: lineas.map((l) => l.productoId), depositoIds: [deposito], acopioProveedorId: oc.acopioProveedorId }, () => recibir({
      ordenCompraId: oc.id,
      remitoProveedor: remito,
      facturaProveedor: factura || undefined,
      fecha: f,
      depositoId: deposito,
      observaciones: obs || undefined,
      items: lineas.map((l) => ({ itemOCId: l.itemOCId, cantidad: l.cantidad, costoUnitario: l.costo, diferencia: l.diferencia })),
    }));
    if (!r.ok) return toast.error(r.error);
    toast.success(`Recepción ${r.data.numero} registrada`, { description: r.data.completa ? "La orden quedó recibida completa." : "La orden quedó recibida parcial." });
    for (const a of archivos) {
      void guardarAdjunto(a, { entidadTipo: "RECEPCION", entidadId: r.data.recepcionId, categoria: "FACTURA_PROVEEDOR" }).then((x) => !x.ok && toast.error(x.error));
    }
    onDone?.(r.data.recepcionId);
    onOpenChange(false);
    if (r.data.avisos.length && verCostos) setAvisos(r.data.avisos);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          size="xl"
          title={`Registrar recepción · ${oc.numero}`}
          description={`${prov?.razonSocial} · ingresa al ${db.depositos.find((x) => x.id === deposito)?.nombre ?? ""}`}
          footer={
            <>
              <span className="mr-auto text-[13px] text-muted">
                Ingresa <b className="text-ink tnum">{lineas.filter((l) => l.cantidad > 0).length}</b> productos{verCostos && <> · neto <b className="text-ink tnum">{formatMoney(neto)}</b></>}
              </span>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={confirmar} disabled={!remito.trim() || !lineas.some((l) => l.cantidad > 0)}>
                <PackageCheck /> Confirmar ingreso
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Remito del proveedor" required htmlFor="rec-remito" hint="Número del remito que trae el camión">
                <Input id="rec-remito" autoFocus value={remito} onChange={(e) => setRemito(e.target.value)} placeholder="R-0001-00012345" />
              </FormField>
              {oc.origen === "ACOPIO" ? (
                <FormField label="Factura del proveedor" hint="Retiro de acopio: no genera deuda nueva">
                  <Input disabled value={db.acopiosProveedor.find((a) => a.id === oc.acopioProveedorId)?.numero ?? "Acopio"} />
                </FormField>
              ) : (
                <FormField label="Factura del proveedor" htmlFor="rec-fac" hint="Opcional: número de la factura recibida">
                  <Input id="rec-fac" value={factura} onChange={(e) => setFactura(e.target.value)} placeholder="FC A 0003-00045123" />
                </FormField>
              )}
              <FormField label="Fecha" htmlFor="rec-fecha">
                <Input id="rec-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </FormField>
              <FormField label="Depósito">
                <Select value={deposito} onValueChange={setDeposito} options={db.depositos.map((x) => ({ value: x.id, label: x.nombre }))} />
              </FormField>
              <FormField label="Adjuntar remito y factura" hint={archivos.length ? archivos.map((a) => a.name).join(", ") : "Foto o PDF del remito/factura del proveedor"} className="sm:col-span-2">
                <Input type="file" multiple accept="image/*,application/pdf" onChange={(e) => setArchivos(Array.from(e.target.files ?? []))} />
              </FormField>
            </div>
            <label className="flex w-fit items-center gap-2 text-[13px]">
              <Checkbox checked={todo} onCheckedChange={(v) => setLineas((ls) => ls.map((l) => ({ ...l, cantidad: v ? l.pendiente : 0 })))} />
              Recibir todo lo pendiente
            </label>
            <div className="overflow-x-auto rounded-card border border-border">
              <table className="w-full min-w-[860px] text-table">
                <thead className="bg-[#FAFAF8]">
                  <tr className="text-[12px] text-muted">
                    <th className="h-9 px-3 text-left font-medium">Producto</th>
                    <th className="h-9 px-3 text-right font-medium">Pedido</th>
                    <th className="h-9 px-3 text-right font-medium">Ya recibido</th>
                    <th className="h-9 px-3 text-right font-medium">Pendiente</th>
                    <th className="h-9 w-[130px] px-3 text-right font-medium">A recibir</th>
                    {verCostos && <th className="h-9 w-[140px] px-3 text-right font-medium">Costo unit.</th>}
                    <th className="h-9 w-[150px] px-3 text-left font-medium">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l) => {
                    const p = prod(l.productoId)!;
                    const suba = p.costoUltimo ? (l.costo - p.costoUltimo) / p.costoUltimo : 0;
                    return (
                      <tr key={l.itemOCId} className="border-t border-border align-top">
                        <td className="px-3 py-2">
                          <div><span className="mr-2 whitespace-nowrap font-mono text-[11px] text-muted">{p.codigo}</span>{p.nombre}</div>
                          {verCostos && suba > umbral && <div className="mt-0.5 text-[11px] text-warning">El costo sube {formatPercent(suba)} respecto del último ({formatMoney(p.costoUltimo)})</div>}
                        </td>
                        <td className="px-3 py-2 pt-3 text-right tnum">{formatQty(l.pedido, p.unidad).split(" ")[0]}</td>
                        <td className="px-3 py-2 pt-3 text-right text-muted tnum">{formatQty(l.recibido, p.unidad).split(" ")[0]}</td>
                        <td className="px-3 py-2 pt-3 text-right font-medium tnum">{formatQty(l.pendiente, p.unidad).split(" ")[0]} <span className="text-[11px] font-normal text-muted">{unidadCorta(p.unidad)}</span></td>
                        <td className="px-3 py-2">
                          <NumberInput aria-label={`Cantidad a recibir de ${p.nombre}`} value={l.cantidad} min={0} className={cn("h-8", l.cantidad > l.pendiente && "border-warning")} onValueChange={(v) => up(l.itemOCId, { cantidad: v, diferencia: v > l.pendiente ? "EXTRA" : v < l.pendiente && l.diferencia === "OK" ? "FALTANTE" : v === l.pendiente ? "OK" : l.diferencia })} />
                        </td>
                        {verCostos && (
                          <td className="px-3 py-2">
                            <NumberInput aria-label={`Costo de ${p.nombre}`} value={l.costo} min={0} className="h-8" onValueChange={(v) => up(l.itemOCId, { costo: v })} />
                          </td>
                        )}
                        <td className="px-3 py-2">
                          <Select size="sm" aria-label="Diferencia" value={l.diferencia} onValueChange={(v) => up(l.itemOCId, { diferencia: v as DiferenciaRecepcion })} options={opciones(DIFERENCIA_LABEL)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <FormField label="Observaciones" htmlFor="rec-obs">
              <Input id="rec-obs" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ej. 2 bolsas rotas, el chofer firmó la diferencia" />
            </FormField>
            <Impacto accion={accionId} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!avisos} onOpenChange={(v) => !v && setAvisos(null)}>
        <DialogContent
          size="lg"
          title="Subieron costos en esta recepción"
          description="La recepción ya actualizó el costo último y el promedio. Revisá si conviene actualizar los precios de venta ahora."
          footer={
            <>
              <Button variant="secondary" onClick={() => setAvisos(null)}>Más tarde</Button>
              <Button
                onClick={() => {
                  setMasiva(true);
                }}
              >
                <TrendingUp /> Actualizar precios ahora
              </Button>
            </>
          }
        >
          <div className="space-y-2">
            {avisos?.map((a) => {
              const p = prod(a.productoId);
              const lista = db.listasPrecios.find((l) => l.id === "lst_may");
              return (
                <div key={a.productoId} className="flex gap-3 rounded-card border border-warning/30 bg-warning-soft p-3 text-[13px]">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                  <p>
                    <b>{p?.nombre}</b>: el costo subió <b className="text-warning">{formatPercent(a.subaPct)}</b> ({formatMoney(a.costoAnterior)} → {formatMoney(a.costoNuevo)}). Los precios de venta de este producto quedaron con markup efectivo de{" "}
                    <b className={cn(a.markupMayorista < (lista?.markupPorDefecto ?? 22) ? "text-danger" : "text-ink")}>{formatPercent(a.markupMayorista, { base100: true })}</b> en lista Mayorista (objetivo {lista?.markupPorDefecto} %). ¿Querés actualizar precios ahora?
                  </p>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
      <ActualizacionMasivaDialog
        open={masiva}
        onOpenChange={(v) => {
          setMasiva(v);
          if (!v) setAvisos(null);
        }}
        inicial={inicialMasiva}
      />
    </>
  );
}
