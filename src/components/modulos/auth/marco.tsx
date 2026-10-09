import * as React from "react";
import { BRAND } from "@/config/brand";

/** Marco común de las pantallas de acceso (login, registro, cambio de contraseña). */
export function MarcoAcceso({ empresa, subtitulo, children }: { empresa: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-app px-4 py-10">
      <div className="w-full max-w-[420px] rounded-card border border-border bg-surface">
        <div className="border-b border-border px-6 py-5 text-center">
          <h1 className="text-title font-semibold tracking-tight">{empresa}</h1>
          <p className="text-[13px] text-muted">{subtitulo ?? BRAND.sistema}</p>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
      <p className="mt-6 text-[12px] text-muted">Desarrollado por {BRAND.agencia}</p>
    </main>
  );
}
