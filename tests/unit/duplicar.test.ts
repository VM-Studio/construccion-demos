import { describe, expect, it } from "vitest";
import { detectarVariante, markupsEfectivos, markupsSospechosos, nombreConVariante, nombreRepetidoEnRubro, numeroAR, parsearPegado, preciosParaCosto, siguientesCodigos } from "@/domain/duplicar";
import type { PrecioProducto } from "@/domain/types";

const listas = [
  { id: "may", markupPorDefecto: 22 },
  { id: "cor", markupPorDefecto: 28 },
  { id: "pub", markupPorDefecto: 45 },
];
const pre = (listaPreciosId: string, precio: number): PrecioProducto => ({ id: `p-${listaPreciosId}`, productoId: "hie6", listaPreciosId, precio, creadoEn: "", actualizadoEn: "" });
const hierro6 = { id: "hie6", costoUltimo: 1000 };
const precios = [pre("may", 1220), pre("cor", 1300), pre("pub", 1450)];

describe("precios por markup efectivo", () => {
  it("el markup efectivo sale de precio / costo de cada lista", () => {
    expect(markupsEfectivos(hierro6, precios, listas)).toEqual({ may: 22, cor: 30, pub: 45 });
  });
  it("sin precio en una lista o sin costo, usa el markup por defecto de la lista", () => {
    expect(markupsEfectivos(hierro6, [pre("may", 1220)], listas)).toEqual({ may: 22, cor: 28, pub: 45 });
    expect(markupsEfectivos({ id: "hie6", costoUltimo: 0 }, precios, listas)).toEqual({ may: 22, cor: 28, pub: 45 });
  });
  it("si el costo no cambia, copia los precios iguales (aunque no estén redondeados)", () => {
    expect(preciosParaCosto(hierro6, [pre("may", 1221.37), pre("cor", 1300), pre("pub", 1450)], listas, 1000)).toEqual({ may: 1221.37, cor: 1300, pub: 1450 });
  });
  it("si cambia el costo, recalcula con el markup del original y redondea a $10", () => {
    // 5900 × 1,22 = 7198 → 7200 ; × 1,30 = 7670 ; × 1,45 = 8555 → 8560
    expect(preciosParaCosto(hierro6, precios, listas, 5900)).toEqual({ may: 7200, cor: 7670, pub: 8560 });
  });
  it("respeta el redondeo configurado", () => {
    expect(preciosParaCosto(hierro6, precios, listas, 5900, 100)).toEqual({ may: 7200, cor: 7700, pub: 8600 });
    expect(preciosParaCosto(hierro6, precios, listas, 5900, 1)).toEqual({ may: 7198, cor: 7670, pub: 8555 });
  });
  it("costo 0 da precios 0 (se completan a mano)", () => {
    expect(preciosParaCosto(hierro6, precios, listas, 0)).toEqual({ may: 0, cor: 0, pub: 0 });
  });
});

describe("variante en el nombre", () => {
  it.each([
    ["Hierro ADN 6 mm", "Hierro ADN", "6 mm"],
    ["Hierro ADN 4,2 mm", "Hierro ADN", "4,2 mm"],
    ["Caño PVC 110 mm x 4 m", "Caño PVC", "110 mm x 4 m"],
    ["Ladrillo hueco 12x18x33", "Ladrillo hueco", "12x18x33"],
    ["Cemento Portland 50 kg", "Cemento Portland", "50 kg"],
    ['Tornillo autoperforante 1/2"', "Tornillo autoperforante", '1/2"'],
    ["Malla 15x15 4,2mm", "Malla 15x15", "4,2mm"],
  ])("%s → base %s + variante %s", (nombre, base, variante) => {
    expect(detectarVariante(nombre)).toEqual({ base, variante });
  });
  it("sin medida al final, la variante queda vacía", () => {
    expect(detectarVariante("Cal hidratada")).toEqual({ base: "Cal hidratada", variante: "" });
    expect(detectarVariante("  Arena   gruesa ")).toEqual({ base: "Arena gruesa", variante: "" });
  });
  it("arma el nombre de la variante", () => {
    expect(nombreConVariante("Hierro ADN", "8 mm")).toBe("Hierro ADN 8 mm");
    expect(nombreConVariante(" Hierro ADN ", "")).toBe("Hierro ADN");
  });
  it("detecta nombres repetidos en el mismo rubro sin importar mayúsculas ni espacios", () => {
    const productos = [{ id: "a", nombre: "Hierro ADN 6 mm", rubroId: "hie" }];
    expect(nombreRepetidoEnRubro("hierro  adn 6 MM", "hie", productos)?.id).toBe("a");
    expect(nombreRepetidoEnRubro("Hierro ADN 6 mm", "otro", productos)).toBeUndefined();
    expect(nombreRepetidoEnRubro("Hierro ADN 6 mm", "hie", productos, "a")).toBeUndefined();
  });
});

describe("códigos consecutivos", () => {
  const rubros = [{ id: "hie", prefijo: "501" }];
  const productos = [{ codigo: "50101", rubroId: "hie" }, { codigo: "50102", rubroId: "hie" }, { codigo: "OTRO", rubroId: "hie" }];
  it("sigue la numeración del rubro", () => {
    expect(siguientesCodigos("hie", productos, rubros, 3)).toEqual(["50103", "50104", "50105"]);
  });
  it("no repite códigos reservados (otras filas de la serie) ni existentes de otros rubros", () => {
    expect(siguientesCodigos("hie", [...productos, { codigo: "50104", rubroId: "otro" }], rubros, 3, ["50103"])).toEqual(["50105", "50106", "50107"]);
  });
  it("rubro sin artículos arranca en prefijo + 001", () => {
    expect(siguientesCodigos("hie", [], rubros, 2)).toEqual(["501001", "501002"]);
  });
});

describe("pegar desde Excel", () => {
  it("números con coma decimal y punto de miles", () => {
    expect(numeroAR("5.900")).toBe(5900);
    expect(numeroAR("4,74")).toBe(4.74);
    expect(numeroAR("1.234,56")).toBe(1234.56);
    expect(numeroAR("$ 12.500")).toBe(12500);
    expect(numeroAR("4.74")).toBe(4.74);
    expect(numeroAR("1.234.567")).toBe(1234567);
    expect(Number.isNaN(numeroAR(""))).toBe(true);
  });
  it("columnas separadas por tabulación: variante, peso, costo", () => {
    expect(parsearPegado("8 mm\t4,74\t5.900\n10 mm\t7,4\t9.200\r\n\n12 mm\t10,65\t13.100")).toEqual([
      { variante: "8 mm", peso: 4.74, costo: 5900 },
      { variante: "10 mm", peso: 7.4, costo: 9200 },
      { variante: "12 mm", peso: 10.65, costo: 13100 },
    ]);
  });
  it("acepta 2+ espacios o punto y coma, y saltea la cabecera", () => {
    expect(parsearPegado("Variante  Peso  Costo\n8 mm  4,74  5.900\n10 mm;7,4;9.200")).toEqual([
      { variante: "8 mm", peso: 4.74, costo: 5900 },
      { variante: "10 mm", peso: 7.4, costo: 9200 },
    ]);
  });
  it("celdas vacías quedan sin valor", () => {
    expect(parsearPegado("16 mm\t\t21.000")).toEqual([{ variante: "16 mm", peso: undefined, costo: 21000 }]);
  });
});

describe("campo numérico (numeroAR): punto decimal o de miles", () => {
  it("un costo escrito con punto decimal no se multiplica por 100", () => {
    expect(numeroAR("1757509.28")).toBe(1757509.28);
    expect(numeroAR("1757509,28")).toBe(1757509.28);
    expect(numeroAR("1.757.509,28")).toBe(1757509.28);
    expect(numeroAR("1.757.509")).toBe(1757509);
  });
  it("mientras se escribe no da valores intermedios absurdos", () => {
    expect(numeroAR("1757509.")).toBe(1757509);
    expect(Number.isNaN(numeroAR("1.757.5"))).toBe(true); // se ignora hasta completar
    expect(numeroAR("0,5")).toBe(0.5);
    expect(numeroAR("-12,5")).toBe(-12.5);
  });
});

describe("markups sospechosos", () => {
  it("avisa cuando el precio del origen es más de 10 veces el costo", () => {
    expect(markupsSospechosos({ may: 22, cor: 12700, pub: 14400 })).toEqual(["cor", "pub"]);
    expect(markupsSospechosos({ may: 22, cor: 28, pub: 900 })).toEqual([]);
  });
});
