/**
 * Middleware de acceso: todo exige sesión salvo las rutas públicas. Sin sesión → /login?volver=;
 * sesión invalidada (usuario desactivado o sesiones cerradas) → se borra la cookie y vuelve al
 * login con el motivo; contraseña temporal → /cambiar-password; sin permiso para la sección →
 * página 403. Las APIs responden JSON con 401/403 en lugar de redirigir.
 */
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { permisosDeRuta } from "@/config/modulos";
import { puede } from "@/domain/permisos";

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico|robots.txt).*)"],
};

// /api/adjuntos/upload: el webhook firmado de Vercel Blob llega sin sesión; la ruta verifica la
// firma y, para generar el token de subida, la sesión y el permiso.
const PUBLICAS = ["/login", "/registro", "/api/auth", "/api/salud", "/api/tipo-cambio/cron", "/api/mantenimiento/cron", "/api/adjuntos/upload"];
const COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

const esPublica = (req: NextRequest) => {
  const p = req.nextUrl.pathname;
  if (p === "/api/tipo-cambio" && req.method === "GET") return true;
  return PUBLICAS.some((x) => p === x || p.startsWith(`${x}/`));
};

const json = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export default auth((req) => {
  if (esPublica(req)) return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  const api = pathname.startsWith("/api/");
  const u = req.auth?.user;

  if (!u?.id) {
    if (api) return json(401, "Tenés que ingresar.");
    const url = new URL("/login", req.url);
    if (pathname !== "/" && pathname !== "/inicio") url.searchParams.set("volver", pathname + search);
    return NextResponse.redirect(url);
  }

  if (u.invalida) {
    const r = api ? json(401, u.invalida === "desactivado" ? "Tu usuario fue desactivado." : "Tu sesión se cerró.") : NextResponse.redirect(new URL(`/login?motivo=${u.invalida}`, req.url));
    for (const c of COOKIES) r.cookies.delete(c);
    return r;
  }

  if (u.debeCambiarPassword) {
    if (pathname === "/cambiar-password") return NextResponse.next();
    if (api) return json(403, "Tenés que cambiar tu contraseña temporal.");
    return NextResponse.redirect(new URL("/cambiar-password", req.url));
  }

  if (!api) {
    const permisos = permisosDeRuta(pathname);
    if (permisos.length && !permisos.some((p) => puede({ rol: u.rol, activo: true }, p))) return NextResponse.rewrite(new URL("/acceso-denegado", req.url), { status: 403 });
  }
  return NextResponse.next();
});
