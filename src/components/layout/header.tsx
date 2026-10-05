"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronRight, Menu, Search } from "lucide-react";
import { useStore } from "@/store";
import { useDb, useUsuario } from "@/store/selectors";
import { useAlertas } from "@/store/alertas";
import { SEGMENTOS } from "@/config/navegacion";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SidebarNav } from "./sidebar";
import { CommandPalette } from "./command-palette";

function useBreadcrumb() {
  const pathname = usePathname();
  const db = useDb();
  const partes = pathname.split("/").filter(Boolean);
  return partes.map((seg, i) => {
    const href = "/" + partes.slice(0, i + 1).join("/");
    let label = SEGMENTOS[seg];
    if (!label) {
      const ent =
        db.pedidos.find((x) => x.id === seg) ??
        db.presupuestos.find((x) => x.id === seg) ??
        db.ordenesCompra.find((x) => x.id === seg) ??
        db.acopios.find((x) => x.id === seg);
      label = ent?.numero ?? db.clientes.find((c) => c.id === seg)?.razonSocial ?? db.proveedores.find((p) => p.id === seg)?.razonSocial ?? seg;
    }
    return { href, label };
  });
}

/** Campana de alertas con badge numérico. */
function CampanaAlertas() {
  const alertas = useAlertas();
  const total = alertas.reduce((a, x) => a + x.cantidad, 0);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Alertas (${total})`} className="relative">
          <Bell />
          {total > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white tnum">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0">
        <div className="border-b border-border px-4 py-2.5 text-[13px] font-semibold">Alertas</div>
        {alertas.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-muted">No hay alertas. Todo en orden.</p>
        ) : (
          <ul className="max-h-[380px] overflow-y-auto py-1">
            {alertas.map((a) => (
              <li key={a.id}>
                <Link href={a.href} className="flex items-start gap-3 px-4 py-2.5 hover:bg-subtle">
                  <a.icono className={cn("mt-0.5 size-4 shrink-0", a.severidad === "alta" ? "text-danger" : a.severidad === "media" ? "text-warning" : "text-muted")} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-ink">{a.titulo}</span>
                    <span className="block text-[12px] text-muted">{a.detalle}</span>
                  </span>
                  <span className="text-[13px] font-semibold tnum">{a.cantidad}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Header: breadcrumb, selector de sucursal, búsqueda global (⌘K) y alertas. */
export function Header() {
  const [menuAbierto, setMenuAbierto] = React.useState(false);
  const [buscarAbierto, setBuscarAbierto] = React.useState(false);
  const crumbs = useBreadcrumb();
  const usuario = useUsuario();
  const sucursales = useStore((s) => s.db.sucursales);
  const sucursalActiva = useStore((s) => s.ui.sucursalActivaId);
  const setSucursal = useStore((s) => s.setSucursalActiva);
  const fija = !!usuario?.sucursalId;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setBuscarAbierto((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface/95 px-3 backdrop-blur sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú" onClick={() => setMenuAbierto(true)}>
        <Menu />
      </Button>
      <nav aria-label="Ubicación" className="hidden min-w-0 flex-1 items-center gap-1 text-[13px] sm:flex">
        {crumbs.map((c, i) => (
          <React.Fragment key={c.href}>
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-disabled" />}
            {i === crumbs.length - 1 ? (
              <span className="truncate font-medium text-ink">{c.label}</span>
            ) : (
              <Link href={c.href} className="truncate text-muted hover:text-ink">
                {c.label}
              </Link>
            )}
          </React.Fragment>
        ))}
      </nav>
      <div className="flex-1 sm:hidden" />
      <div className="flex items-center gap-1.5 sm:gap-2" data-tour="sucursal">
        <Tooltip content={fija ? "Tu usuario está asignado a esta sucursal" : "Filtra listados y KPIs por sucursal"}>
          <div className="w-[150px] sm:w-[190px]">
            <Select
              size="sm"
              aria-label="Sucursal"
              disabled={fija}
              value={sucursalActiva ?? ""}
              onValueChange={(v) => setSucursal(v || null)}
              options={[{ value: "", label: "Todas las sucursales" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
            />
          </div>
        </Tooltip>
        <Button variant="secondary" size="sm" className="h-8 gap-2 px-2 text-muted sm:px-2.5" onClick={() => setBuscarAbierto(true)} aria-label="Búsqueda global">
          <Search />
          <span className="hidden md:inline">Buscar</span>
          <kbd className="hidden rounded border border-border bg-subtle px-1 text-[10px] font-medium md:inline">⌘K</kbd>
        </Button>
        <CampanaAlertas />
      </div>
      <Sheet open={menuAbierto} onOpenChange={setMenuAbierto}>
        <SheetContent side="left" title="Menú" width={280} className="lg:hidden">
          <SidebarNav onNavigate={() => setMenuAbierto(false)} />
        </SheetContent>
      </Sheet>
      <CommandPalette open={buscarAbierto} onOpenChange={setBuscarAbierto} />
    </header>
  );
}
