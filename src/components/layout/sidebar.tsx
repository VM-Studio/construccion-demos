"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsLeft, ChevronsRight, LogOut, PlayCircle } from "lucide-react";
import { useStore } from "@/store";
import { useEmpresa, useUsuario } from "@/store/selectors";
import { NAVEGACION } from "@/config/navegacion";
import { puede, ROL_LABEL } from "@/domain/permisos";
import { Tooltip } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter((w) => /^[A-ZÁÉÍÓÚÑ]/i.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/** Navegación principal agrupada, con visibilidad por rol. */
export function SidebarNav({ colapsado = false, onNavigate }: { colapsado?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const usuario = useUsuario();
  const empresa = useEmpresa();
  const logout = useStore((s) => s.logout);
  const abrirTour = useStore((s) => s.abrirTour);
  const sucursales = useStore((s) => s.db.sucursales);

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-14 shrink-0 items-center border-b border-border", colapsado ? "justify-center px-2" : "px-4")}>
        {colapsado ? (
          <span className="flex size-8 items-center justify-center rounded-control bg-ink text-[12px] font-semibold text-white">{iniciales(empresa.empresa)}</span>
        ) : (
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold tracking-tight text-ink">{empresa.empresa}</div>
            <div className="truncate text-[11px] text-muted">Sistema de Gestión</div>
          </div>
        )}
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3" aria-label="Navegación principal">
        {NAVEGACION.map((g) => {
          const items = g.items.filter((i) => puede(usuario, i.permiso));
          if (!items.length) return null;
          return (
            <div key={g.grupo} className="mb-4">
              {!colapsado && <div className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-disabled">{g.grupo}</div>}
              <ul className="flex flex-col gap-0.5">
                {items.map((i) => {
                  const activo = pathname === i.href || pathname.startsWith(i.href + "/");
                  const link = (
                    <Link
                      href={i.href}
                      onClick={onNavigate}
                      data-tour={`nav-${i.href.slice(1)}`}
                      aria-current={activo ? "page" : undefined}
                      className={cn(
                        "relative flex h-9 items-center gap-2.5 rounded-control text-[13px] font-medium transition-colors",
                        colapsado ? "justify-center px-0" : "px-2.5",
                        activo ? "bg-subtle text-ink" : "text-muted hover:bg-subtle/70 hover:text-ink",
                      )}
                    >
                      {activo && <span className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-ink" />}
                      <i.icono className="size-[18px] shrink-0" />
                      {!colapsado && <span className="truncate">{i.label}</span>}
                    </Link>
                  );
                  return <li key={i.href}>{colapsado ? <Tooltip content={i.label} side="right">{link}</Tooltip> : link}</li>;
                })}
              </ul>
            </div>
          );
        })}
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
              <DropdownMenuItem
                onSelect={() => {
                  router.push("/tablero");
                  setTimeout(abrirTour, 300);
                }}
              >
                <PlayCircle />
                Ver recorrido
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  logout();
                  router.replace("/login");
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

/** Sidebar fija de escritorio (240px, colapsable a 64px). */
export function Sidebar() {
  const colapsado = useStore((s) => s.ui.sidebarColapsado);
  const toggle = useStore((s) => s.toggleSidebar);
  return (
    <aside className={cn("no-print fixed inset-y-0 left-0 z-30 hidden border-r border-border bg-surface transition-[width] duration-150 lg:block", colapsado ? "w-16" : "w-60")}>
      <SidebarNav colapsado={colapsado} />
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
