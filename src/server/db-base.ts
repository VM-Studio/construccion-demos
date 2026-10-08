/**
 * Cliente Prisma único con el adapter de Neon (WebSocket: soporta transacciones interactivas).
 * Lo usan el servidor (vía `src/server/db.ts`, con `server-only`) y los scripts de `prisma/` y `scripts/`.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

function crearCliente() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Falta DATABASE_URL");
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }), log: process.env.PRISMA_LOG ? ["query", "warn", "error"] : ["warn", "error"] });
}

const global_ = globalThis as unknown as { __prisma?: PrismaClient };
export const prisma: PrismaClient = global_.__prisma ?? crearCliente();
if (process.env.NODE_ENV !== "production") global_.__prisma = prisma;

export type Db = PrismaClient;
