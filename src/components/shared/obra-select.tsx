"use client";
import * as React from "react";
import { toast } from "sonner";
import { useStore } from "@/store";
import { useDb } from "@/store/selectors";
import { Combobox } from "./combobox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";

/** Alta rápida de obra para un cliente. */
export function NuevaObraDialog({ clienteId, open, onOpenChange, onCreada }: { clienteId: string; open: boolean; onOpenChange: (v: boolean) => void; onCreada?: (id: string) => void }) {
  const [f, setF] = React.useState({ nombre: "", direccion: "", localidad: "" });
  React.useEffect(() => {
    if (open) setF({ nombre: "", direccion: "", localidad: "" });
  }, [open]);
  const guardar = () => {
    const r = useStore.getState().guardarObra({ clienteId, nombre: f.nombre, direccion: f.direccion || undefined, localidad: f.localidad || undefined, activa: true });
    if (!r.ok) return toast.error(r.error);
    toast.success("Obra creada");
    onCreada?.(r.data);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" title="Nueva obra" footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={guardar} disabled={!f.nombre.trim()}>Crear obra</Button></>}>
        <div className="space-y-3">
          <FormField label="Nombre" required htmlFor="ob-n"><Input id="ob-n" autoFocus value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Ej. Canton Golf Lote 377" /></FormField>
          <FormField label="Dirección" htmlFor="ob-d"><Input id="ob-d" value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} /></FormField>
          <FormField label="Localidad" htmlFor="ob-l"><Input id="ob-l" value={f.localidad} onChange={(e) => setF({ ...f, localidad: e.target.value })} /></FormField>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Selector de obra del cliente (opcionalmente restringido a una lista) con alta rápida. */
export function ObraSelect({ clienteId, value, onChange, permitidas, className, placeholder = "Obra…" }: { clienteId: string; value?: string; onChange: (v: string) => void; permitidas?: string[]; className?: string; placeholder?: string }) {
  const db = useDb();
  const [nueva, setNueva] = React.useState(false);
  const obras = db.obras.filter((o) => o.clienteId === clienteId && o.activa && (!permitidas || permitidas.includes(o.id)));
  return (
    <>
      <Combobox
        aria-label="Obra"
        className={className}
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        opciones={obras.map((o) => ({ value: o.id, label: o.nombre, detalle: o.localidad }))}
        accionNuevo={clienteId && !permitidas ? { label: "Nueva obra", onSelect: () => setNueva(true) } : undefined}
        disabled={!clienteId}
      />
      {clienteId && <NuevaObraDialog clienteId={clienteId} open={nueva} onOpenChange={setNueva} onCreada={onChange} />}
    </>
  );
}
