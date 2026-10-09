/**
 * Respaldo descargable (Configuración → Datos): ZIP con un CSV por tabla y un JSON completo,
 * generado en el servidor con streaming (páginas de 2.000 filas por clave primaria: nunca se
 * carga toda la base en memoria). Las columnas privadas de Usuario no salen.
 */
import { Prisma } from "@prisma/client";
import { strToU8, Zip, ZipDeflate } from "fflate";
import { prisma } from "../db";

const PAGINA = 2000;
const EXCLUIDAS: Record<string, Set<string>> = { Usuario: new Set(["passwordHash", "intentosFallidos", "bloqueadoHasta", "sesionVersion"]) };

type Fila = Record<string, unknown>;

/** Tablas y columnas desde el esquema de Prisma (con el nombre real en la base). */
function tablas() {
  return Prisma.dmmf.datamodel.models.map((m) => ({
    nombre: m.name,
    tabla: m.dbName ?? m.name,
    columnas: m.fields.filter((f) => f.kind !== "object" && !EXCLUIDAS[m.name]?.has(f.name)).map((f) => f.dbName ?? f.name),
    clave: (m.fields.find((f) => f.isId)?.dbName ?? m.fields.find((f) => f.isId)?.name) || null,
  }));
}

function valor(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Prisma.Decimal || (typeof v === "object" && v !== null && "toFixed" in v && typeof (v as { toFixed: unknown }).toFixed === "function")) return String(v);
  return v;
}

function celdaCsv(v: unknown): string {
  const x = valor(v);
  if (x === null) return "";
  const s = typeof x === "object" ? JSON.stringify(x) : String(x);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function* paginas(t: ReturnType<typeof tablas>[number]): AsyncGenerator<Fila[]> {
  const cols = t.columnas.map((c) => `"${c}"`).join(", ");
  if (!t.clave) {
    yield await prisma.$queryRawUnsafe<Fila[]>(`SELECT ${cols} FROM "${t.tabla}"`);
    return;
  }
  let ultimo: unknown = null;
  for (;;) {
    const filas: Fila[] =
      ultimo === null
        ? await prisma.$queryRawUnsafe<Fila[]>(`SELECT ${cols} FROM "${t.tabla}" ORDER BY "${t.clave}" LIMIT ${PAGINA}`)
        : await prisma.$queryRawUnsafe<Fila[]>(`SELECT ${cols} FROM "${t.tabla}" WHERE "${t.clave}" > $1 ORDER BY "${t.clave}" LIMIT ${PAGINA}`, ultimo);
    if (!filas.length) return;
    yield filas;
    if (filas.length < PAGINA) return;
    ultimo = filas[filas.length - 1][t.clave];
  }
}

/** Stream del ZIP. `alTerminar` recibe la cantidad de filas por tabla (para la auditoría). */
export function streamRespaldo(alTerminar: (conteo: Record<string, number>) => Promise<void>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const zip = new Zip((err, chunk, final) => {
        if (err) return controller.error(err);
        controller.enqueue(chunk);
        if (final) controller.close();
      });
      const conteo: Record<string, number> = {};
      try {
        const lista = tablas();
        // 1) Un CSV por tabla (separador coma, UTF-8 con BOM para que Excel respete los acentos).
        for (const t of lista) {
          const f = new ZipDeflate(`csv/${t.nombre}.csv`, { level: 6 });
          zip.add(f);
          f.push(strToU8(`﻿${t.columnas.join(",")}\n`));
          let n = 0;
          for await (const filas of paginas(t)) {
            n += filas.length;
            f.push(strToU8(filas.map((r) => t.columnas.map((c) => celdaCsv(r[c])).join(",")).join("\n") + "\n"));
          }
          f.push(new Uint8Array(0), true);
          conteo[t.nombre] = n;
        }
        // 2) JSON completo: { generado, tablas: { Tabla: [filas…] } }, escrito por partes.
        const j = new ZipDeflate("respaldo-completo.json", { level: 6 });
        zip.add(j);
        j.push(strToU8(`{"sistema":"Aceros RNF","generado":"${new Date().toISOString()}","tablas":{`));
        for (const [i, t] of lista.entries()) {
          j.push(strToU8(`${i ? "," : ""}${JSON.stringify(t.nombre)}:[`));
          let primero = true;
          for await (const filas of paginas(t)) {
            const txt = filas.map((r) => JSON.stringify(Object.fromEntries(t.columnas.map((c) => [c, valor(r[c])])))).join(",");
            j.push(strToU8((primero ? "" : ",") + txt));
            primero = false;
          }
          j.push(strToU8("]"));
        }
        j.push(strToU8("}}"), true);
        // 3) Léame con el contenido.
        const leame = new ZipDeflate("LEAME.txt");
        zip.add(leame);
        leame.push(strToU8(`Respaldo de Aceros RNF · ${new Date().toISOString()}\n\nCarpeta csv/: una planilla por tabla (UTF-8, separador coma).\nrespaldo-completo.json: todas las tablas en un solo archivo.\n\nFilas por tabla:\n${Object.entries(conteo).map(([k, v]) => `- ${k}: ${v}`).join("\n")}\n`), true);
        zip.end();
        await alTerminar(conteo);
      } catch (e) {
        console.error("[respaldo]", e);
        controller.error(e);
      }
    },
  });
}
