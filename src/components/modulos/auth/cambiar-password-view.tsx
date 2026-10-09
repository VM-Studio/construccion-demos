"use client";
import * as React from "react";
import { cambiarPasswordTemporal, salir } from "@/server/actions/sesion";
import { validarPassword } from "@/domain/usuarios";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { MarcoAcceso } from "./marco";
import { CampoPassword } from "./campo-password";

/** Cambio obligatorio de la contraseña temporal: no se puede usar nada hasta cambiarla. */
export function CambiarPasswordView({ empresa, email }: { empresa: string; email: string }) {
  const [f, setF] = React.useState({ nueva: "", repetir: "" });
  const [error, setError] = React.useState<string | null>(null);
  const [enviando, setEnviando] = React.useState(false);
  const err = f.nueva ? validarPassword(f.nueva, email) : null;
  const noCoinciden = !!f.repetir && f.repetir !== f.nueva;
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const r = await cambiarPasswordTemporal(f.nueva);
    if (!r.ok) {
      setEnviando(false);
      return setError(r.error);
    }
    window.location.href = "/inicio";
  };
  return (
    <MarcoAcceso empresa={empresa} subtitulo="Cambiá tu contraseña temporal">
      <form onSubmit={enviar} className="space-y-4">
        <p className="text-[13px] text-muted">Por seguridad, antes de empezar elegí una contraseña propia. Mínimo 10 caracteres, distinta de la temporal y sin tu email.</p>
        <FormField label="Contraseña nueva" required htmlFor="cp-n" error={f.nueva.length >= 10 && err ? err : undefined}><CampoPassword id="cp-n" autoFocus autoComplete="new-password" conFortaleza value={f.nueva} onChange={(v) => setF({ ...f, nueva: v })} /></FormField>
        <FormField label="Repetir contraseña" required htmlFor="cp-r" error={noCoinciden ? "Las contraseñas no coinciden." : undefined}><CampoPassword id="cp-r" autoComplete="new-password" value={f.repetir} onChange={(v) => setF({ ...f, repetir: v })} /></FormField>
        {error && <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</p>}
        <Button type="submit" className="w-full" loading={enviando} disabled={!!err || !f.repetir || noCoinciden}>Guardar y entrar</Button>
        <button type="button" onClick={() => void salir().then(() => (window.location.href = "/login"))} className="block w-full text-center text-[12px] text-muted hover:text-ink">Salir</button>
      </form>
    </MarcoAcceso>
  );
}
