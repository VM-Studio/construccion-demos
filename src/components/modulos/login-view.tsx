"use client";
import * as React from "react";
import { toast } from "sonner";
import { ingresar } from "@/server/actions/sesion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Checkbox } from "@/components/ui/checkbox";
import { MarcoAcceso } from "./auth/marco";
import { CampoPassword } from "./auth/campo-password";

const MOTIVOS: Record<string, string> = {
  desactivado: "Tu usuario fue desactivado. Si es un error, pedile a un dueño que lo reactive.",
  sesion: "Tu sesión se cerró. Volvé a ingresar.",
};

/** Ingreso con email y contraseña. */
export function LoginView({ empresa, volver, motivo }: { empresa: string; volver?: string; motivo?: string }) {

  const [f, setF] = React.useState({ email: "", password: "", recordar: false });
  const [error, setError] = React.useState<string | null>(motivo ? (MOTIVOS[motivo] ?? null) : null);
  const [enviando, setEnviando] = React.useState(false);
  const [olvido, setOlvido] = React.useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const r = await ingresar(f);
    if (!r.ok) {
      setEnviando(false);
      setError(r.error);
      return;
    }
    toast.success("Bienvenido");
    // Navegación completa: el layout del servidor arma los datos con la sesión nueva.
    window.location.href = volver && volver.startsWith("/") && !volver.startsWith("//") ? volver : "/inicio";
  };

  return (
    <MarcoAcceso empresa={empresa}>
      <form onSubmit={enviar} className="space-y-4">
        <FormField label="Email" htmlFor="li-e"><Input id="li-e" type="email" autoComplete="username" autoFocus value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></FormField>
        <FormField label="Contraseña" htmlFor="li-p"><CampoPassword id="li-p" autoComplete="current-password" value={f.password} onChange={(v) => setF({ ...f, password: v })} /></FormField>
        <label className="flex items-center gap-2 text-[13px] text-ink"><Checkbox checked={f.recordar} onCheckedChange={(v) => setF({ ...f, recordar: v === true })} /> Mantener sesión iniciada</label>
        {error && <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</p>}
        <Button type="submit" className="w-full" loading={enviando} disabled={!f.email || !f.password}>Ingresar</Button>
        <div className="text-center">
          <button type="button" onClick={() => setOlvido(!olvido)} className="text-[12px] text-muted underline-offset-4 hover:text-ink hover:underline">Olvidé mi contraseña</button>
          {olvido && <p className="mt-2 text-[12px] text-muted">Pedile a otro dueño que te la restablezca desde Configuración → Usuarios.</p>}
        </div>
      </form>
    </MarcoAcceso>
  );
}
