"use client";
import { useEmpresa } from "@/store/selectors";
import { BRAND } from "@/config/brand";
import { LogoEmpresa } from "@/components/shared/logo-empresa";

/** Pantalla de carga inicial: fondo tinta, logo (en blanco) y barra de progreso. */
export function PantallaCarga() {
  const e = useEmpresa();
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-ink" role="status" aria-label="Cargando">
      <LogoEmpresa nombre={e.empresa || BRAND.empresa} alto={120} className="invert" />
      <div className="mt-3 text-[12px] text-white/60">{BRAND.sistema}</div>
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/10">
        <div className="h-full bg-white animate-progress" />
      </div>
    </div>
  );
}
