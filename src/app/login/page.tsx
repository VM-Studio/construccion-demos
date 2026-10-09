import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginView } from "@/components/modulos/login-view";
import { obtenerActor } from "@/server/auth/actor";
import { hayUsuarios } from "@/server/auth/servicio";
import { obtenerEstado } from "@/server/estado";

export const metadata: Metadata = { title: "Ingresar" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ volver?: string; motivo?: string }> }) {
  if (!(await hayUsuarios())) redirect("/registro");
  if (await obtenerActor()) redirect("/inicio");
  const { volver, motivo } = await searchParams;
  const { db } = await obtenerEstado();
  return <LoginView empresa={db.config.empresa.empresa} volver={volver} motivo={motivo} />;
}
