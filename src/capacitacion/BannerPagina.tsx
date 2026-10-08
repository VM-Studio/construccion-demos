"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, X } from "lucide-react";
import { useStore } from "@/store";
import { useModoCapacitacion } from "./flag";
import { LINKS_MODULOS, TEXTOS, paginaDe } from "./impactos";

/** Convierte los nombres de módulos del texto en links. */
function conLinks(texto: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let resto = texto;
  let k = 0;
  while (resto) {
    let mejor: { i: number; l: (typeof LINKS_MODULOS)[number] } | null = null;
    for (const l of LINKS_MODULOS) {
      const i = resto.toLowerCase().indexOf(l.texto);
      if (i >= 0 && (!mejor || i < mejor.i || (i === mejor.i && l.texto.length > mejor.l.texto.length))) mejor = { i, l };
    }
    if (!mejor) {
      out.push(resto);
      break;
    }
    if (mejor.i > 0) out.push(resto.slice(0, mejor.i));
    const t = resto.slice(mejor.i, mejor.i + mejor.l.texto.length);
    out.push(<Link key={k++} href={mejor.l.href} className="font-medium text-ink underline decoration-accent/40 underline-offset-2 hover:decoration-accent">{t}</Link>);
    resto = resto.slice(mejor.i + mejor.l.texto.length);
  }
  return out;
}

/** "Esta pantalla se alimenta de … y alimenta a …" debajo del título. Se cierra por página. */
export function BannerPagina({ ruta }: { ruta?: string }) {
  const activo = useModoCapacitacion();
  const pathname = usePathname();
  const r = (ruta ?? pathname ?? "").split("?")[0];
  const cerrado = useStore((s) => !!s.capacitacion.bannersCerrados[r]);
  const cerrar = useStore((s) => s.cerrarBannerPagina);
  const p = paginaDe(r);
  if (!activo || !p || cerrado) return null;
  const t = TEXTOS.bannerAlimenta(p.seAlimentaDe, p.alimentaA);
  return (
    <p className="no-print mt-2 flex items-start gap-1.5 rounded-control bg-accent-soft px-2.5 py-1.5 text-[12.5px] leading-snug text-muted" data-capacitacion="banner">
      <GraduationCap className="mt-px size-3.5 shrink-0 text-accent" />
      <span className="flex-1">
        {t.antes}
        {conLinks(t.de)}
        {t.medio}
        {conLinks(t.a)}.
      </span>
      <button onClick={() => cerrar(r)} aria-label="Cerrar explicación de la pantalla" className="rounded p-0.5 text-disabled hover:text-ink">
        <X className="size-3.5" />
      </button>
    </p>
  );
}
