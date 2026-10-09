/**
 * Carga de volumen para medir rendimiento (`pnpm db:seed:carga`), SOLO contra el branch `test` de
 * Neon (`.env.test`). Bloqueado en Vercel y en producción. Agrega, sobre los datos de ejemplo:
 * 10.000 artículos (con stock y precios), 2.000 clientes, 500 proveedores, 5.000 acopios (20
 * precios congelados c/u), 20.000 notas de pedido de un año (60.000 ítems; ≈1.100 abiertas, las
 * del último mes), 15.000 remitos, 5.000
 * comprobantes, 2.000 despachos, 200.000 movimientos de stock y 1.000.000 de filas de Cambio.
 * Todo con SQL (generate_series): tarda segundos, no minutos.
 */
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

if (process.env.VERCEL === "1" || process.env.NODE_ENV === "production") {
  console.error("✘ db:seed:carga está bloqueado en Vercel y en producción.");
  process.exit(1);
}
const env = path.resolve(__dirname, "../.env.test");
if (fs.existsSync(env)) for (const l of fs.readFileSync(env, "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const url = process.env.DIRECT_URL_TEST ?? process.env.DATABASE_URL_TEST;
if (!url) throw new Error("Falta DIRECT_URL_TEST / DATABASE_URL_TEST (.env.test)");
if (/ep-lingering-shape/.test(url)) throw new Error("Apunta a producción: db:seed:carga solo corre contra el branch test");

const PASOS: [string, string][] = [
  ["Limpieza de una carga anterior", `
    DELETE FROM "Cambio" WHERE "resumen" = 'carga';
    DELETE FROM "MovimientoStock" WHERE "id" LIKE 'cg_%';
    DELETE FROM "ItemDespacho" WHERE "despachoId" LIKE 'cg_%'; DELETE FROM "Despacho" WHERE "id" LIKE 'cg_%';
    DELETE FROM "Comprobante" WHERE "id" LIKE 'cg_%';
    DELETE FROM "Remito" WHERE "id" LIKE 'cg_%';
    DELETE FROM "NotaPedido" WHERE "id" LIKE 'cg_%';
    DELETE FROM "Acopio" WHERE "id" LIKE 'cg_%';
    DELETE FROM "PrecioProducto" WHERE "id" LIKE 'cg_%'; DELETE FROM "StockDeposito" WHERE "id" LIKE 'cg_%';
    DELETE FROM "Producto" WHERE "id" LIKE 'cg_%'; DELETE FROM "Cliente" WHERE "id" LIKE 'cg_%'; DELETE FROM "Proveedor" WHERE "id" LIKE 'cg_%';`],
  ["10.000 artículos", `
    WITH r AS (SELECT array_agg("id" ORDER BY "id") ids, array_agg("unidadNegocioId" ORDER BY "id") uns FROM "Rubro")
    INSERT INTO "Producto" ("id","codigo","nombre","rubroId","unidadNegocioId","marca","unidad","costoUltimo","costoPromedio","fechaUltimoCosto","stockMinimo","activo","actualizadoEn")
    SELECT 'cg_p'||i, 'CG'||lpad(i::text,6,'0'), 'Artículo de carga '||i||' '||(ARRAY['cemento','hierro','ladrillo','tornillo','pintura','cable','caño','placa'])[1+i%8],
      r.ids[1+i%array_length(r.ids,1)], r.uns[1+i%array_length(r.ids,1)], 'Marca '||(i%40), (ARRAY['UN','BOLSA','KG','M2']::"Unidad"[])[1+i%4],
      100+i%5000, 100+i%5000, now(), i%50, true, now()
    FROM generate_series(1,10000) i, r;`],
  ["Stock y precios de los artículos", `
    INSERT INTO "StockDeposito" ("id","productoId","depositoId","cantidadFisica","actualizadoEn")
    SELECT 'cg_s'||p.n||'_'||d."id", 'cg_p'||p.n, d."id", 0, now() FROM generate_series(1,10000) p(n), "Deposito" d;
    INSERT INTO "PrecioProducto" ("id","productoId","listaPreciosId","precio","actualizadoEn")
    SELECT 'cg_pp'||p.n||'_'||l."id", 'cg_p'||p.n, l."id", round((100+p.n%5000)*(1+l."markupPorDefecto"/100.0),2), now() FROM generate_series(1,10000) p(n), "ListaPrecios" l;`],
  ["2.000 clientes y 500 proveedores", `
    WITH s AS (SELECT min("id") suc FROM "Sucursal"), l AS (SELECT min("id") lista FROM "ListaPrecios")
    INSERT INTO "Cliente" ("id","codigo","razonSocial","tipo","cuit","condicionIVA","circuitoHabitual","email","telefono","direccion","localidad","listaPreciosId","condicionPago","limiteCredito","sucursalPreferidaId","actualizadoEn")
    SELECT 'cg_c'||i, 'CGC'||lpad(i::text,5,'0'), 'Cliente de carga '||i||' S.A.', (ARRAY['CONSTRUCTORA','PARTICULAR','ARQUITECTO']::"TipoCliente"[])[1+i%3], '30'||lpad(i::text,8,'0')||'1',
      'RI', 1+i%2, 'cliente'||i||'@carga.test', '11'||lpad(i::text,8,'0'), 'Calle '||i, 'CABA', l.lista, 'CTA_CTE_30', 5000000, s.suc, now()
    FROM generate_series(1,2000) i, s, l;
    INSERT INTO "Proveedor" ("id","codigo","razonSocial","tipo","cuit","condicionIVA","circuitoHabitual","email","telefono","direccion","contacto","plazoEntregaDias","condicionPago","unidadNegocioIds","actualizadoEn")
    SELECT 'cg_v'||i, 'CGV'||lpad(i::text,4,'0'), 'Proveedor de carga '||i, 'DISTRIBUIDOR', '30'||lpad((90000000+i)::text,8,'0')||'2', 'RI', 1, 'prov'||i||'@carga.test', '11'||i, 'Ruta '||i, 'Contacto', 7, 'CTA_CTE_30', '{}', now()
    FROM generate_series(1,500) i;`],
  ["5.000 acopios con 20 precios congelados cada uno", `
    WITH s AS (SELECT min("id") suc FROM "Sucursal"), d AS (SELECT min("id") dep FROM "Deposito"), u AS (SELECT min("id") usr FROM "Usuario"),
         l AS (SELECT min("id") lista FROM "ListaPrecios"), un AS (SELECT min("id") un FROM "UnidadNegocio")
    INSERT INTO "Acopio" ("id","numero","circuito","clienteId","sucursalId","depositoId","vendedorId","obraIds","fechaCreacion","fechaVencimiento","importe","alicuotaIIBBPct","importeConIIBB","formaPago","listaPreciosBaseId","unidadNegocioId","comprobanteIds","reciboIds","estado","actualizadoEn")
    SELECT 'cg_a'||i, 'AC'||(1+i%2)||' 0009-'||lpad(i::text,8,'0'), 1+i%2, 'cg_c'||(1+i%2000), s.suc, d.dep, coalesce(u.usr,'sin-usuario'), '{}', now()-(i%300||' days')::interval, now()+((i%120)-30||' days')::interval,
      1000000+(i%50)*10000, 0, 1000000+(i%50)*10000, (ARRAY['ANTICIPO','CUENTA_CORRIENTE']::"FormaPagoAcopio"[])[1+i%2], l.lista, un.un, '{}', '{}', (ARRAY['VIGENTE','VIGENTE','VENCIDO','AGOTADO']::"EstadoAcopio"[])[1+i%4], now()
    FROM generate_series(1,5000) i, s, d, u, l, un;
    INSERT INTO "PrecioCongelado" ("id","acopioId","orden","productoId","precio","costoSnapshot")
    SELECT 'cg_pc'||a||'_'||k, 'cg_a'||a, k, 'cg_p'||(1+(a*7+k*131)%10000), 500+k*10, 300+k*5 FROM generate_series(1,5000) a, generate_series(1,20) k;`],
  ["20.000 notas de pedido (60.000 ítems)", `
    WITH s AS (SELECT min("id") suc FROM "Sucursal"), d AS (SELECT min("id") dep FROM "Deposito"), u AS (SELECT min("id") usr FROM "Usuario")
    INSERT INTO "NotaPedido" ("id","numero","circuito","tipo","origen","acopioId","clienteId","sucursalId","depositoId","vendedorId","fecha","fechaConfirmacion","monto","descuentoPct","iva","total","estado","formaPago","condicionPago","pendienteEntrega","modalidadEntrega","remitoIds","comprobanteIds","moneda","actualizadoEn")
    SELECT 'cg_n'||i, 'NP'||(1+i%2)||' 0009-'||lpad(i::text,8,'0'), 1+i%2, CASE WHEN i%4=0 THEN 'RETIRO_ACOPIO' ELSE 'VENTA' END::"TipoNotaPedido", CASE WHEN i%4=0 THEN 'ACOPIO' ELSE 'NUEVA' END::"OrigenVenta",
      CASE WHEN i%4=0 THEN 'cg_a'||(1+i%5000) END, 'cg_c'||(1+i%2000), s.suc, d.dep, coalesce(u.usr,'sin-usuario'), now()-(i%365||' days')::interval, now()-(i%365||' days')::interval,
      30000, 0, 6300, 36300,
      -- Solo las NP del último mes pueden seguir abiertas (≈1.100 pendientes o parciales); las viejas están entregadas o anuladas.
      CASE WHEN i%365 < 30 THEN (ARRAY['PENDIENTE','ENTREGADA','ENTREGADA','ENTREGADA_PARCIAL','ENTREGADA','ANULADA']::"EstadoNP"[])[1+i%6]
           ELSE (ARRAY['ENTREGADA','ENTREGADA','ENTREGADA','ENTREGADA','ENTREGADA','ANULADA']::"EstadoNP"[])[1+i%6] END,
      CASE WHEN i%4=0 THEN 'ACOPIO' ELSE 'CUENTA_CORRIENTE' END::"FormaPagoVenta", 'CTA_CTE_30', i%3=0, (ARRAY['ENVIO','RETIRA']::"ModalidadEntrega"[])[1+i%2], '{}', '{}', 'ARS', now()
    FROM generate_series(1,20000) i, s, d, u;
    INSERT INTO "ItemNP" ("id","notaPedidoId","orden","productoId","cantidad","entregados","devueltos","precioUnitario","costoUnitarioSnapshot","descuentoPct","subtotal")
    SELECT 'cg_ni'||i||'_'||k, 'cg_n'||i, k, 'cg_p'||(1+(i*3+k*17)%10000), 10, CASE WHEN i%365 >= 30 OR i%6 IN (1,2,4) THEN 10 WHEN i%6=3 THEN 5 ELSE 0 END, 0, 1000, 600, 0, 10000
    FROM generate_series(1,20000) i, generate_series(1,3) k;`],
  ["15.000 remitos (30.000 ítems)", `
    INSERT INTO "Remito" ("id","numero","circuito","tipo","notaPedidoId","clienteId","sucursalId","depositoId","fecha","cantidadTotal","pesoTotalKg","valorDeclarado","estado","facturado","facturasRef","actualizadoEn")
    SELECT 'cg_r'||i, 'RM'||(1+i%2)||' 00099-'||lpad(i::text,8,'0'), 1+i%2, 'VENTA', 'cg_n'||i, n."clienteId", n."sucursalId", n."depositoId", n."fecha", 20, 50, 20000,
      (ARRAY['HECHO','HECHO','HECHO','PICKING','INICIAL']::"EstadoRemito"[])[1+i%5], i%2=0, '{}', now()
    FROM generate_series(1,15000) i JOIN "NotaPedido" n ON n."id" = 'cg_n'||i;
    INSERT INTO "ItemRemito" ("id","remitoId","orden","productoId","cantidad","itemNPId","nroSerie")
    SELECT 'cg_ri'||i||'_'||k, 'cg_r'||i, k, 'cg_p'||(1+(i*3+k*17)%10000), 5, 'cg_ni'||i||'_'||k, '{}' FROM generate_series(1,15000) i, generate_series(1,2) k;`],
  ["5.000 comprobantes", `
    INSERT INTO "Comprobante" ("id","tipo","letra","circuito","numero","clienteId","notaPedidoId","sucursalId","fecha","vencimiento","subtotal","iva","total","saldoPendiente","estado","actualizadoEn")
    SELECT 'cg_f'||i, 'FACTURA', 'A', 1, 'F1 0009-'||lpad(i::text,8,'0'), 'cg_c'||(1+i%2000), 'cg_n'||i, n."sucursalId", now()-(i%365||' days')::interval, now()-((i%365)-30||' days')::interval,
      30000, 6300, 36300, CASE WHEN i%3=0 THEN 36300 ELSE 0 END, CASE WHEN i%3=0 THEN 'PENDIENTE' ELSE 'PAGADO' END::"EstadoComprobante", now()
    FROM generate_series(1,5000) i JOIN "NotaPedido" n ON n."id" = 'cg_n'||i;`],
  ["2.000 despachos (100 de hoy)", `
    INSERT INTO "Despacho" ("id","numero","sucursalId","depositoId","clienteId","notaPedidoId","modalidad","estado","posicion","fechaProgramada","fechaEspera","direccionEntrega","actualizadoEn")
    SELECT 'cg_d'||i, 'DS 0009-'||lpad(i::text,8,'0'), n."sucursalId", n."depositoId", n."clienteId", n."id", 'ENVIO', (ARRAY['ESPERA','PREPARACION','FINALIZADO','ENTREGADO']::"EstadoDespacho"[])[1+i%4], 'Playa 1',
      CASE WHEN i<=100 THEN date_trunc('day', now()) + ((i%10)||' hours')::interval ELSE now()-(i||' hours')::interval END, now()-(i||' hours')::interval, 'Calle '||i, now()
    FROM generate_series(1,2000) i JOIN "NotaPedido" n ON n."id" = 'cg_n'||i;`],
  ["200.000 movimientos de stock", `
    WITH d AS (SELECT array_agg("id" ORDER BY "id") deps FROM "Deposito"), u AS (SELECT min("id") usr FROM "Usuario")
    INSERT INTO "MovimientoStock" ("id","productoId","depositoId","tipo","cantidad","signo","costoUnitario","referenciaTipo","referenciaId","usuarioId","fecha","actualizadoEn")
    SELECT 'cg_m'||i, 'cg_p'||(1+i%10000), d.deps[1+i%array_length(d.deps,1)], CASE WHEN i%3=0 THEN 'EGRESO_VENTA' ELSE 'INGRESO_COMPRA' END::"TipoMovimientoStock", 5, CASE WHEN i%3=0 THEN -1 ELSE 1 END,
      100+i%5000, CASE WHEN i%3=0 THEN 'REMITO' ELSE 'OC' END::"ReferenciaTipo", 'cg_ref'||i, coalesce(u.usr,'sin-usuario'), now()-((i%720)||' hours')::interval, now()
    FROM generate_series(1,200000) i, d, u;
    UPDATE "StockDeposito" s SET "cantidadFisica" = f.q FROM (SELECT "productoId","depositoId", SUM("signo"*"cantidad") q FROM "MovimientoStock" WHERE "id" LIKE 'cg_%' GROUP BY 1,2) f
    WHERE s."productoId" = f."productoId" AND s."depositoId" = f."depositoId";`],
  ["1.000.000 de filas de Cambio", `
    INSERT INTO "Cambio" ("tipos","entidadIds","usuarioId","resumen","creadoEn")
    SELECT ARRAY['NotaPedido'], ARRAY['cg_n'||(1+i%20000)], NULL, 'carga', now()-((1000000-i)||' seconds')::interval FROM generate_series(1,1000000) i;`],
  ["ANALYZE", `ANALYZE;`],
];

/**
 * `--liviana`: sin los 200.000 movimientos ni el millón de Cambio (no entran al estado en memoria).
 * Con el plan gratuito de Neon los 512 MB son de TODO el proyecto, producción incluida: la carga
 * completa (~360 MB) solo conviene con el plan Launch. Al terminar: `neonctl branches reset test --parent`.
 */
const LIVIANA = process.argv.includes("--liviana");

async function main() {
  const c = new Client({ connectionString: url });
  await c.connect();
  const t0 = Date.now();
  for (const [nombre, sql] of PASOS) {
    if (LIVIANA && /movimientos de stock|filas de Cambio/.test(nombre)) continue;
    const t = Date.now();
    await c.query(sql);
    console.log(`✔ ${nombre} (${((Date.now() - t) / 1000).toFixed(1)} s)`);
  }
  const { rows } = await c.query(`SELECT (SELECT count(*) FROM "Producto") p, (SELECT count(*) FROM "Cliente") c, (SELECT count(*) FROM "Proveedor") v, (SELECT count(*) FROM "Acopio") a, (SELECT count(*) FROM "MovimientoStock") m, (SELECT count(*) FROM "Cambio") ca`);
  console.log(`\nTotal: ${JSON.stringify(rows[0])} en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await c.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
