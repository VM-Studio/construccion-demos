/**
 * Entorno de integración: toma la base de `.env.test` (o de DATABASE_URL_TEST en CI) y se niega a
 * correr contra producción. Se carga antes de importar Prisma en cada archivo de pruebas.
 */
import fs from "node:fs";
import path from "node:path";

export function cargarEntornoTest() {
  const archivo = path.resolve(__dirname, "../../.env.test");
  if (fs.existsSync(archivo)) {
    for (const linea of fs.readFileSync(archivo, "utf8").split("\n")) {
      const m = linea.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("Falta DATABASE_URL_TEST (.env.test o secret de CI)");
  if (/ep-lingering-shape/.test(url)) throw new Error("DATABASE_URL_TEST apunta a producción");
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = process.env.DIRECT_URL_TEST ?? url;
}

cargarEntornoTest();
