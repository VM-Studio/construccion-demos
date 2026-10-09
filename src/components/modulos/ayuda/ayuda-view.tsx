"use client";
import * as React from "react";
import Link from "next/link";
import { ChevronDown, Mail, MessageCircle } from "lucide-react";
import { IMPACTOS } from "@/capacitacion/impactos";
import { BRAND } from "@/config/brand";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Los 8 flujos del día a día: pasos con los textos del modo capacitación (IMPACTOS). */
const FLUJOS: { titulo: string; href: string; donde: string; pasos: string[] }[] = [
  { titulo: "Comprar y recibir mercadería", href: "/compras/ordenes", donde: "Compras → Órdenes de compra", pasos: ["crearOrdenCompra", "confirmarOrdenCompra", "registrarRecepcion"] },
  { titulo: "Vender (nota de pedido)", href: "/ventas/notas-pedido/nueva", donde: "Ventas → Notas de pedido → Nueva", pasos: ["crearCotizacion", "confirmarNotaPedidoNueva"] },
  { titulo: "Entregar con remito", href: "/remitos", donde: "Remitos", pasos: ["generarRemito", "marcarRemitoHecho", "subirRemitoFirmado"] },
  { titulo: "Facturar y cobrar", href: "/ventas/comprobantes", donde: "Ventas → Comprobantes y Recibos", pasos: ["facturarNotaPedido", "registrarCobro"] },
  { titulo: "Abrir un acopio", href: "/acopios", donde: "Clientes → Acopios de clientes", pasos: ["crearAcopio"] },
  { titulo: "Retirar de un acopio", href: "/acopios", donde: "Acopio → Nuevo retiro", pasos: ["confirmarNotaPedidoAcopio", "traspasarSaldoAcopio"] },
  { titulo: "Registrar una devolución", href: "/ventas/devoluciones", donde: "Ventas → Devoluciones", pasos: ["crearDevolucion"] },
  { titulo: "Despachar y entregar", href: "/despachos", donde: "Logística → Despachos", pasos: ["programarEntrega", "iniciarPreparacion", "finalizarDespacho", "marcarEntregado"] },
];

const PREGUNTAS: { p: string; r: React.ReactNode }[] = [
  {
    p: "¿Dónde están mis datos?",
    r: <>En una base de datos PostgreSQL en la nube (Neon, servidores de Amazon en Estados Unidos), cifrada, con historial para volver atrás. Los archivos adjuntos (remitos firmados, fotos) están en almacenamiento privado de Vercel. Además se hace una copia propia todas las noches en otro proveedor (Cloudflare R2), que se guarda 35 días y una por mes durante un año.</>,
  },
  {
    p: "¿Qué pasa si se corta internet?",
    r: <>El sistema funciona en línea: sin internet no se puede cargar nada nuevo. Lo que ya estaba en pantalla se puede seguir viendo. Cuando vuelve la conexión, el sistema se actualiza solo con lo que cargaron los demás. Si se cortó en medio de un guardado, revisá que el documento aparezca en el listado antes de volver a cargarlo.</>,
  },
  {
    p: "¿Cómo agrego un usuario?",
    r: <>Un dueño entra a <Link className="underline" href="/configuracion?tab=usuarios">Configuración → Usuarios y roles</Link> → &quot;Nuevo usuario&quot;. El sistema genera una contraseña temporal que se muestra una sola vez: con &quot;Copiar datos de acceso&quot; se la mandás por WhatsApp. Al entrar, la persona elige su propia contraseña. Si alguien se olvida la suya, otro dueño la restablece desde la misma pantalla.</>,
  },
  {
    p: "¿Qué hago si el dólar no se actualiza?",
    r: <>El dólar se toma solo del Banco Nación (divisa vendedor) dos veces por día hábil; si el banco no responde se usa el dólar mayorista como respaldo y se avisa en pantalla. Si igual queda desactualizado, un dueño o administración puede tocar &quot;Actualizar ahora&quot; o cargar un valor manual en <Link className="underline" href="/configuracion?tab=parametros">Configuración → Parámetros</Link>, y volver al modo automático cuando el banco se normalice.</>,
  },
  {
    p: "¿Cómo descargo todos mis datos?",
    r: <>Un dueño entra a <Link className="underline" href="/configuracion?tab=demo">Configuración → Datos</Link> → &quot;Exportar respaldo&quot;. Se descarga un ZIP con una planilla por tabla (se abre con Excel) y un archivo con todo junto. Cada listado tiene además su botón para descargar en Excel o PDF.</>,
  },
  {
    p: "¿Puedo apagar las explicaciones del modo capacitación?",
    r: <>Sí. Los dueños y administración lo apagan con el ícono del birrete en la barra superior o desde Configuración → Datos.</>,
  },
];

function Flujo({ f, n }: { f: (typeof FLUJOS)[number]; n: number }) {
  const [abierto, setAbierto] = React.useState(n === 1);
  return (
    <div className="border-b border-border last:border-0">
      <button type="button" onClick={() => setAbierto(!abierto)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-subtle/60">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-subtle text-[12px] font-semibold">{n}</span>
        <span className="flex-1 font-medium">{f.titulo}</span>
        <span className="hidden text-[12px] text-muted sm:inline">{f.donde}</span>
        <ChevronDown className={cn("size-4 text-muted transition-transform", abierto && "rotate-180")} />
      </button>
      {abierto && (
        <div className="space-y-3 px-4 pb-4 pl-[52px]">
          {f.pasos.map((id) => {
            const imp = IMPACTOS[id];
            if (!imp) return null;
            return (
              <div key={id}>
                <p className="text-[13px] font-medium">{imp.titulo}</p>
                <p className="text-[13px] text-muted">{imp.resumen}</p>
                <ul className="mt-1 space-y-0.5 text-[12px] text-muted">
                  {imp.efectos.slice(0, 4).map((e, i) => (
                    <li key={i}>
                      → <Link className="underline-offset-2 hover:underline" href={e.href}>{e.modulo} · {e.pagina}</Link>: {e.que}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <Link href={f.href} className="inline-block text-[13px] font-medium text-accent underline-offset-2 hover:underline">Ir a {f.donde} →</Link>
        </div>
      )}
    </div>
  );
}

export function AyudaView({ soporte }: { soporte: { email: string | null; whatsapp: string | null } }) {
  const wa = soporte.whatsapp?.replace(/\D/g, "");
  return (
    <>
      <PageHeader titulo="Ayuda" descripcion="Cómo se usa el sistema, preguntas frecuentes y contacto de soporte." />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Los 8 flujos del día a día</CardTitle></CardHeader>
            <div>{FLUJOS.map((f, i) => <Flujo key={f.titulo} f={f} n={i + 1} />)}</div>
          </Card>
          <Card>
            <CardHeader><CardTitle>Preguntas frecuentes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {PREGUNTAS.map((q) => (
                <div key={q.p}>
                  <p className="text-[13px] font-medium">{q.p}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{q.r}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Soporte de {BRAND.agencia}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-[13px]">
              <p className="text-muted">¿Algo no funciona o tenés una duda que no está acá? Escribinos.</p>
              {wa && (
                <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-control border border-border px-3 py-2 hover:bg-subtle">
                  <MessageCircle className="size-4 text-muted" /> WhatsApp · +{wa}
                </a>
              )}
              {soporte.email && (
                <a href={`mailto:${soporte.email}`} className="flex items-center gap-2 rounded-control border border-border px-3 py-2 hover:bg-subtle">
                  <Mail className="size-4 text-muted" /> {soporte.email}
                </a>
              )}
              {!wa && !soporte.email && <p className="text-muted">Pedile los datos de contacto a quien te dio acceso al sistema.</p>}
              <p className="text-[12px] text-muted">Al escribir, contanos qué estabas haciendo y, si podés, mandá una captura de pantalla.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
