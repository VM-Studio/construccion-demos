import { describe, expect, it } from "vitest";
import { PERMISOS, puede, type Permiso } from "@/domain/permisos";
import type { Rol } from "@/domain/types";

const TODOS = Object.keys(PERMISOS) as Permiso[];
const ROLES: Rol[] = ["DUENO", "ADMINISTRACION", "VENTAS", "DEPOSITO"];

// Listas esperadas escritas a mano (no se leen de PERMISOS_POR_ROL).
const ESPERADO_VENTAS: Permiso[] = [
  "tablero.ver",
  "productos.ver",
  "clientes.ver",
  "acopios.preciosCongelados",
  "remitos.ver",
  "circuito2.ver",
  "ventas.ver",
  "ventas.editar",
  "ventas.confirmar",
  "clientes.editar",
  "acopios.ver",
  "acopios.editar",
  "despachos.ver",
  "ctacte.ver",
];

const ESPERADO_DEPOSITO: Permiso[] = [
  "tablero.ver",
  "productos.ver",
  "remitos.ver",
  "remitos.operar",
  "stock.ver",
  "stock.transferir",
  "stock.ajustar",
  "compras.ver",
  "compras.recibir",
  "despachos.ver",
  "despachos.operar",
];

function esperado(rol: Rol, permiso: Permiso): boolean {
  switch (rol) {
    case "DUENO":
      return true;
    case "ADMINISTRACION":
      return permiso !== "config.usuarios";
    case "VENTAS":
      return ESPERADO_VENTAS.includes(permiso);
    case "DEPOSITO":
      return ESPERADO_DEPOSITO.includes(permiso);
  }
}

const MATRIZ = ROLES.flatMap((rol) => TODOS.map((permiso) => [rol, permiso, esperado(rol, permiso)] as const));

describe("catálogo de permisos", () => {
  it("tiene 42 permisos", () => {
    expect(TODOS).toHaveLength(42);
  });

  it("las listas esperadas solo usan permisos existentes", () => {
    for (const p of [...ESPERADO_VENTAS, ...ESPERADO_DEPOSITO]) expect(TODOS).toContain(p);
  });
});

describe("puede(): matriz completa rol × permiso", () => {
  it.each(MATRIZ)("%s · %s → %s", (rol, permiso, valor) => {
    expect(puede({ rol, activo: true }, permiso)).toBe(valor);
  });
});

describe("puede(): casos puntuales", () => {
  it("solo DUENO administra usuarios", () => {
    expect(ROLES.filter((rol) => puede({ rol, activo: true }, "config.usuarios"))).toEqual(["DUENO"]);
  });

  it("VENTAS no ve costos/márgenes ni factura; DEPOSITO no ve circuito 2 ni dinero", () => {
    expect(puede({ rol: "VENTAS", activo: true }, "margenes.ver")).toBe(false);
    expect(puede({ rol: "VENTAS", activo: true }, "ventas.facturar")).toBe(false);
    expect(puede({ rol: "VENTAS", activo: true }, "stock.forzarVenta")).toBe(false);
    expect(puede({ rol: "DEPOSITO", activo: true }, "circuito2.ver")).toBe(false);
    expect(puede({ rol: "DEPOSITO", activo: true }, "ctacte.ver")).toBe(false);
    expect(puede({ rol: "DEPOSITO", activo: true }, "margenes.ver")).toBe(false);
  });

  it("cantidad de permisos por rol", () => {
    const cuenta = (rol: Rol) => TODOS.filter((p) => puede({ rol, activo: true }, p)).length;
    expect(cuenta("DUENO")).toBe(42);
    expect(cuenta("ADMINISTRACION")).toBe(41);
    expect(cuenta("VENTAS")).toBe(14);
    expect(cuenta("DEPOSITO")).toBe(11);
  });
});

describe("puede(): usuario inactivo o ausente", () => {
  const INACTIVOS = ROLES.flatMap((rol) => TODOS.map((permiso) => [rol, permiso] as const));

  it.each(INACTIVOS)("%s inactivo no puede %s", (rol, permiso) => {
    expect(puede({ rol, activo: false }, permiso)).toBe(false);
  });

  it.each(TODOS)("null / undefined no pueden %s", (permiso) => {
    expect(puede(null, permiso)).toBe(false);
    expect(puede(undefined, permiso)).toBe(false);
  });
});
