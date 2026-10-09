import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CambiarPasswordView } from "@/components/modulos/auth/cambiar-password-view";
import { obtenerEstado } from "@/server/estado";

export const metadata: Metadata = { title: "Cambiar contraseña" };
export const dynamic = "force-dynamic";

export default async function CambiarPasswordPage() {
  const s = await auth();
  if (!s?.user?.id || s.user.invalida) redirect("/login");
  if (!s.user.debeCambiarPassword) redirect("/inicio");
  const { db } = await obtenerEstado();
  return <CambiarPasswordView empresa={db.config.empresa.empresa} email={s.user.email ?? ""} />;
}
