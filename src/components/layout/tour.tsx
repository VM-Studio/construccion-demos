"use client";
import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { useStore } from "@/store";
import { useUsuario } from "@/store/selectors";
import { Button } from "@/components/ui/button";

interface Paso {
  selector: string;
  titulo: string;
  texto: string;
  lado: "top" | "right" | "bottom" | "left";
}

const PASOS: Paso[] = [
  { selector: '[data-tour="kpis"]', titulo: "1 · Los números del negocio", texto: "Ventas, margen bruto, lo que hay por cobrar y la deuda de mercadería de los acopios. Todo sale de las operaciones reales y respeta la sucursal elegida arriba.", lado: "bottom" },
  { selector: '[data-tour="alertas"]', titulo: "2 · Alertas", texto: "Stock bajo mínimo, acopios por vencer, deuda vencida, compras atrasadas y despachos del día. Cada una lleva directo a resolverla.", lado: "left" },
  { selector: '[data-tour="stock-rubro"]', titulo: "3 · Stock y valorización", texto: "Cuánto vale el inventario por rubro y depósito a costo promedio. En Stock ves físico, comprometido y disponible con trazabilidad de cada movimiento.", lado: "top" },
  { selector: '[data-tour="nav-compras"]', titulo: "4 · Compras → ingreso de mercadería", texto: "Órdenes de compra y recepción: al ingresar, se actualiza el stock, el costo promedio y te avisa si conviene subir precios.", lado: "right" },
  { selector: '[data-tour="nav-ventas"]', titulo: "5 · Ventas y rentabilidad por pedido", texto: "Presupuesto → pedido → factura. Cada pedido congela el costo del momento y muestra su margen real y cuánto sería vendiendo hoy.", lado: "right" },
  { selector: '[data-tour="nav-acopios"]', titulo: "6 · Acopios y deuda de mercadería", texto: "Lo que el cliente pagó y retira en partes. El sistema muestra cuánto debemos entregar y cuánto se achicó el margen por la suba de costos.", lado: "right" },
  { selector: '[data-tour="nav-reportes"]', titulo: "7 · Reportes y exportación", texto: "Ventas, rentabilidad, valorización, cobranzas, despachos y auditoría. Todo se exporta a CSV o se imprime en PDF.", lado: "right" },
];

/** Recorrido guiado de 7 pasos (Popover de Radix anclado a elementos). */
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
    if (usuario?.rol === "DUENO" && !visto && pathname === "/tablero" && !abierto) {
      const t = setTimeout(abrir, 1500);
      return () => clearTimeout(t);
    }
  }, [usuario?.rol, visto, pathname, abierto, abrir]);

  React.useEffect(() => {
    if (abierto) {
      setPaso(0);
      if (pathname !== "/tablero") router.push("/tablero");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  React.useEffect(() => {
    if (!abierto) return;
    let intentos = 0;
    const buscar = () => {
      const els = Array.from(document.querySelectorAll<HTMLElement>(PASOS[paso].selector)).filter((e) => e.offsetParent !== null);
      if (els[0]) {
        els[0].scrollIntoView({ behavior: "smooth", block: "center" });
        setAncla(els[0]);
      } else if (intentos++ < 10) setTimeout(buscar, 200);
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
