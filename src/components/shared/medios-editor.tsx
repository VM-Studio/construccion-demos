"use client";
/**
 * Medios de pago de un cobro o pago: efectivo en pesos o en dólares (con el tipo de cambio del día
 * cargado a mano → pesos), caja chica donde entra el efectivo, transferencia, Mercado Pago, cheques
 * y comisión retenida. El importe de cada medio siempre está en pesos.
 */
import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { MedioCobro, MedioPago } from "@/domain/types";
import { MEDIO_PAGO_LABEL, opciones } from "@/domain/estados";
import { cajaPorDefecto } from "@/domain/caja";
import { useDb } from "@/store/selectors";
import { Button } from "@/components/ui/button";
import { Input, NumberInput } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Segmented } from "@/components/ui/tabs";
import { formatMoney } from "@/lib/format";
import { diaLocal } from "@/lib/periodos";
import { newId } from "@/lib/utils";

export type FilaMedio = MedioCobro & { _id: string };

const r2 = (n: number) => Math.round(n * 100) / 100;
const deInput = (v: string) => {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d, 12).toISOString();
};

export function nuevoMedio(medio: MedioPago = "EFECTIVO", importe = 0): FilaMedio {
  return { _id: newId("m"), medio, importe: r2(importe) };
}

/** Pesos de un medio (dólares × tipo de cambio). */
export function pesosDe(m: MedioCobro): number {
  return m.medio === "EFECTIVO" && m.moneda === "USD" ? r2((m.importeME ?? 0) * (m.tipoCambio ?? 0)) : m.importe || 0;
}

/** Medios listos para mandar al servidor (sin la clave interna, con el importe en pesos). */
export function mediosParaEnviar(ms: FilaMedio[]): MedioCobro[] {
  return ms
    .map(({ _id, ...m }) => {
      void _id;
      return { ...m, importe: pesosDe(m) };
    })
    .filter((m) => m.importe > 0);
}

export function MediosEditor({ medios, onChange, sucursalId, sinComision = true, permitirCheques = true }: { medios: FilaMedio[]; onChange: (m: FilaMedio[]) => void; sucursalId?: string; sinComision?: boolean; permitirCheques?: boolean }) {
  const db = useDb();
  const cajas = db.cajas.filter((c) => c.activa).sort((a, b) => a.orden - b.orden);
  const cajaDef = cajaPorDefecto(db.cajas, sucursalId);
  const up = (id: string, patch: Partial<FilaMedio>) => onChange(medios.map((m) => (m._id === id ? { ...m, ...patch } : m)));
  const opts = opciones(MEDIO_PAGO_LABEL).filter((o) => (!sinComision || o.value !== "COMISION") && (permitirCheques || (o.value !== "CHEQUE" && o.value !== "ECHEQ")));
  return (
    <div className="space-y-2">
      {medios.map((m) => {
        const esCheque = m.medio === "CHEQUE" || m.medio === "ECHEQ";
        const usd = m.medio === "EFECTIVO" && m.moneda === "USD";
        return (
          <div key={m._id} className="space-y-2 rounded-control border border-border p-2">
            <div className="grid gap-2 sm:grid-cols-[150px_1fr_auto]">
              <Select size="sm" aria-label="Medio" value={m.medio} onValueChange={(v) => up(m._id, { medio: v as MedioPago, moneda: undefined, importeME: undefined, tipoCambio: undefined, cajaId: v === "EFECTIVO" ? (m.cajaId ?? cajaDef?.id) : undefined })} options={opts} />
              <div className="flex flex-wrap items-center gap-2">
                {m.medio === "EFECTIVO" && (
                  <Segmented value={usd ? "USD" : "ARS"} onChange={(v) => up(m._id, v === "USD" ? { moneda: "USD", importeME: m.importeME ?? 0, tipoCambio: m.tipoCambio ?? 0 } : { moneda: undefined, importeME: undefined, tipoCambio: undefined })} options={[{ value: "ARS", label: "Pesos" }, { value: "USD", label: "Dólares" }]} />
                )}
                {usd ? (
                  <>
                    <label className="flex items-center gap-1 text-[12px] text-muted">US$<NumberInput aria-label="Dólares recibidos" value={m.importeME ?? 0} min={0} className="h-8 w-24" onValueChange={(v) => up(m._id, { importeME: v })} /></label>
                    <label className="flex items-center gap-1 text-[12px] text-muted">× cambio $<NumberInput aria-label="Tipo de cambio del día" value={m.tipoCambio ?? 0} min={0} className="h-8 w-24" onValueChange={(v) => up(m._id, { tipoCambio: v })} /></label>
                    <span className="text-[13px] font-medium tnum">= {formatMoney(pesosDe(m))}</span>
                  </>
                ) : (
                  <NumberInput aria-label="Importe" value={m.importe} min={0} className="h-8 w-36" onValueChange={(v) => up(m._id, { importe: v })} />
                )}
                {m.medio === "EFECTIVO" && cajas.length > 1 && (
                  <div className="w-[150px]"><Select size="sm" aria-label="Caja" value={m.cajaId ?? cajaDef?.id ?? ""} onValueChange={(v) => up(m._id, { cajaId: v })} options={cajas.map((c) => ({ value: c.id, label: c.nombre }))} /></div>
                )}
              </div>
              <Button size="icon-sm" variant="ghost" aria-label="Quitar medio" disabled={medios.length === 1} onClick={() => onChange(medios.filter((x) => x._id !== m._id))}>
                <Trash2 className="text-muted" />
              </Button>
            </div>
            {esCheque ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <Input className="h-8 text-[13px]" aria-label="Banco" placeholder="Banco" value={m.banco ?? ""} onChange={(e) => up(m._id, { banco: e.target.value })} />
                <Input className="h-8 text-[13px]" aria-label="Número de cheque" placeholder="Número" value={m.numeroCheque ?? ""} onChange={(e) => up(m._id, { numeroCheque: e.target.value })} />
                <Input className="h-8 text-[13px]" aria-label="Fecha de cobro" type="date" value={m.fechaCobro ? diaLocal(m.fechaCobro) : ""} onChange={(e) => up(m._id, { fechaCobro: e.target.value ? deInput(e.target.value) : undefined })} />
              </div>
            ) : m.medio !== "EFECTIVO" ? (
              <Input className="h-8 text-[13px]" aria-label="Referencia" placeholder={m.medio === "TRANSFERENCIA" ? "Banco / número de operación (opcional)" : m.medio === "TARJETA" ? "Tarjeta y cupón (opcional)" : "Referencia (opcional)"} value={m.referencia ?? ""} onChange={(e) => up(m._id, { referencia: e.target.value })} />
            ) : null}
          </div>
        );
      })}
      <Button size="sm" variant="ghost" onClick={() => onChange([...medios, { ...nuevoMedio("TRANSFERENCIA"), cajaId: undefined }])}>
        <Plus /> Agregar otro medio
      </Button>
    </div>
  );
}
