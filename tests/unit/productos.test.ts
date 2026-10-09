import { describe, expect, it } from "vitest";
import { cantidadReposicion, siguienteCodigoProducto } from "@/domain/productos";
import { producto, rubro } from "./fixtures";

describe("siguienteCodigoProducto", () => {
  const rubros = [rubro("rub_cem", "503"), rubro("rub_hie", "504")];

  it("siguiente correlativo del rubro", () => {
    const productos = [
      producto("a", { rubroId: "rub_cem", codigo: "503018" }),
      producto("b", { rubroId: "rub_cem", codigo: "503002" }),
      producto("c", { rubroId: "rub_hie", codigo: "504999" }),
    ];
    expect(siguienteCodigoProducto("rub_cem", productos, rubros)).toBe("503019");
  });

  it("rubro sin artículos arranca en prefijo + 001", () => {
    expect(siguienteCodigoProducto("rub_hie", [], rubros)).toBe("504001");
  });

  it("ignora códigos no numéricos o con otro prefijo", () => {
    const productos = [
      producto("a", { rubroId: "rub_cem", codigo: "CEM-90" }),
      producto("b", { rubroId: "rub_cem", codigo: "999999" }),
      producto("c", { rubroId: "rub_cem", codigo: "503005" }),
    ];
    expect(siguienteCodigoProducto("rub_cem", productos, rubros)).toBe("503006");
  });

  it("rubro inexistente devuelve vacío", () => {
    expect(siguienteCodigoProducto("rub_x", [], rubros)).toBe("");
  });
});

describe("cantidadReposicion", () => {
  it("mínimo × 2 − disponible − en tránsito", () => {
    // 50 × 2 − 30 − 20 = 50
    expect(cantidadReposicion({ stockMinimo: 50 }, 30, 20)).toBe(50);
  });

  it("redondea hacia arriba a pallet completo", () => {
    // 100 − 30 = 70 → 2 pallets de 40 = 80
    expect(cantidadReposicion({ stockMinimo: 50, unidadesPorPallet: 40 }, 30)).toBe(80);
  });

  it("sin pallet redondea hacia arriba a entero", () => {
    expect(cantidadReposicion({ stockMinimo: 10 }, 12.5)).toBe(8);
  });

  it("si sobra stock o lo cubre lo que viene en camino, no repone", () => {
    expect(cantidadReposicion({ stockMinimo: 10 }, 20)).toBe(0);
    expect(cantidadReposicion({ stockMinimo: 10 }, 5, 15)).toBe(0);
    expect(cantidadReposicion({ stockMinimo: 0, unidadesPorPallet: 40 }, 0)).toBe(0);
  });

  it("con disponible negativo repone de más", () => {
    expect(cantidadReposicion({ stockMinimo: 10 }, -5)).toBe(25);
  });
});
