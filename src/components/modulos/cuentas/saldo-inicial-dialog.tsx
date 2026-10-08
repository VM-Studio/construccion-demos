"use client";
import * as React from "react";
import { toast } from "sonner";
import { History } from "lucide-react";
import { useStore } from "@/store";
import { useVeCircuito2 } from "@/store/selectors";
import type { Circuito } from "@/domain/types";
import { SelectorCliente, SelectorProveedor } from "@/components/shared/alta-rapida";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, NumberInput } from "@/components/ui/input";
import { Segmented } from "@/components/ui/tabs";
import { FormField } from "@/components/ui/form-field";
import { formatMoney } from "@/lib/format";
import { diaLocal } from "@/lib/periodos";
import { Impacto, ImpactoCampo, medir } from "@/capacitacion";

const aIso = (v: string) => {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d, 12).toISOString();
};

/**
 * Saldo que el cliente o el proveedor ya traía del sistema anterior: queda como un comprobante
 * de saldo inicial (o saldo a favor) en su cuenta corriente y se cobra / paga como cualquier factura.
 */
export function SaldoInicialDialog({ tipo, open, onOpenChange, entidadId }: { tipo: "cliente" | "proveedor"; open: boolean; onOpenChange: (v: boolean) => void; entidadId?: string }) {
  const veC2 = useVeCircuito2();
  const esCliente = tipo === "cliente";
  const hoy = diaLocal(new Date());
  const [id, setId] = React.useState(entidadId ?? "");
  const [importe, setImporte] = React.useState(0);
  const [sentido, setSentido] = React.useState<"DEBE" | "A_FAVOR">("DEBE");
  const [circuito, setCircuito] = React.useState<Circuito>(1);
  const [fecha, setFecha] = React.useState(hoy);
  const [vencimiento, setVencimiento] = React.useState("");
  const [obs, setObs] = React.useState("");

  const circuitoDe = (x: string): Circuito => {
    const db = useStore.getState().db;
    const c = (esCliente ? db.clientes.find((k) => k.id === x) : db.proveedores.find((k) => k.id === x))?.circuitoHabitual ?? 1;
    return c === 2 && !veC2 ? 1 : c;
  };
  React.useEffect(() => {
    if (!open) return;
    setId(entidadId ?? "");
    setImporte(0);
    setSentido("DEBE");
    setCircuito(entidadId ? circuitoDe(entidadId) : 1);
    setFecha(diaLocal(new Date()));
    setVencimiento("");
    setObs("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entidadId]);

  const elegir = (x: string) => {
    setId(x);
    setCircuito(circuitoDe(x));
  };
  const aFavor = sentido === "A_FAVOR";
  const guardar = async () => {
    const r = await medir("cargarSaldoInicial", esCliente ? { clienteId: id } : { proveedorId: id }, () => useStore.getState().cargarSaldoInicial({
      tipo,
      entidadId: id,
      importe,
      fecha: aIso(fecha),
      circuito,
      aFavor,
      vencimiento: !aFavor && vencimiento ? aIso(vencimiento) : undefined,
      observaciones: obs.trim() || undefined,
    }));
    if (!r.ok) return toast.error(r.error);
    toast.success(`Saldo inicial ${r.data.numero} cargado`, { description: `${aFavor ? "A favor" : esCliente ? "Debe" : "Le debemos"} ${formatMoney(importe)}` });
    onOpenChange(false);
  };

  const labelDebe = esCliente ? "Nos debe" : "Le debemos";
  const labelFavor = esCliente ? "Tiene a favor" : "Nos debe (a favor)";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="md"
        title="Cargar saldo inicial"
        description={esCliente ? "Lo que el cliente ya debía (o tenía a favor) antes de empezar a usar el sistema. Queda en su cuenta corriente y se cobra como una factura." : "Lo que ya se le debía al proveedor (o teníamos a favor) antes de empezar a usar el sistema. Queda en su cuenta corriente y se paga con una orden de pago."}
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={guardar} disabled={!id || !(importe > 0) || !fecha}><History /> Cargar saldo</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label={esCliente ? "Cliente" : "Proveedor"} required className="sm:col-span-2">
            {esCliente ? <SelectorCliente value={id} onChange={elegir} /> : <SelectorProveedor value={id} onChange={elegir} />}
          </FormField>
          <FormField label="Importe" required htmlFor="si-imp">
            <NumberInput id="si-imp" value={importe} min={0} onValueChange={setImporte} />
          </FormField>
          <FormField label="Saldo">
            <Segmented value={sentido} onChange={setSentido} options={[{ value: "DEBE", label: labelDebe }, { value: "A_FAVOR", label: labelFavor }]} />
          </FormField>
          <FormField label="Circuito" className="sm:col-span-2" hint={id ? "Por defecto, el circuito habitual de la cuenta" : undefined}>
            <Segmented value={String(circuito) as "1" | "2"} onChange={(v) => setCircuito(Number(v) as Circuito)} options={[{ value: "1", label: "AC1 · Fiscal" }, ...(veC2 ? [{ value: "2" as const, label: "AC2 · Interno" }] : [])]} />
            <ImpactoCampo campo={`circuito.${circuito}`} />
          </FormField>
          <FormField label="Fecha" required htmlFor="si-f">
            <Input id="si-f" type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} />
          </FormField>
          <FormField label="Vencimiento" htmlFor="si-v" hint={aFavor ? "No aplica a un saldo a favor" : "Opcional: si no, vence en la fecha"}>
            <Input id="si-v" type="date" value={aFavor ? "" : vencimiento} disabled={aFavor} min={fecha} onChange={(e) => setVencimiento(e.target.value)} />
          </FormField>
          <FormField label="Observación" htmlFor="si-o" className="sm:col-span-2">
            <Input id="si-o" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Saldo inicial (sistema anterior)" />
          </FormField>
          <Impacto accion="cargarSaldoInicial" className="sm:col-span-2" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
