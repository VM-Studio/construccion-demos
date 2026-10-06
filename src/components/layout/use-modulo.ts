"use client";
import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useStore } from "@/store";
import { useUsuario } from "@/store/selectors";
import { MODULOS, moduloDeRuta, paginaActiva, type Modulo, type PaginaModulo } from "@/config/modulos";
import { puede } from "@/domain/permisos";

/** Módulos visibles para el usuario (con sus páginas filtradas por permiso). */
export function useModulosVisibles(): Modulo[] {
  const usuario = useUsuario();
  return React.useMemo(
    () => MODULOS.map((m) => ({ ...m, paginas: m.paginas.filter((p) => puede(usuario, p.permiso)) })).filter((m) => m.paginas.length > 0),
    [usuario],
  );
}

/** Módulo y página activos según la URL (y el último módulo elegido). */
export function useModuloActual(): { modulo?: Modulo; pagina?: PaginaModulo; pathname: string; search: URLSearchParams } {
  const pathname = usePathname();
  const params = useSearchParams();
  const preferido = useStore((s) => s.ui.moduloActivo);
  const setModulo = useStore((s) => s.setModuloActivo);
  const visibles = useModulosVisibles();
  const search = React.useMemo(() => new URLSearchParams(params?.toString() ?? ""), [params]);
  const base = moduloDeRuta(pathname, search, preferido);
  const modulo = base ? visibles.find((m) => m.id === base.id) : undefined;
  const pagina = modulo ? paginaActiva(modulo, pathname, search) : undefined;
  React.useEffect(() => {
    if (modulo && modulo.id !== preferido) setModulo(modulo.id);
  }, [modulo, preferido, setModulo]);
  return { modulo, pagina, pathname, search };
}

/** Clave de favorito de la página actual. */
export function hrefActual(pathname: string, search: URLSearchParams) {
  const q = search.toString();
  return q ? `${pathname}?${q}` : pathname;
}
