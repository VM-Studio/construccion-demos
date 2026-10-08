"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import type { Rol } from "@/domain/types";
import { ROL_LABEL } from "@/domain/permisos";
import { BRAND } from "@/config/brand";
import { ingresar, crearPrimerDueno } from "@/server/actions/sesion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";

export interface UsuarioIngreso {
  id: string;
  nombre: string;
  rol: Rol;
  avatarIniciales: string;
  sucursal?: string;
}

/**
 * Ingreso — STUB hasta R2 (email y contraseña): se elige el usuario con el que entrar.
 * Si la base todavía no tiene usuarios, se crea el primer dueño.
 */
export function LoginView({ empresa, usuarios }: { empresa: string; usuarios: UsuarioIngreso[] }) {
  const router = useRouter();
  const [enviando, setEnviando] = React.useState<string | null>(null);
  const [f, setF] = React.useState({ nombre: "", email: "" });

  const entrar = async (id: string) => {
    setEnviando(id);
    const r = await ingresar(id);
    if (!r.ok) {
      setEnviando(null);
      return toast.error(r.error);
    }
    router.replace("/inicio");
  };
  const registrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando("nuevo");
    const r = await crearPrimerDueno(f);
    if (!r.ok) {
      setEnviando(null);
      return toast.error(r.error);
    }
    router.replace("/inicio");
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-app px-4 py-10">
      <div className="w-full max-w-[420px] rounded-card border border-border bg-surface">
        <div className="border-b border-border px-6 py-5 text-center">
          <h1 className="text-title font-semibold tracking-tight">{empresa}</h1>
          <p className="text-[13px] text-muted">{BRAND.sistema}</p>
        </div>
        {usuarios.length === 0 ? (
          <form onSubmit={registrar} className="space-y-4 px-6 py-5">
            <p className="text-[13px] text-muted">Bienvenido a {empresa}. Creá la primera cuenta de dueño.</p>
            <FormField label="Nombre y apellido" required htmlFor="pd-n"><Input id="pd-n" autoFocus value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></FormField>
            <FormField label="Email" required htmlFor="pd-e"><Input id="pd-e" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></FormField>
            <Button type="submit" className="w-full" loading={enviando === "nuevo"} disabled={!f.nombre.trim() || !f.email.trim()}>Crear cuenta de dueño</Button>
          </form>
        ) : (
          <div className="px-3 py-4">
            <p className="mb-2 px-3 text-[13px] text-muted">Elegí con qué usuario entrar</p>
            <ul className="flex flex-col">
              {usuarios.map((u) => (
                <li key={u.id}>
                  <button
                    onClick={() => void entrar(u.id)}
                    disabled={!!enviando}
                    className="group flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left transition-colors hover:bg-subtle focus-visible:bg-subtle disabled:opacity-60"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-white">{u.avatarIniciales}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-ink">{u.nombre}</span>
                      <span className="block truncate text-[12px] text-muted">{u.sucursal ? `${ROL_LABEL[u.rol]} · ${u.sucursal}` : ROL_LABEL[u.rol]}</span>
                    </span>
                    <ChevronRight className="size-4 text-disabled transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <p className="mt-6 text-[12px] text-muted">Desarrollado por {BRAND.agencia}</p>
    </main>
  );
}
