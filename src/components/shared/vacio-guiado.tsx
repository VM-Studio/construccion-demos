"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, type LucideIcon } from "lucide-react";
import { useDb } from "@/store/selectors";
import { enumerarFaltantes, faltantes } from "@/domain/prerequisitos";
import { VACIOS, type PaginaVacia, type TextoVacio } from "@/config/vacios";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./empty-state";

/**
 * Estado vacío que enseña: qué es la pantalla, la primera acción y, si depende de algo
 * que todavía no existe, qué falta y dónde se carga.
 */
export function VacioGuiado({
  pagina,
  icono,
  onAccion,
  puedeAccion = true,
  extra,
  className,
}: {
  pagina: PaginaVacia;
  icono?: LucideIcon;
  /** Para acciones que abren un dialog en la misma pantalla (si no, se usa el href). */
  onAccion?: () => void;
  /** false si el usuario no tiene permiso para la acción principal. */
  puedeAccion?: boolean;
  /** Botones adicionales (p. ej. "Importar desde CSV"). */
  extra?: React.ReactNode;
  className?: string;
}) {
  const db = useDb();
  const router = useRouter();
  const t: TextoVacio = VACIOS[pagina];
  const falta = faltantes(t.requiere ?? [], db);
  const descripcion = falta.length ? `${t.texto} ${t.siFalta ?? `Para empezar necesitás ${enumerarFaltantes(falta)}.`}` : t.texto;

  let acciones: React.ReactNode = null;
  if (falta.length)
    acciones = falta.map((f) => (
      <Button key={f.clave} size="sm" variant="secondary" onClick={() => router.push(f.href)}>
        {f.accion} <ArrowRight />
      </Button>
    ));
  else if (t.accion && puedeAccion)
    acciones = onAccion ? (
      <Button size="sm" onClick={onAccion}><Plus /> {t.accion.label}</Button>
    ) : t.accion.href ? (
      <Button size="sm" onClick={() => router.push(t.accion!.href!)}>
        <Plus /> {t.accion.label}
      </Button>
    ) : null;

  return (
    <EmptyState
      icono={icono}
      titulo={t.titulo}
      descripcion={descripcion}
      className={className}
      accion={acciones || extra ? <div className="flex flex-wrap justify-center gap-2">{acciones}{!falta.length && extra}</div> : undefined}
    />
  );
}
