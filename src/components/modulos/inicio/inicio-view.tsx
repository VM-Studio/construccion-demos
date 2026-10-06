"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, Bell, ChevronRight, DollarSign, Heart, PackageCheck, Plus, Truck } from "lucide-react";
import { useStore } from "@/store";
import { useDb, usePendientes, usePuede, useSucursalActiva, useUsuario } from "@/store/selectors";
import { useAlertas } from "@/store/alertas";
import { ventasFacturadas } from "@/domain/metricas";
import { useModulosVisibles } from "@/components/layout/use-modulo";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";
import { diaLocal } from "@/lib/periodos";
import { cn } from "@/lib/utils";
import { puede, type Permiso } from "@/domain/permisos";

const ACCESOS: { label: string; href: string; permiso: Permiso; modulo: string }[] = [
  { label: "Nueva nota de pedido", href: "/ventas/notas-pedido/nueva", permiso: "ventas.editar", modulo: "ventas" },
  { label: "Nuevo acopio", href: "/acopios/nuevo", permiso: "acopios.editar", modulo: "clientes" },
  { label: "Registrar retiro de acopio", href: "/ventas/notas-pedido/nueva?origen=acopio", permiso: "acopios.editar", modulo: "ventas" },
  { label: "Ingreso de mercadería", href: "/compras/recepciones", permiso: "compras.recibir", modulo: "compras" },
  { label: "Nuevo remito", href: "/remitos?nuevo=1", permiso: "remitos.ver", modulo: "remitos" },
  { label: "Registrar cobro", href: "/ventas/recibos?nuevo=1", permiso: "ctacte.cobrar", modulo: "ventas" },
];

/** Pantalla de inicio: saludo, KPIs del día, módulos como tarjetas (con favoritos) y accesos directos. */
export function InicioView() {
  const router = useRouter();
  const db = useDb();
  const usuario = useUsuario();
  const sucursalId = useSucursalActiva();
  const modulos = useModulosVisibles();
  const alertas = useAlertas();
  const pendientes = usePendientes();
  const verVentas = usePuede("ventas.ver");
  const setModulo = useStore((s) => s.setModuloActivo);
  const favs = useStore((s) => s.ui.favoritosModulos[s.ui.usuarioId ?? ""]) ?? [];
  const toggleFav = useStore((s) => s.toggleFavoritoModulo);

  const hoy = diaLocal(new Date());
  const kpis = React.useMemo(() => {
    const ini = new Date();
    ini.setHours(0, 0, 0, 0);
    const ventasHoy = ventasFacturadas(db, { desde: ini.toISOString(), hasta: new Date(ini.getTime() + 86399999).toISOString() }, sucursalId);
    const despachos = db.despachos.filter((d) => (d.estado === "ESPERA" || d.estado === "PREPARACION") && diaLocal(d.fechaProgramada) <= hoy && (!sucursalId || d.sucursalId === sucursalId)).length;
    const np = new Map(db.notasPedido.map((n) => [n.id, n]));
    const pend = pendientes.filter((l) => !sucursalId || np.get(l.notaPedidoId)?.sucursalId === sucursalId);
    return { ventasHoy, despachos, pendLineas: pend.length, pendPesos: pend.reduce((a, l) => a + l.pendiente * l.precio, 0) };
  }, [db, sucursalId, pendientes, hoy]);

  const ordenados = [...modulos].sort((a, b) => {
    if (a.id === "general") return -1;
    if (b.id === "general") return 1;
    return Number(favs.includes(b.id)) - Number(favs.includes(a.id));
  });
  const totalAlertas = alertas.reduce((a, x) => a + x.cantidad, 0);
  const abrir = (moduloId: string, href: string) => {
    setModulo(moduloId);
    router.push(href);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-[24px] font-semibold tracking-tight text-ink">Hola, {usuario?.nombre.split(" ")[0]}</h1>
        <p className="text-[13px] text-muted">{formatDate(new Date(), "EEEE d 'de' MMMM 'de' yyyy")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-tour="inicio-kpis">
        {verVentas && <KpiChico icono={DollarSign} label="Ventas de hoy" valor={formatMoney(kpis.ventasHoy, { compact: Math.abs(kpis.ventasHoy) >= 1_000_000 })} href="/tablero" />}
        <KpiChico icono={Truck} label="Despachos pendientes hoy" valor={String(kpis.despachos)} href="/despachos" />
        {verVentas && <KpiChico icono={PackageCheck} label="Pendientes de entrega" valor={`${kpis.pendLineas} líneas`} sub={formatMoney(kpis.pendPesos, { compact: true })} href="/pendientes-entrega" />}
        <KpiChico icono={Bell} label="Alertas" valor={String(totalAlertas)} href="/alertas" alerta={totalAlertas > 0} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-tour="modulos">
        {ordenados.map((m) => {
          const fav = favs.includes(m.id);
          const general = m.id === "general";
          return (
            <section
              key={m.id}
              className={cn("relative rounded-card border border-border bg-surface p-5", fav && "border-t-2 border-t-ink", general && "md:col-span-2")}
              aria-label={`Módulo ${m.nombre}`}
            >
              <button
                onClick={() => toggleFav(m.id)}
                aria-pressed={fav}
                aria-label={fav ? `Quitar ${m.nombre} de favoritos` : `Marcar ${m.nombre} como favorito`}
                className="absolute right-3 top-3 rounded-control p-1.5 text-disabled transition-colors hover:text-ink"
              >
                <Heart className={cn("size-4", fav && "fill-ink text-ink")} />
              </button>
              <div className="mb-3 flex items-center gap-3 pr-8">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-subtle text-ink">
                  <m.icono className="size-[18px]" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-ink">{m.nombre}</h2>
                  <p className="text-[12px] text-muted">
                    {m.paginas.length} {m.paginas.length === 1 ? "página" : "páginas"} · {m.descripcion}
                  </p>
                </div>
              </div>
              <div className={cn(general && "grid gap-4 lg:grid-cols-2")}>
                <ul className={cn(m.id === "reportes" && "max-h-[252px] overflow-y-auto")}>
                  {m.paginas.map((p) => (
                    <li key={p.id}>
                      <button onClick={() => abrir(m.id, p.href)} className="group flex h-9 w-full items-center gap-2.5 rounded-control px-2 text-left text-[13px] text-ink transition-colors hover:bg-subtle">
                        <ArrowUpRight className="size-3.5 shrink-0 text-disabled group-hover:text-ink" />
                        <span className="truncate">{p.nombre}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {general && (
                  <div className="rounded-control border border-border">
                    <div className="flex items-center justify-between border-b border-border px-3 py-2">
                      <span className="text-[12px] font-semibold text-ink">Alertas activas</span>
                      <Link href="/alertas" onClick={() => setModulo("general")} className="text-[12px] text-muted hover:text-ink">Ver todas</Link>
                    </div>
                    {alertas.length === 0 ? (
                      <p className="px-3 py-6 text-center text-[12px] text-muted">Sin alertas. Todo en orden.</p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {alertas.slice(0, 5).map((a) => (
                          <li key={a.id}>
                            <Link href={a.href} className="group flex items-center gap-2.5 px-3 py-2 hover:bg-subtle">
                              <a.icono className={cn("size-4 shrink-0", a.severidad === "alta" ? "text-danger" : a.severidad === "media" ? "text-warning" : "text-muted")} />
                              <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{a.titulo}</span>
                              <span className="text-[13px] font-semibold tnum">{a.cantidad}</span>
                              <ChevronRight className="size-3.5 text-disabled group-hover:text-ink" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <section aria-label="Accesos directos">
        <h2 className="mb-2.5 text-[13px] font-semibold text-ink">Accesos directos</h2>
        <div className="flex flex-wrap gap-2" data-tour="accesos">
          {ACCESOS.filter((a) => puede(usuario, a.permiso)).map((a) => (
            <Button key={a.href} variant="secondary" size="sm" onClick={() => abrir(a.modulo, a.href)}>
              <Plus /> {a.label}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}

function KpiChico({ icono: Icono, label, valor, sub, href, alerta }: { icono: React.ComponentType<{ className?: string }>; label: string; valor: string; sub?: string; href: string; alerta?: boolean }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong">
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full bg-subtle", alerta ? "text-danger" : "text-muted")}>
        <Icono className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] text-muted">{label}</span>
        <span className="block text-[17px] font-semibold leading-tight text-ink tnum">
          {valor}
          {sub && <span className="ml-1.5 text-[12px] font-normal text-muted">{sub}</span>}
        </span>
      </span>
      <ArrowRight className="size-3.5 text-disabled transition-colors group-hover:text-ink" />
    </Link>
  );
}

