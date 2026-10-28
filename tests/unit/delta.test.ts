import { describe, expect, it } from "vitest";
import { coleccionesDelDelta, fusionar } from "@/lib/sincronizacion/delta";

const a = { id: "a", v: 1 };
const b = { id: "b", v: 1 };
const c = { id: "c", v: 1 };

describe("fusionar (delta por fila)", () => {
  it("sin cambios devuelve el mismo arreglo", () => {
    const xs = [a, b];
    expect(fusionar(xs)).toBe(xs);
    expect(fusionar(xs, [], ["zz"])).toBe(xs);
  });
  it("reemplaza en el lugar, agrega al final y saca las bajas", () => {
    const r = fusionar([a, b, c], [{ id: "b", v: 2 }, { id: "d", v: 1 }], ["a"]);
    expect(r).toEqual([{ id: "b", v: 2 }, c, { id: "d", v: 1 }]);
  });
  it("una fila presente en filas y en bajas queda (gana la fila visible)", () => {
    expect(fusionar([a], [{ id: "a", v: 3 }], ["a"])).toEqual([{ id: "a", v: 3 }]);
  });
  it("ignora bajas de ids que no tiene", () => {
    const xs = [a];
    expect(fusionar(xs, [], ["otra"])).toBe(xs);
  });
  it("lista las colecciones que toca", () => {
    expect(coleccionesDelDelta({ version: "1", filas: { notasPedido: [a] }, bajas: { stock: ["x"] }, completas: { config: {} } }).sort()).toEqual(["config", "notasPedido", "stock"]);
  });
});
