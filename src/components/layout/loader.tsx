"use client";
import { useEmpresa } from "@/store/selectors";
import { BRAND } from "@/config/brand";

/** Pantalla de carga inicial: fondo tinta, nombre de la empresa y barra de progreso. */
export function PantallaCarga() {
  const e = useEmpresa();
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-ink" role="status" aria-label="Cargando">
      <div className="text-[22px] font-semibold tracking-tight text-white">{e.empresa || BRAND.empresa}</div>
      <div className="mt-1 text-[12px] text-white/60">{BRAND.sistema}</div>
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/10">
        <div className="h-full bg-white animate-progress" />
      </div>
    </div>
  );
}
