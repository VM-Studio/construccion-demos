"use client";
/**
 * Proveedor de datos del layout autenticado:
 * - Arranca con lo que mandó el servidor en el primer render (sin parpadeo).
 * - Cada colección es una clave SWR ["datos", coleccion] contra /api/datos.
 * - useSincronizacion(): consulta /api/cambios cada 3 s con la pestaña visible (15 s en segundo
 *   plano, al instante al volver el foco) y vuelve a pedir SOLO las colecciones afectadas.
 *   Si el cambio lo hizo otro usuario, muestra un aviso discreto (como mucho uno cada 5 s).
 */
import * as React from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR, { SWRConfig, useSWRConfig } from "swr";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import type { EstadoInicial } from "@/domain/types";
import { establecerDatos, obtenerDb } from "./almacen";
import { useStore } from "@/store";
import { coleccionesDe } from "@/lib/sincronizacion/dependencias";

export interface DatosIniciales {
  version: string;
  actorId: string;
  datos: Partial<EstadoInicial>;
}

const COLECCIONES = [
  "sucursales", "depositos", "usuarios", "unidadesNegocio", "rubros", "proveedores", "productos", "listasPrecios", "precios", "stock",
  "transferencias", "ajustes", "ordenesCompra", "recepciones", "acopiosProveedor", "clientes", "obras", "cotizaciones", "notasPedido",
  "devoluciones", "ajustesAcopio", "acopios", "remitos", "adjuntos", "comprobantes", "vehiculos", "choferes", "despachos", "hojasRuta",
  "cobranzas", "pagosProveedores", "cheques", "config", "numeradores",
] as const;
type Col = (typeof COLECCIONES)[number];
const ES_COLECCION = new Set<string>(COLECCIONES);

async function pedir(colecciones: string[]): Promise<Record<string, unknown>> {
  const r = await fetch(`/api/datos?c=${colecciones.join(",")}`, { cache: "no-store" });
  if (r.status === 401) {
    window.location.href = "/login";
    return {};
  }
  if (!r.ok) throw new Error(`No se pudieron leer los datos (${r.status})`);
  return ((await r.json()) as { datos: Record<string, unknown> }).datos;
}

// ── Refresco puntual (lo usan las acciones y la sincronización) ──
type Mutador = ReturnType<typeof useSWRConfig>["mutate"];
let mutadorGlobal: Mutador | null = null;
let ultimoCambio = "0";

/** Vuelve a pedir colecciones (en un solo request) y actualiza SWR y el almacén. */
export async function refrescarColecciones(cols: string[]) {
  const pedidas = cols.filter((c) => ES_COLECCION.has(c));
  const otras = cols.filter((c) => !ES_COLECCION.has(c));
  if (mutadorGlobal) for (const k of otras) void mutadorGlobal((key) => Array.isArray(key) && key[0] === k);
  if (!pedidas.length) return;
  const datos = await pedir(pedidas);
  establecerDatos(datos as Partial<EstadoInicial>);
  if (mutadorGlobal) for (const k of pedidas) void mutadorGlobal(["datos", k], datos[k], { revalidate: false });
}

/** Después de una acción propia: refresca lo que cambió sin esperar al polling. */
export async function aplicarResultadoPropio(tipos: string[]) {
  await refrescarColecciones(coleccionesDe(tipos));
}

function ColeccionSWR({ k, inicial }: { k: Col; inicial: unknown }) {
  const { data } = useSWR(["datos", k], async () => (await pedir([k]))[k], { fallbackData: inicial, keepPreviousData: true, dedupingInterval: 1000, revalidateOnFocus: false, revalidateOnMount: inicial === undefined, revalidateIfStale: false });
  React.useEffect(() => {
    if (data !== undefined) establecerDatos({ [k]: data } as Partial<EstadoInicial>);
  }, [k, data]);
  return null;
}

interface CambioRemoto {
  id: string;
  tipos: string[];
  usuarioId: string | null;
  resumen: string | null;
  href: string | null;
}

/** Polling de /api/cambios (3 s visible, 15 s oculta, al instante al volver el foco). */
function useSincronizacion(actorId: string) {
  const pathname = usePathname();
  const rapida = pathname.startsWith("/despachos");
  const pendientesAviso = React.useRef<CambioRemoto[]>([]);
  const ultimoAviso = React.useRef(0);

  React.useEffect(() => {
    let vivo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let enCurso = false;

    const avisar = () => {
      const lista = pendientesAviso.current;
      if (!lista.length || Date.now() - ultimoAviso.current < 5000) return;
      pendientesAviso.current = [];
      ultimoAviso.current = Date.now();
      const usuarios = obtenerDb().usuarios;
      const nombre = (id: string | null) => usuarios.find((u) => u.id === id)?.nombre.split(" ")[0] ?? "Otro usuario";
      const ult = lista.at(-1)!;
      const texto = lista.length === 1 ? `${nombre(ult.usuarioId)} ${ult.resumen ?? "hizo un cambio"}` : `${nombre(ult.usuarioId)} y otros hicieron ${lista.length} cambios`;
      toast(
        <span className="flex items-center gap-2 text-[13px]">
          <RefreshCw className="size-3.5 shrink-0 text-muted" />
          <span className="min-w-0 flex-1">{texto}</span>
          {lista.length === 1 && ult.href && (
            <Link href={ult.href} className="shrink-0 font-medium text-ink underline underline-offset-2">Ver</Link>
          )}
        </span>,
        { duration: 4000 },
      );
    };

    const consultar = async () => {
      if (enCurso) return;
      enCurso = true;
      try {
        const r = await fetch(`/api/cambios?desde=${ultimoCambio}`, { cache: "no-store" });
        if (r.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (r.ok) {
          const { ultimo, cambios } = (await r.json()) as { ultimo: string; cambios: CambioRemoto[] };
          const primera = ultimoCambio === "0";
          ultimoCambio = ultimo;
          if (!primera && cambios.length) {
            await refrescarColecciones(coleccionesDe(cambios.flatMap((c) => c.tipos)));
            const ajenos = cambios.filter((c) => c.usuarioId && c.usuarioId !== actorId);
            if (ajenos.length) pendientesAviso.current.push(...ajenos);
          }
          avisar();
        }
      } catch {
        // Sin conexión: se reintenta en el próximo ciclo.
      } finally {
        enCurso = false;
      }
    };

    const programar = () => {
      if (!vivo) return;
      const visible = document.visibilityState === "visible";
      timer = setTimeout(async () => {
        await consultar();
        programar();
      }, visible ? (rapida ? 2000 : 3000) : 15000);
    };
    const alVolver = () => {
      if (document.visibilityState === "visible") {
        if (timer) clearTimeout(timer);
        void consultar().then(programar);
      }
    };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
    void consultar().then(programar);
    return () => {
      vivo = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
    };
  }, [actorId, rapida]);
}

function Sincronizador({ actorId }: { actorId: string }) {
  const { mutate } = useSWRConfig();
  React.useEffect(() => {
    mutadorGlobal = mutate;
  }, [mutate]);
  useSincronizacion(actorId);
  return null;
}

export function DatosProvider({ actorId, inicial, children }: { actorId: string; inicial: DatosIniciales | null; children: React.ReactNode }) {
  // El primer render ya tiene los datos del servidor: se cargan antes de pintar.
  const primera = React.useRef(true);
  if (primera.current) {
    if (inicial) {
      establecerDatos(inicial.datos);
      ultimoCambio = inicial.version;
    }
    // La sesión visible en la interfaz es la del servidor (cookie), no la del navegador.
    if (useStore.getState().ui.usuarioId !== actorId) {
      const u = obtenerDb().usuarios.find((x) => x.id === actorId);
      useStore.setState((st) => ({ ui: { ...st.ui, usuarioId: actorId, sucursalActivaId: u?.sucursalId && u.rol !== "DUENO" && u.rol !== "ADMINISTRACION" ? u.sucursalId : st.ui.sucursalActivaId } }));
    }
  }
  primera.current = false;
  // Errores del navegador en Sentry con el id del usuario (nunca email ni nombre).
  React.useEffect(() => Sentry.setUser({ id: actorId }), [actorId]);
  const datos = inicial?.datos ?? {};
  return (
    <SWRConfig value={{ dedupingInterval: 1000, keepPreviousData: true }}>
      {COLECCIONES.map((k) => (
        <ColeccionSWR key={k} k={k} inicial={(datos as Record<string, unknown>)[k]} />
      ))}
      <Sincronizador actorId={actorId} />
      {children}
    </SWRConfig>
  );
}
