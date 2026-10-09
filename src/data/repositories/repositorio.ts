/**
 * Repositorios de LECTURA sobre Prisma (servidor). La escritura no pasa por acá: toda
 * escritura es una acción de negocio en src/server/servicios (transacción, auditoría y Cambio).
 */
import type { Entidad } from "@/domain/types";
import { prisma } from "@/server/db-base";
import { leerColeccion, contarColeccion, type Coleccion } from "@/server/datos/mapeo";

export interface ConsultaRepo {
  where?: Record<string, unknown>;
  orderBy?: Record<string, "asc" | "desc"> | Record<string, "asc" | "desc">[];
  skip?: number;
  take?: number;
}

export interface Repositorio<T extends Entidad> {
  listar(consulta?: ConsultaRepo): Promise<T[]>;
  obtener(id: string): Promise<T | undefined>;
  contar(where?: Record<string, unknown>): Promise<number>;
}

export class RepositorioPrisma<T extends Entidad> implements Repositorio<T> {
  constructor(private readonly coleccion: Coleccion) {}

  async listar(consulta: ConsultaRepo = {}): Promise<T[]> {
    return (await leerColeccion(prisma, this.coleccion, consulta)) as unknown as T[];
  }

  async obtener(id: string): Promise<T | undefined> {
    return (await this.listar({ where: { id }, take: 1 }))[0];
  }

  contar(where?: Record<string, unknown>): Promise<number> {
    return contarColeccion(prisma, this.coleccion, where);
  }
}
