import type { Metadata } from "next";
import Link from "next/link";
import { ShieldX } from "lucide-react";

export const metadata: Metadata = { title: "Sin acceso" };

/** Se muestra (con estado 403) cuando el rol del usuario no tiene permiso para la sección. */
export default function AccesoDenegadoPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-app px-4 text-center">
      <ShieldX className="size-8 text-muted" strokeWidth={1.5} />
      <h1 className="mt-3 text-title font-semibold tracking-tight">No tenés acceso a esta sección</h1>
      <p className="mt-1 max-w-sm text-[13px] text-muted">Tu rol no tiene permiso para verla. Si lo necesitás, pedíselo a un dueño.</p>
      <Link href="/inicio" className="mt-5 inline-flex h-9 items-center rounded-control bg-ink px-4 text-[13px] font-medium text-white hover:bg-ink-hover">Ir a Inicio</Link>
    </main>
  );
}
