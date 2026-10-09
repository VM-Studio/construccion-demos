import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginView } from "@/components/modulos/login-view";
import { obtenerActor } from "@/server/auth/actor";
import { obtenerEstado } from "@/server/estado";

export const metadata: Metadata = { title: "Ingresar" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await obtenerActor()) redirect("/inicio");
  const { db } = await obtenerEstado();
  const usuarios = db.usuarios
    .filter((u) => u.activo)
    .map((u) => ({ id: u.id, nombre: u.nombre, rol: u.rol, avatarIniciales: u.avatarIniciales, sucursal: db.sucursales.find((s) => s.id === u.sucursalId)?.nombre }));
  return <LoginView empresa={db.config.empresa.empresa} usuarios={usuarios} />;
}
