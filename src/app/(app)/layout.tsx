import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { DatosProvider, type DatosIniciales } from "@/lib/datos/proveedor";
import { obtenerActor } from "@/server/auth/actor";
import { COLECCIONES_CLIENTE, estadoPara, seleccionar } from "@/server/lectura";

export const dynamic = "force-dynamic";

/**
 * Layout autenticado (servidor): exige sesión y, en la carga completa de la página, manda los
 * datos visibles para el actor para que el primer render sea instantáneo. En las navegaciones
 * internas no se reenvían: el cliente ya los tiene y se mantienen sincronizados.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await obtenerActor();
  if (!actor) redirect("/login");
  let inicial: DatosIniciales | null = null;
  if ((await headers()).get("rsc") !== "1") {
    const { version, db } = await estadoPara(actor);
    inicial = { version: String(version), actorId: actor.id, datos: seleccionar(db, [...COLECCIONES_CLIENTE, "config", "numeradores"]) };
  }
  return (
    <DatosProvider actorId={actor.id} inicial={inicial}>
      <AppShell>{children}</AppShell>
    </DatosProvider>
  );
}
