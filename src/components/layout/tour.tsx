"use client";
import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { useStore } from "@/store";
import { useUsuario } from "@/store/selectors";
import { Button } from "@/components/ui/button";

interface Paso {
  ruta: string;
  selector: string;
  titulo: string;
  texto: string;
  lado: "top" | "right" | "bottom" | "left";
}

const PASOS: Paso[] = [
  { ruta: "/inicio", selector: '[data-tour="modulos"]', titulo: "Inicio con módulos", texto: "Los módulos como en el sistema actual, pero más limpios: cada tarjeta lista sus páginas. Al entrar a una página, la barra lateral muestra el módulo y el botón «← Módulos» para volver y elegir otro.", lado: "top" },
  { ruta: "/tablero", selector: '[data-tour="kpis"]', titulo: "Tablero", texto: "Ventas por unidad de negocio, margen, cuentas a cobrar, saldo de acopios de clientes y lo que falta retirar de los acopios con proveedores.", lado: "bottom" },
  { ruta: "/clientes/cli_ramos", selector: '[data-tour="cliente-acciones"]', titulo: "Cliente: todo desde un lugar", texto: "Desde la ficha del cliente se acopia, se vende, se retira de un acopio, se cobra y se cotiza. Abajo: acopios, ventas, pendientes de entrega, cuenta corriente y remitos.", lado: "bottom" },
  { ruta: "/ventas/notas-pedido/nueva?cliente=cli_ramos&origen=acopio", selector: '[data-tour="np-origen"]', titulo: "Venta con origen Acopio", texto: "Elegís el acopio del cliente: se cargan sus obras y los precios congelados, y el panel muestra el saldo antes y después del retiro.", lado: "bottom" },
  { ruta: "/acopios/desacopio?acopio=aco_ramos_3633", selector: '[data-tour="descargar"]', titulo: "Estado de desacopio", texto: "El mismo detalle que usan hoy (NP, devoluciones y traspasos con saldo corrido) y la descarga en PDF o Excel con su formato.", lado: "left" },
  { ruta: "/pendientes-entrega", selector: '[data-tour="pendientes-kpis"]', titulo: "Pendientes de entrega y disponible", texto: "Lo vendido que sigue en el galpón descuenta del disponible: no se puede sobrevender. Acá ves a quién se le debe cada bolsa y qué despacho tiene.", lado: "bottom" },
  { ruta: "/remitos", selector: '[data-tour="remitos-kpis"]', titulo: "Remitos y remito firmado", texto: "Picking → hecho → subís la foto del remito firmado y queda guardada. El KPI muestra lo que falta cerrar en papel.", lado: "bottom" },
  { ruta: "/proveedores/prov_01", selector: '[data-tour="proveedor-kpis"]', titulo: "Proveedores", texto: "Cuánto le debemos a cada proveedor y cuánta mercadería nos falta retirar de los acopios con ellos. Desde acá se retira con una OC contra el acopio.", lado: "bottom" },
];

/** Recorrido guiado de 8 pasos (Popover de Radix anclado a elementos). */
export function Tour() {
  const usuario = useUsuario();
  const pathname = usePathname();
  const router = useRouter();
  const abierto = useStore((s) => s.ui.tourAbierto);
  const visto = useStore((s) => (usuario ? s.ui.tourVisto[usuario.id] : true));
  const abrir = useStore((s) => s.abrirTour);
  const cerrar = useStore((s) => s.cerrarTour);
  const [paso, setPaso] = React.useState(0);
  const [ancla, setAncla] = React.useState<HTMLElement | null>(null);

  // Primera vez del Dueño: abrir automáticamente en el tablero.
  React.useEffect(() => {
    if (usuario?.rol === "DUENO" && !visto && pathname === "/inicio" && !abierto) {
      const t = setTimeout(abrir, 1500);
      return () => clearTimeout(t);
    }
  }, [usuario?.rol, visto, pathname, abierto, abrir]);

  React.useEffect(() => {
    if (abierto) setPaso(0);
  }, [abierto]);
  React.useEffect(() => {
    if (!abierto) return;
    const destino = PASOS[paso].ruta;
    if (pathname + (typeof window !== "undefined" ? window.location.search : "") !== destino) router.push(destino);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, paso]);

  React.useEffect(() => {
    if (!abierto) return;
    let intentos = 0;
    const buscar = () => {
      const els = Array.from(document.querySelectorAll<HTMLElement>(PASOS[paso].selector)).filter((e) => e.offsetParent !== null);
      if (els[0]) {
        els[0].scrollIntoView({ behavior: "smooth", block: "center" });
        setAncla(els[0]);
      } else if (intentos++ < 25) setTimeout(buscar, 200);
      else setAncla(null);
    };
    buscar();
  }, [abierto, paso, pathname]);

  if (!abierto) return null;
  const p = PASOS[paso];
  const ultimo = paso === PASOS.length - 1;
  const virtualRef = { current: ancla ?? { getBoundingClientRect: () => new DOMRect(window.innerWidth / 2, window.innerHeight / 2, 0, 0) } };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/20" aria-hidden />
      {ancla && <Highlight el={ancla} />}
      <PopoverPrimitive.Root open>
        <PopoverPrimitive.Anchor virtualRef={virtualRef as React.RefObject<HTMLElement>} />
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            side={ancla ? p.lado : "bottom"}
            sideOffset={12}
            collisionPadding={16}
            onEscapeKeyDown={cerrar}
            onInteractOutside={(e) => e.preventDefault()}
            className="z-50 w-[340px] max-w-[calc(100vw-32px)] rounded-card border border-border bg-surface p-4 shadow-pop outline-none animate-fade-in"
            aria-label="Recorrido guiado"
          >
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-accent">Recorrido · {paso + 1} de {PASOS.length}</div>
            <h3 className="text-[15px] font-semibold text-ink">{p.titulo.replace(/^\d · /, "")}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{p.texto}</p>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex gap-1">
                {PASOS.map((_, i) => (
                  <span key={i} className={`h-1.5 w-4 rounded-full ${i <= paso ? "bg-ink" : "bg-subtle"}`} />
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={cerrar}>Salir</Button>
                {paso > 0 && <Button size="sm" variant="secondary" onClick={() => setPaso(paso - 1)}>Anterior</Button>}
                <Button size="sm" onClick={() => (ultimo ? cerrar() : setPaso(paso + 1))}>{ultimo ? "Entendido" : "Siguiente"}</Button>
              </div>
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </>
  );
}

function Highlight({ el }: { el: HTMLElement }) {
  const [r, setR] = React.useState(() => el.getBoundingClientRect());
  React.useEffect(() => {
    const upd = () => setR(el.getBoundingClientRect());
    upd();
    const t = setInterval(upd, 100);
    window.addEventListener("resize", upd);
    return () => {
      clearInterval(t);
      window.removeEventListener("resize", upd);
    };
  }, [el]);
  return <div className="pointer-events-none fixed z-40 rounded-card ring-2 ring-accent ring-offset-2" style={{ top: r.top, left: r.left, width: r.width, height: r.height }} />;
}
