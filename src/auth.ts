/**
 * Auth.js v5 — ingreso con email y contraseña, sesión JWT en cookie httpOnly (secure en
 * producción, sameSite lax). La sesión dura 12 h y se renueva al usarla; con "Mantener sesión
 * iniciada", 30 días. En cada uso se compara `sesionVersion` y `activo` con la base (caché 60 s):
 * si un dueño cerró las sesiones o desactivó al usuario, la sesión deja de valer.
 */
import NextAuth, { CredentialsSignin, type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import type { Rol } from "@/domain/types";
import { estadoSesion, verificarCredenciales } from "@/server/auth/servicio";

const DOCE_HORAS = 12 * 60 * 60 * 1000;
const TREINTA_DIAS = 30 * 24 * 60 * 60 * 1000;

declare module "next-auth" {
  interface Session {
    user: { id: string; rol: Rol; sucursalId: string | null; debeCambiarPassword: boolean; invalida?: "desactivado" | "sesion" } & DefaultSession["user"];
  }
}

export class IngresoBloqueado extends CredentialsSignin {
  code = "bloqueado";
}
export class UsuarioInactivo extends CredentialsSignin {
  code = "inactivo";
}

const esquemaIngreso = z.object({ email: z.string().trim().min(3).max(200), password: z.string().min(1).max(200), recordar: z.enum(["si", "no"]).optional() });

type Token = {
  uid?: string;
  rol?: Rol;
  suc?: string | null;
  sv?: number;
  dcp?: boolean;
  recordar?: boolean;
  vence?: number;
  invalida?: "desactivado" | "sesion";
  name?: string | null;
  email?: string | null;
};

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60, updateAge: 5 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, recordar: {} },
      authorize: async (crudo, request) => {
        const d = esquemaIngreso.safeParse(crudo);
        if (!d.success) return null;
        const h = request.headers;
        const r = await verificarCredenciales(d.data.email, d.data.password, { ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined, userAgent: h.get("user-agent") ?? undefined });
        if (!r.ok) {
          if (r.motivo === "bloqueado") throw new IngresoBloqueado();
          if (r.motivo === "inactivo") throw new UsuarioInactivo();
          return null;
        }
        const u = r.usuario;
        return { id: u.id, name: u.nombre, email: u.email, rol: u.rol, sucursalId: u.sucursalId, sesionVersion: u.sesionVersion, debeCambiarPassword: u.debeCambiarPassword, recordar: d.data.recordar === "si" } as never;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      const t = token as Token;
      const ahora = Date.now();
      if (user) {
        const u = user as unknown as { id: string; rol: Rol; sucursalId: string | null; sesionVersion: number; debeCambiarPassword: boolean; recordar: boolean };
        t.uid = u.id;
        t.rol = u.rol;
        t.suc = u.sucursalId;
        t.sv = u.sesionVersion;
        t.dcp = u.debeCambiarPassword;
        t.recordar = u.recordar;
        t.vence = ahora + (u.recordar ? TREINTA_DIAS : DOCE_HORAS);
        delete t.invalida;
        return token;
      }
      if (!t.uid || t.invalida) return token;
      if (!t.vence || ahora > t.vence) return null;
      const e = await estadoSesion(t.uid);
      if (!e) return null;
      if (!e.activo) return { ...token, invalida: "desactivado" };
      if (e.sesionVersion !== t.sv) return { ...token, invalida: "sesion" };
      t.rol = e.rol;
      t.suc = e.sucursalId;
      t.name = e.nombre;
      t.dcp = trigger === "update" && session && typeof (session as { debeCambiarPassword?: boolean }).debeCambiarPassword === "boolean" ? (session as { debeCambiarPassword: boolean }).debeCambiarPassword : e.debeCambiarPassword;
      // Renovación al usar: la ventana de 12 h (o 30 días) se corre con cada uso.
      t.vence = ahora + (t.recordar ? TREINTA_DIAS : DOCE_HORAS);
      return token;
    },
    async session({ session, token }) {
      const t = token as Token;
      session.user = { ...session.user, id: t.uid ?? "", name: t.name ?? session.user?.name, rol: t.rol ?? "VENTAS", sucursalId: t.suc ?? null, debeCambiarPassword: !!t.dcp, invalida: t.invalida };
      return session;
    },
  },
});
