"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronRight, Heart, LogOut, Menu, PlayCircle, Search } from "lucide-react";
import { useStore } from "@/store";
import { useDb, useEmpresa, useUsuario } from "@/store/selectors";
import { useAlertas } from "@/store/alertas";
import { MODULOS } from "@/config/modulos";
import { ROL_LABEL } from "@/domain/permisos";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tooltip } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { SidebarNav } from "./sidebar";
import { CommandPalette } from "./command-palette";
import { useModuloActual } from "./use-modulo";

/** Nombre del documento abierto (último segmento de la URL si es un id). */
function useDocumento(pathname: string): string | undefined {
  const db = useDb();
  const seg = pathname.split("/").filter(Boolean).at(-1);
  if (!seg || !/_/.test(seg)) return seg === "nueva" || seg === "nuevo" ? "Nuevo" : undefined;
  const conNumero = [db.notasPedido, db.cotizaciones, db.acopios, db.remitos, db.ordenesCompra, db.acopiosProveedor, db.comprobantes, db.despachos] as { id: string; numero: string }[][];
  for (const l of conNumero) {
    const x = l.find((e) => e.id === seg);
    if (x) return x.numero || "Borrador";
  }
  return db.clientes.find((c) => c.id === seg)?.razonSocial ?? db.proveedores.find((p) => p.id === seg)?.razonSocial ?? db.productos.find((p) => p.id === seg)?.nombre;
}

/** Breadcrumb Módulo / Página / Documento. */
function Breadcrumb() {
  const { modulo, pagina, pathname } = useModuloActual();
  const doc = useDocumento(pathname);
  const crumbs: { label: string; href?: string }[] = [];
  if (pathname === "/inicio") crumbs.push({ label: "Módulos" });
  else {
    if (modulo) crumbs.push({ label: modulo.nombre, href: modulo.paginas[0].href });
    if (pagina) crumbs.push({ label: pagina.nombre, href: pagina.href });
    if (doc && pagina && pathname !== pagina.href.split("?")[0]) crumbs.push({ label: doc });
  }
  return (
    <nav aria-label="Ubicación" className="hidden min-w-0 items-center gap-1 text-[13px] md:flex">
      {crumbs.map((c, i) => (
        <React.Fragment key={`${i}-${c.label}`}>
          {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-disabled" />}
          {i === crumbs.length - 1 || !c.href ? (
            <span className="truncate font-medium text-ink">{c.label}</span>
          ) : (
            <Link href={c.href} className="truncate text-muted hover:text-ink">
              {c.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

/** Campana de alertas con badge numérico. */
function CampanaAlertas() {
  const alertas = useAlertas();
  const total = alertas.reduce((a, x) => a + x.cantidad, 0);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Alertas (${total})`} className="relative" data-tour="campana">
          <Bell />
          {total > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white tnum">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="text-[13px] font-semibold">Alertas</span>
          <Link href="/alertas" className="text-[12px] text-muted hover:text-ink">Ver todas</Link>
        </div>
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

/** Páginas marcadas con corazón. */
function Favoritos() {
  const usuarioId = useStore((s) => s.ui.usuarioId) ?? "";
  const favs = useStore((s) => s.ui.favoritosPaginas[usuarioId]) ?? [];
  const toggle = useStore((s) => s.toggleFavoritoPagina);
  const paginas = MODULOS.flatMap((m) => m.paginas.map((p) => ({ ...p, modulo: m })));
  const lista = favs.map((href) => paginas.find((p) => p.href === href) ?? { id: href, nombre: href, href, modulo: undefined });
  return (
    <Popover>
      <Tooltip content="Favoritos">
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Favoritos">
            <Heart className={cn(favs.length && "fill-ink text-ink")} />
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="end" className="w-[300px] p-0">
        <div className="border-b border-border px-4 py-2.5 text-[13px] font-semibold">Páginas favoritas</div>
        {lista.length === 0 ? (
          <p className="px-4 py-6 text-center text-[12px] text-muted">Marcá páginas con el corazón junto al título para tenerlas a mano.</p>
        ) : (
          <ul className="max-h-[320px] overflow-y-auto py-1">
            {lista.map((p) => (
              <li key={p.href} className="group flex items-center">
                <Link href={p.href} className="min-w-0 flex-1 px-4 py-2 hover:bg-subtle">
                  <span className="block truncate text-[13px] text-ink">{p.nombre}</span>
                  {p.modulo && <span className="block text-[11px] text-muted">{p.modulo.nombre}</span>}
                </Link>
                <button onClick={() => toggle(p.href)} className="px-3 text-disabled hover:text-ink" aria-label={`Quitar ${p.nombre} de favoritos`}>
                  <Heart className="size-3.5 fill-current" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Avatar() {
  const usuario = useUsuario();
  const router = useRouter();
  const logout = useStore((s) => s.logout);
  const abrirTour = useStore((s) => s.abrirTour);
  if (!usuario) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button aria-label="Menú de usuario" className="flex size-8 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2">
          {usuario.avatarIniciales}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <span className="block text-[13px] font-medium text-ink">{usuario.nombre}</span>
          <span className="block text-[11px] font-normal text-muted">{ROL_LABEL[usuario.rol]} · {usuario.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => setTimeout(abrirTour, 100)}>
          <PlayCircle /> Ver recorrido
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            logout();
            router.replace("/login");
          }}
        >
          <LogOut /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Header: empresa, breadcrumb, Explorar (⌘K), sucursal, unidad de negocio, favoritos, alertas y avatar. */
export function Header() {
  const [menuAbierto, setMenuAbierto] = React.useState(false);
  const [buscarAbierto, setBuscarAbierto] = React.useState(false);
  const usuario = useUsuario();
  const empresa = useEmpresa();
  const sucursales = useStore((s) => s.db.sucursales);
  const unidades = useStore((s) => s.db.unidadesNegocio);
  const sucursalActiva = useStore((s) => s.ui.sucursalActivaId);
  const unActiva = useStore((s) => s.ui.unidadNegocioId);
  const setSucursal = useStore((s) => s.setSucursalActiva);
  const setUN = useStore((s) => s.setUnidadNegocio);
  const fija = !!usuario?.sucursalId && usuario.rol !== "DUENO" && usuario.rol !== "ADMINISTRACION";

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
    <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface/95 px-3 backdrop-blur sm:px-5">
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú" onClick={() => setMenuAbierto(true)}>
        <Menu />
      </Button>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Link href="/inicio" className="shrink-0 text-[14px] font-semibold tracking-tight text-ink hover:opacity-80">
          {empresa.empresa}
        </Link>
        <span className="hidden h-4 w-px bg-border md:block" />
        <React.Suspense>
          <Breadcrumb />
        </React.Suspense>
      </div>
      <Button variant="secondary" size="sm" className="h-8 gap-2 px-2 text-muted sm:w-[200px] sm:justify-start sm:px-2.5 xl:w-[260px]" onClick={() => setBuscarAbierto(true)} aria-label="Explorar" data-tour="explorar">
        <Search />
        <span className="hidden sm:inline">Explorar</span>
        <kbd className="ml-auto hidden rounded border border-border bg-subtle px-1 text-[10px] font-medium sm:inline">⌘K</kbd>
      </Button>
      <div className="flex items-center gap-1 sm:gap-1.5" data-tour="sucursal">
        <Tooltip content={fija ? "Tu usuario está asignado a esta sucursal" : "Filtra listados y KPIs por sucursal"}>
          <div className="hidden w-[150px] md:block xl:w-[170px]">
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
        <Tooltip content="Unidad de negocio: filtra artículos, stock, ventas, compras y reportes">
          <div className="hidden w-[130px] md:block xl:w-[150px]">
            <Select
              size="sm"
              aria-label="Unidad de negocio"
              value={unActiva ?? ""}
              onValueChange={(v) => setUN(v || null)}
              options={[{ value: "", label: "Todas las unidades" }, ...unidades.map((u) => ({ value: u.id, label: u.nombre }))]}
            />
          </div>
        </Tooltip>
        <Favoritos />
        <CampanaAlertas />
        <Avatar />
      </div>
      <Sheet open={menuAbierto} onOpenChange={setMenuAbierto}>
        <SheetContent side="left" title="Menú" width={280} className="lg:hidden">
          <React.Suspense>
            <SidebarNav onNavigate={() => setMenuAbierto(false)} />
          </React.Suspense>
          <div className="space-y-2 border-t border-border p-3 md:hidden">
            <Select size="sm" aria-label="Sucursal" disabled={fija} value={sucursalActiva ?? ""} onValueChange={(v) => setSucursal(v || null)} options={[{ value: "", label: "Todas las sucursales" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]} />
            <Select size="sm" aria-label="Unidad de negocio" value={unActiva ?? ""} onValueChange={(v) => setUN(v || null)} options={[{ value: "", label: "Todas las unidades" }, ...unidades.map((u) => ({ value: u.id, label: u.nombre }))]} />
          </div>
        </SheetContent>
      </Sheet>
      <CommandPalette open={buscarAbierto} onOpenChange={setBuscarAbierto} />
    </header>
  );
}
