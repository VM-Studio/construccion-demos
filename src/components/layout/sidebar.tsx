"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronsLeft, ChevronsRight, LayoutGrid, LogOut, PlayCircle } from "lucide-react";
import { useStore } from "@/store";
import { useEmpresa, useUsuario } from "@/store/selectors";
import { coincidencia } from "@/config/modulos";
import { ROL_LABEL } from "@/domain/permisos";
import { Tooltip } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useModuloActual, useModulosVisibles } from "./use-modulo";
import { useDb } from "@/lib/datos/almacen";

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter((w) => /^[A-ZÁÉÍÓÚÑ]/i.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const itemCls = (activo: boolean, colapsado: boolean) =>
  cn(
    "relative flex h-9 items-center gap-2.5 rounded-control text-[13px] font-medium transition-colors duration-150",
    colapsado ? "justify-center px-0" : "px-2.5",
    activo ? "bg-subtle text-ink" : "text-muted hover:bg-subtle/70 hover:text-ink",
  );

/**
 * Barra lateral contextual: "← Módulos", el módulo activo con sus páginas y la lista
 * compacta de "Otros módulos" (como la barra de pestañas de öppen, pero más limpia).
 */
export function SidebarNav({ colapsado = false, onNavigate }: { colapsado?: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const usuario = useUsuario();
  const empresa = useEmpresa();
  const logout = useStore((s) => s.logout);
  const abrirTour = useStore((s) => s.abrirTour);
  const setModulo = useStore((s) => s.setModuloActivo);
  const sucursales = useDb().sucursales;
  const visibles = useModulosVisibles();
  const { modulo, pagina, pathname, search } = useModuloActual();
  const enInicio = pathname === "/inicio";

  const irModulo = (id: string) => {
    const m = visibles.find((x) => x.id === id);
    if (!m) return;
    setModulo(m.id);
    router.push(m.paginas[0].href);
    onNavigate?.();
  };

  const link = (href: string, label: string, Icono: React.ComponentType<{ className?: string }>, activo: boolean, tour?: string) => {
    const el = (
      <Link href={href} onClick={onNavigate} data-tour={tour} aria-current={activo ? "page" : undefined} className={itemCls(activo, colapsado)}>
        {activo && <span className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-ink" />}
        <Icono className="size-[18px] shrink-0" />
        {!colapsado && <span className="truncate">{label}</span>}
      </Link>
    );
    return colapsado ? <Tooltip content={label} side="right">{el}</Tooltip> : el;
  };

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-14 shrink-0 items-center border-b border-border", colapsado ? "justify-center px-2" : "px-4")}>
        <Link href="/inicio" onClick={onNavigate} className="min-w-0" aria-label="Ir a módulos">
          {colapsado ? (
            <span className="flex size-8 items-center justify-center rounded-control bg-ink text-[12px] font-semibold text-white">{iniciales(empresa.empresa)}</span>
          ) : (
            <>
              <div className="truncate text-[14px] font-semibold tracking-tight text-ink">{empresa.empresa}</div>
              <div className="truncate text-[11px] text-muted">Sistema de Gestión</div>
            </>
          )}
        </Link>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3" aria-label="Navegación del módulo">
        {modulo && !enInicio ? (
          <div key={modulo.id} className="animate-fade-in">
            <div className="mb-2">{link("/inicio", "Módulos", ArrowLeft, false, "volver-modulos")}</div>
            {!colapsado && (
              <div className="mb-1.5 flex items-center gap-2 px-2.5 pt-1">
                <modulo.icono className="size-4 text-ink" />
                <span className="truncate text-[15px] font-semibold text-ink">{modulo.nombre}</span>
              </div>
            )}
            <ul className="flex flex-col gap-0.5" data-tour="sidebar-paginas">
              {modulo.paginas.map((pg) => (
                <li key={pg.id}>{link(pg.href, pg.nombre, PaginaIcono, pagina?.id === pg.id && coincidencia(pg, pathname, search) > 0)}</li>
              ))}
            </ul>
            <div className="my-4 border-t border-border" />
            {!colapsado && <div className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-disabled">Otros módulos</div>}
            <ul className="flex flex-col gap-0.5">
              {visibles
                .filter((m) => m.id !== modulo.id)
                .map((m) => {
                  const el = (
                    <button onClick={() => irModulo(m.id)} className={cn(itemCls(false, colapsado), "h-8 w-full text-[12.5px]")}>
                      <m.icono className="size-4 shrink-0" />
                      {!colapsado && <span className="truncate">{m.nombre}</span>}
                    </button>
                  );
                  return <li key={m.id}>{colapsado ? <Tooltip content={m.nombre} side="right">{el}</Tooltip> : el}</li>;
                })}
            </ul>
          </div>
        ) : (
          <div className="animate-fade-in">
            {!colapsado && <div className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-disabled">Módulos</div>}
            <ul className="flex flex-col gap-0.5">
              <li>{link("/inicio", "Inicio", LayoutGrid, enInicio)}</li>
              {visibles.map((m) => {
                const el = (
                  <button onClick={() => irModulo(m.id)} className={cn(itemCls(false, colapsado), "w-full")}>
                    <m.icono className="size-[18px] shrink-0" />
                    {!colapsado && <span className="truncate">{m.nombre}</span>}
                  </button>
                );
                return <li key={m.id}>{colapsado ? <Tooltip content={m.nombre} side="right">{el}</Tooltip> : el}</li>;
              })}
            </ul>
          </div>
        )}
      </nav>
      {usuario && (
        <div className="shrink-0 border-t border-border p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn("flex w-full items-center gap-2.5 rounded-control p-1.5 text-left outline-none hover:bg-subtle focus-visible:ring-2 focus-visible:ring-ink", colapsado && "justify-center")}
                aria-label="Menú de usuario"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-white">{usuario.avatarIniciales}</span>
                {!colapsado && (
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-ink">{usuario.nombre}</span>
                    <span className="block truncate text-[11px] text-muted">
                      {ROL_LABEL[usuario.rol]}
                      {usuario.sucursalId && ` · ${sucursales.find((s) => s.id === usuario.sucursalId)?.nombre ?? ""}`}
                    </span>
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuLabel>{usuario.email}</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setTimeout(abrirTour, 100)}>
                <PlayCircle />
                Ver recorrido
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  void logout().then(() => router.replace("/login"));
                }}
              >
                <LogOut />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

function PaginaIcono({ className }: { className?: string }) {
  return <span className={cn("flex items-center justify-center", className)}><span className="size-1.5 rounded-full bg-current opacity-60" /></span>;
}

/** Sidebar fija de escritorio (240px, colapsable a 64px). */
export function Sidebar() {
  const colapsado = useStore((s) => s.ui.sidebarColapsado);
  const toggle = useStore((s) => s.toggleSidebar);
  return (
    <aside className={cn("no-print fixed inset-y-0 left-0 z-30 hidden border-r border-border bg-surface transition-[width] duration-150 lg:block", colapsado ? "w-16" : "w-60")}>
      <React.Suspense>
        <SidebarNav colapsado={colapsado} />
      </React.Suspense>
      <button
        onClick={toggle}
        aria-label={colapsado ? "Expandir menú" : "Colapsar menú"}
        className="absolute -right-3 top-[68px] flex size-6 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-sm hover:text-ink"
      >
        {colapsado ? <ChevronsRight className="size-3.5" /> : <ChevronsLeft className="size-3.5" />}
      </button>
    </aside>
  );
}
