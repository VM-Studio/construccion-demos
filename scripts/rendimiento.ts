/**
 * Mediciones de rendimiento contra el branch `test` (`pnpm db:rendimiento`, después de
 * `pnpm db:seed:carga`). Dos partes:
 * 1. EXPLAIN (ANALYZE, BUFFERS) de las consultas de cada pantalla: tiempo de ejecución en el
 *    servidor de Postgres (mediana de 3), sin la latencia de red.
 * 2. Camino real de la app: lectura completa del estado (leerEstado) y cálculos en memoria.
 */
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

const env = path.resolve(__dirname, "../.env.test");
if (fs.existsSync(env)) for (const l of fs.readFileSync(env, "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const url = process.env.DIRECT_URL_TEST ?? process.env.DATABASE_URL_TEST;
if (!url || /ep-lingering-shape/.test(url)) throw new Error("Solo contra el branch test (.env.test)");

const CONSULTAS: [string, string][] = [
  ["Tablero · ventas del mes", `SELECT COALESCE(SUM("total"),0) FROM "Comprobante" WHERE "tipo"='FACTURA' AND "clienteId" IS NOT NULL AND "estado"<>'ANULADO' AND "fecha" >= date_trunc('month', now())`],
  ["Tablero · por cobrar", `SELECT COALESCE(SUM("saldoPendiente"),0) FROM "Comprobante" WHERE "clienteId" IS NOT NULL AND "estado" IN ('PENDIENTE','PARCIAL')`],
  ["Stock · posición de un depósito (vista)", `SELECT * FROM "v_stock_posicion" WHERE "depositoId" = (SELECT min("id") FROM "Deposito")`],
  ["Stock · posición de un artículo (vista)", `SELECT * FROM "v_stock_posicion" WHERE "productoId" = 'cg_p5000'`],
  ["Stock · vista completa", `SELECT count(*) FROM "v_stock_posicion"`],
  ["Stock · kardex de un artículo", `SELECT * FROM "MovimientoStock" WHERE "productoId"='cg_p5000' AND "depositoId"=(SELECT min("id") FROM "Deposito") ORDER BY "fecha" DESC, "id" DESC LIMIT 100`],
  ["Pendientes de entrega", `SELECT i."productoId", n."clienteId", n."fecha", i."cantidad" - i."entregados" - COALESCE(i."devueltos",0) AS pendiente
     FROM "ItemNP" i JOIN "NotaPedido" n ON n."id" = i."notaPedidoId"
     WHERE n."estado" IN ('PENDIENTE','ENTREGADA_PARCIAL') AND i."cantidad" - i."entregados" - COALESCE(i."devueltos",0) > 0 ORDER BY n."fecha" LIMIT 500`],
  ["Cuentas corrientes · saldos por cliente", `SELECT "clienteId", SUM("saldoPendiente") FROM "Comprobante" WHERE "clienteId" IS NOT NULL AND "estado" IN ('PENDIENTE','PARCIAL') GROUP BY 1`],
  ["Acopios · saldo de los vigentes", `SELECT a."id", a."importe" - COALESCE(np.s,0) + COALESCE(dp.s,0) + COALESCE(aj.s,0) AS saldo
     FROM "Acopio" a
     LEFT JOIN (SELECT "acopioId", SUM("total") s FROM "NotaPedido" WHERE "acopioId" IS NOT NULL AND "estado" NOT IN ('BORRADOR','ANULADA') GROUP BY 1) np ON np."acopioId" = a."id"
     LEFT JOIN (SELECT "acopioId", SUM("monto") s FROM "DevolucionNP" WHERE "acopioId" IS NOT NULL GROUP BY 1) dp ON dp."acopioId" = a."id"
     LEFT JOIN (SELECT "acopioId", SUM("monto") s FROM "AjusteAcopio" GROUP BY 1) aj ON aj."acopioId" = a."id"
     WHERE a."estado" IN ('VIGENTE','VENCIDO')`],
  ["Acopios · detalle de uno (NP + precios)", `SELECT n.*, (SELECT count(*) FROM "PrecioCongelado" p WHERE p."acopioId" = 'cg_a2500') FROM "NotaPedido" n WHERE n."acopioId" = 'cg_a2500' ORDER BY n."fecha"`],
  ["Remitos · en picking", `SELECT * FROM "Remito" WHERE "estado" = 'PICKING' ORDER BY "fecha" DESC LIMIT 100`],
  ["Remitos · últimos de una sucursal", `SELECT * FROM "Remito" WHERE "sucursalId" = (SELECT min("id") FROM "Sucursal") ORDER BY "fecha" DESC LIMIT 100`],
  ["Despachos del día", `SELECT * FROM "Despacho" WHERE "fechaProgramada" >= date_trunc('day', now()) AND "fechaProgramada" < date_trunc('day', now()) + interval '1 day' ORDER BY "fechaProgramada"`],
  ["Buscador · artículos (pg_trgm)", `SELECT "id" FROM "Producto" WHERE "nombre" ILIKE '%tornillo 77%' OR "nombre" % 'tornillo 77' ORDER BY similarity("nombre", 'tornillo 77') DESC LIMIT 50`],
  ["/api/cambios (1 M filas)", `SELECT c."id", c."tipos", c."entidadIds", c."usuarioId", c."resumen", c."href", u.m
     FROM (SELECT MAX("id") AS m FROM "Cambio") u
     LEFT JOIN LATERAL (SELECT * FROM "Cambio" WHERE "id" > (SELECT MAX("id") - 5 FROM "Cambio") ORDER BY "id" LIMIT 200) c ON true`],
  ["Versión del estado (MAX Cambio.id)", `SELECT MAX("id") FROM "Cambio"`],
];

async function main() {
  const c = new Client({ connectionString: url });
  await c.connect();
  const filas: { nombre: string; ms: number; plan: string }[] = [];
  for (const [nombre, sql] of CONSULTAS) {
    const tiempos: number[] = [];
    let plan = "";
    for (let i = 0; i < 3; i++) {
      const { rows } = await c.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`);
      const p = rows[0]["QUERY PLAN"][0];
      tiempos.push(p["Execution Time"] + p["Planning Time"]);
      plan = p.Plan["Node Type"];
    }
    tiempos.sort((a, b) => a - b);
    filas.push({ nombre, ms: tiempos[1], plan });
    console.log(`${tiempos[1] < 100 ? "✔" : "✘"} ${nombre.padEnd(44)} ${tiempos[1].toFixed(1).padStart(8)} ms   (${plan})`);
  }
  await c.end();
  fs.writeFileSync(path.resolve(__dirname, "../.rendimiento.json"), JSON.stringify(filas, null, 2));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
