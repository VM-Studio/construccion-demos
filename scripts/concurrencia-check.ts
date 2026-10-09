/**
 * Pruebas de concurrencia del motor del servidor contra la base de DESARROLLO:
 * - dos NP simultáneas → números distintos y consecutivos;
 * - dos vendedores vendiendo el último disponible a la vez → uno pasa, el otro recibe el mensaje.
 * `pnpm db:test:concurrencia`
 */
import { prisma } from "../src/server/db-base";
import { ejecutarAccion } from "../src/server/motor";
import { obtenerEstado } from "../src/server/estado";
import { posicionesDe } from "../src/store/calculos";

if (/ep-lingering-shape/.test(process.env.DATABASE_URL ?? "")) throw new Error("No correr contra producción");

let fallas = 0;
const check = (n: string, c: boolean, d = "") => {
  if (!c) fallas++;
  console.log(`${c ? "✔" : "✘"} ${n}${d ? ` — ${d}` : ""}`);
};

async function main() {
  const { db } = await obtenerEstado();
  const felipe = db.usuarios.find((u) => u.rol === "DUENO")!;
  const lucas = db.usuarios.find((u) => u.rol === "VENTAS")!;
  const hoy = new Date().toISOString();
  const pid = "prod_50104";
  // La prueba se autoabastece: repone stock para tener disponible sobre el cual competir.
  const aj = await ejecutarAccion({ actor: felipe }, "crearAjuste", [{ depositoId: "dep_central", items: [{ productoId: pid, cantidad: 60, signo: 1, motivo: "SOBRANTE" }], observacion: "Prueba de concurrencia" }], { bloqueos: { stock: { productoIds: [pid], depositoIds: ["dep_central"] } } });
  check("Reposición para la prueba", aj.ok, aj.ok ? "+60 bolsas" : aj.error);
  const pos = posicionesDe((await obtenerEstado()).db).get(pid)!.porDeposito["dep_central"];
  console.log(`Holcim en Casa Central: físico ${pos.fisico}, pendiente ${pos.pendiente}, reservado ${pos.reservado}, disponible ${pos.disponible}`);

  // 1) Dos NP simultáneas con 1 bolsa cada una
  const venta = (cant: number) => ({ clienteId: "cli_bencen", sucursalId: "suc_central", depositoId: "dep_central", fecha: hoy, circuito: 1 as const, origen: "NUEVA" as const, formaPago: "CONTADO" as const, items: [{ productoId: pid, cantidad: cant, precioUnitario: 15000 }], descuentoPct: 0, pendienteEntrega: true, modalidadEntrega: "RETIRA" as const });
  const t0 = Date.now();
  const [a, b] = await Promise.all([
    ejecutarAccion({ actor: felipe }, "crearNotaPedido", [venta(1)], { bloqueos: { stock: { productoIds: [pid], depositoIds: ["dep_central"] } } }),
    ejecutarAccion({ actor: felipe }, "crearNotaPedido", [venta(1)], { bloqueos: { stock: { productoIds: [pid], depositoIds: ["dep_central"] } } }),
  ]);
  console.log(`  (dos NP en paralelo: ${Date.now() - t0} ms)`);
  check("Las dos NP se confirman", a.ok && b.ok, [a, b].map((x) => (x.ok ? "ok" : x.error)).join(" / "));
  if (a.ok && b.ok) {
    const nps = await prisma.notaPedido.findMany({ where: { id: { in: [a.data as string, b.data as string] } }, select: { numero: true } });
    const nums = nps.map((n) => Number(n.numero!.split("-").at(-1))).sort((x, y) => x - y);
    check("Números distintos y consecutivos", nums.length === 2 && nums[1] === nums[0] + 1, nps.map((n) => n.numero).join(" · "));
  }

  // 2) Dos vendedores venden TODO el disponible a la vez
  const { db: db2 } = await obtenerEstado();
  const disp = posicionesDe(db2).get(pid)!.porDeposito["dep_central"].disponible;
  const [c, d] = await Promise.all([
    ejecutarAccion({ actor: lucas }, "crearNotaPedido", [venta(disp)], { bloqueos: { stock: { productoIds: [pid], depositoIds: ["dep_central"] } } }),
    ejecutarAccion({ actor: lucas }, "crearNotaPedido", [venta(disp)], { bloqueos: { stock: { productoIds: [pid], depositoIds: ["dep_central"] } } }),
  ]);
  const okC = [c, d].filter((x) => x.ok).length;
  const rechazo = [c, d].find((x) => !x.ok) as { error: string; codigo?: string } | undefined;
  check(`Vender las últimas ${disp} bolsas en dos lugares a la vez: pasa una sola`, okC === 1, rechazo?.error);
  check("El rechazado recibe el mensaje de disponible", rechazo?.codigo === "SIN_DISPONIBLE" && /No hay disponible suficiente/.test(rechazo.error));
  const { db: db3 } = await obtenerEstado();
  check("Disponible queda en 0 (no se sobrevendió)", posicionesDe(db3).get(pid)!.porDeposito["dep_central"].disponible === 0);
  const cambios = await prisma.cambio.count();
  check("Cada escritura publicó un Cambio", cambios >= 3, `${cambios} cambios`);
  process.exitCode = fallas ? 1 : 0;
}
main().finally(() => prisma.$disconnect());
