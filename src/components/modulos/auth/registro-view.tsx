"use client";
import * as React from "react";
import { registrarPrimerDueno } from "@/server/actions/sesion";
import { validarPassword } from "@/domain/usuarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { MarcoAcceso } from "./marco";
import { CampoPassword } from "./campo-password";

/** Primer ingreso: la primera persona crea la cuenta de dueño. */
export function RegistroView({ empresa }: { empresa: string }) {
  const [f, setF] = React.useState({ nombre: "", apellido: "", email: "", password: "", repetir: "" });
  const [error, setError] = React.useState<string | null>(null);
  const [enviando, setEnviando] = React.useState(false);
  const errPass = f.password ? validarPassword(f.password, f.email || "x@x") : null;
  const noCoinciden = !!f.repetir && f.repetir !== f.password;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (errPass || noCoinciden) return;
    setEnviando(true);
    setError(null);
    const r = await registrarPrimerDueno({ nombre: f.nombre, apellido: f.apellido, email: f.email, password: f.password });
    if (!r.ok) {
      setEnviando(false);
      return setError(r.error);
    }
    window.location.href = "/inicio";
  };

  return (
    <MarcoAcceso empresa={empresa}>
      <form onSubmit={enviar} className="space-y-4">
        <div>
          <p className="text-[14px] font-medium text-ink">Bienvenido a {empresa}.</p>
          <p className="text-[13px] text-muted">Creá la primera cuenta de dueño.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Nombre" required htmlFor="rg-n"><Input id="rg-n" autoFocus autoComplete="given-name" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></FormField>
          <FormField label="Apellido" htmlFor="rg-a"><Input id="rg-a" autoComplete="family-name" value={f.apellido} onChange={(e) => setF({ ...f, apellido: e.target.value })} /></FormField>
        </div>
        <FormField label="Email" required htmlFor="rg-e"><Input id="rg-e" type="email" autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></FormField>
        <FormField label="Contraseña" required htmlFor="rg-p" error={f.password && errPass && f.password.length >= 10 ? errPass : undefined}><CampoPassword id="rg-p" autoComplete="new-password" conFortaleza value={f.password} onChange={(v) => setF({ ...f, password: v })} /></FormField>
        <FormField label="Repetir contraseña" required htmlFor="rg-r" error={noCoinciden ? "Las contraseñas no coinciden." : undefined}><CampoPassword id="rg-r" autoComplete="new-password" value={f.repetir} onChange={(v) => setF({ ...f, repetir: v })} /></FormField>
        {error && <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</p>}
        <Button type="submit" className="w-full" loading={enviando} disabled={!f.nombre.trim() || !f.email.trim() || !!errPass || !f.repetir || noCoinciden}>Crear cuenta de dueño</Button>
      </form>
    </MarcoAcceso>
  );
}
