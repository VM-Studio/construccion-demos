/**
 * Seed de producción: SOLO estructura (sucursales, depósitos y posiciones, unidades de negocio,
 * rubros, listas de precios, condiciones de pago, motivos de ajuste, configuración).
 * Sin usuarios (los crea el registro del primer dueño, R2) y sin datos de ejemplo.
 * Corre únicamente si la tabla Sucursal está vacía, así que es seguro en cada deploy.
 */
import { prisma } from "../src/server/db-base";
import { seedBase } from "../src/data/seed";
import { guardarConfig, insertar, type Coleccion } from "../src/server/datos/mapeo";
import { CONDICIONES_PAGO } from "./condiciones";

const ESTRUCTURA: Coleccion[] = ["unidadesNegocio", "sucursales", "depositos", "rubros", "listasPrecios"];



async function main() {
  if ((await prisma.sucursal.count()) > 0) {
    console.log("✔ La base ya tiene estructura: no se toca nada.");
    return;
  }
  const base = seedBase(new Date());
  await prisma.$transaction(
    async (tx) => {
      for (const k of ESTRUCTURA) for (const x of base[k] as object[]) await insertar(tx, k, x);
      await guardarConfig(tx, base.config);
      for (const [i, c] of CONDICIONES_PAGO.entries()) await tx.condicionPago.upsert({ where: { codigo: c.codigo }, create: { ...c, orden: i }, update: {} });
    },
    { timeout: 60_000 },
  );
  console.log(`✔ Estructura creada: ${base.sucursales.length} sucursales, ${base.depositos.length} depósitos, ${base.rubros.length} rubros, ${base.listasPrecios.length} listas de precios.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
