"use client";
import * as React from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { useUsuario } from "@/store/selectors";
import { validarPassword } from "@/domain/usuarios";
import { aplicarResultadoPropio } from "@/lib/datos/proveedor";
import { actualizarMiCuenta, cambiarMiPassword } from "@/server/actions/sesion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CampoPassword } from "./campo-password";

/** Mi cuenta: nombre y cambio de contraseña (pide la actual). */
export function MiCuentaDialog({ onClose }: { onClose: () => void }) {
  const u = useUsuario();
  const [d, setD] = React.useState({ nombre: u?.nombre ?? "", apellido: u?.apellido ?? "" });
  const [p, setP] = React.useState({ actual: "", nueva: "", repetir: "" });
  const [enviando, setEnviando] = React.useState<"datos" | "pass" | null>(null);
  if (!u) return null;
  const errNueva = p.nueva ? validarPassword(p.nueva, u.email) : null;
  const noCoinciden = !!p.repetir && p.repetir !== p.nueva;

  const guardarDatos = async () => {
    setEnviando("datos");
    const r = await actualizarMiCuenta(d);
    setEnviando(null);
    if (!r.ok) return toast.error(r.error);
    void aplicarResultadoPropio(["Usuario"]);
    toast.success("Datos guardados");
  };
  const guardarPass = async () => {
    setEnviando("pass");
    const r = await cambiarMiPassword({ actual: p.actual, nueva: p.nueva });
    setEnviando(null);
    if (!r.ok) return toast.error(r.error);
    setP({ actual: "", nueva: "", repetir: "" });
    toast.success("Contraseña cambiada");
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="Mi cuenta" description={u.email} footer={<Button variant="secondary" onClick={onClose}>Cerrar</Button>}>
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Nombre" required htmlFor="mc-n"><Input id="mc-n" value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} /></FormField>
              <FormField label="Apellido" htmlFor="mc-a"><Input id="mc-a" value={d.apellido} onChange={(e) => setD({ ...d, apellido: e.target.value })} /></FormField>
            </div>
            <div className="flex justify-end"><Button size="sm" variant="secondary" loading={enviando === "datos"} disabled={d.nombre.trim().length < 2} onClick={guardarDatos}><Save /> Guardar datos</Button></div>
          </section>
          <section className="space-y-3 border-t border-border pt-4">
            <h3 className="text-[13px] font-medium">Cambiar contraseña</h3>
            <FormField label="Contraseña actual" htmlFor="mc-pa"><CampoPassword id="mc-pa" autoComplete="current-password" value={p.actual} onChange={(v) => setP({ ...p, actual: v })} /></FormField>
            <FormField label="Contraseña nueva" htmlFor="mc-pn" error={p.nueva.length >= 10 && errNueva ? errNueva : undefined}><CampoPassword id="mc-pn" autoComplete="new-password" conFortaleza value={p.nueva} onChange={(v) => setP({ ...p, nueva: v })} /></FormField>
            <FormField label="Repetir contraseña nueva" htmlFor="mc-pr" error={noCoinciden ? "Las contraseñas no coinciden." : undefined}><CampoPassword id="mc-pr" autoComplete="new-password" value={p.repetir} onChange={(v) => setP({ ...p, repetir: v })} /></FormField>
            <div className="flex justify-end"><Button size="sm" loading={enviando === "pass"} disabled={!p.actual || !!errNueva || !p.repetir || noCoinciden} onClick={guardarPass}>Cambiar contraseña</Button></div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
