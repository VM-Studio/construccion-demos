"use client";
import * as React from "react";
import { X } from "lucide-react";
import { BRAND } from "@/config/brand";

const KEY = "cd-banner-cerrado";

/** Banner fino de entorno de demostración (se cierra por sesión). */
export function DemoBanner() {
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    try {
      setVisible(BRAND.esDemo && sessionStorage.getItem(KEY) !== "1");
    } catch {
      setVisible(BRAND.esDemo);
    }
  }, []);
  if (!visible) return null;
  return (
    <div className="no-print relative z-30 flex h-7 items-center justify-center bg-ink px-8 text-[12px] text-white">
      <span className="truncate">Entorno de demostración · Los datos viven en este navegador y se pueden vaciar en cualquier momento</span>
      <button
        aria-label="Cerrar aviso de demostración"
        className="absolute right-2 rounded p-0.5 text-white/70 hover:text-white"
        onClick={() => {
          setVisible(false);
          try {
            sessionStorage.setItem(KEY, "1");
          } catch {}
        }}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
