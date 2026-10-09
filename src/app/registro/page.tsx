import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RegistroView } from "@/components/modulos/auth/registro-view";
import { hayUsuarios } from "@/server/auth/servicio";
import { obtenerActor } from "@/server/auth/actor";
import { obtenerEstado } from "@/server/estado";

export const metadata: Metadata = { title: "Crear cuenta de dueño" };
export const dynamic = "force-dynamic";

/** Solo existe mientras no haya ningún usuario: después responde 404. */
export default async function RegistroPage() {
  if (await hayUsuarios()) {
    // Recién registrado (la acción vuelve a renderizar esta ruta con la sesión ya iniciada).
    if (await obtenerActor()) redirect("/inicio");
    notFound();
  }
  const { db } = await obtenerEstado();
  return <RegistroView empresa={db.config.empresa.empresa} />;
}
