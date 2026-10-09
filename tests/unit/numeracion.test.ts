import { describe, expect, it } from "vitest";
import {
  claveNumerador,
  DOCUMENTOS_NUMERADOS,
  filasNumeracion,
  formatearDoc,
  numeradoresDesde,
  numeroCorto,
  parsearNumeroDoc,
  reservarNumeroDoc,
} from "@/domain/numeracion";
import type { Numeradores } from "@/domain/types";

const SUCURSALES = [
  { puntoVenta: "0001", puntoVentaRemito: "00016" }, // Casa Central
  { puntoVenta: "0002", puntoVentaRemito: "00006" }, // Sucursal 2
];

describe("claveNumerador", () => {
  it("combina código, circuito y punto de venta; sin circuito usa 0", () => {
    expect(claveNumerador("NP", 1, "0001")).toBe("NP|1|0001");
    expect(claveNumerador("NP", 2, "0001")).toBe("NP|2|0001");
    expect(claveNumerador("RM", 2, "00016")).toBe("RM|2|00016");
    expect(claveNumerador("TRF", null, "0001")).toBe("TRF|0|0001");
  });
});

describe("formatearDoc", () => {
  it.each([
    ["NP", 1, "0001", 1, "NP1 0001-00000001"],
    ["NP", 2, "0001", 67299, "NP2 0001-00067299"],
    ["RM", 2, "00016", 13536, "RM2 00016-00013536"],
    ["F", 1, "0001", 88073, "F1 0001-00088073"],
    ["AC", 2, "0001", 3633, "AC2 0001-00003633"],
    ["ACD", 1, "0002", 5, "ACD1 0002-00000005"],
    ["ACP", 2, "0001", 12, "ACP2 0001-00000012"],
    ["DP", 2, "0001", 67661, "DP2 0001-00067661"],
    ["TRF", null, "0001", 42, "TRF 0001-00000042"],
    ["AJU", null, "0001", 99999999, "AJU 0001-99999999"],
  ] as const)("%s%s %s n=%d → %s", (codigo, circuito, pv, n, esperado) => {
    expect(formatearDoc(codigo, circuito, pv, n)).toBe(esperado);
  });

  it("OJO: no corta correlativos de más de 8 dígitos", () => {
    expect(formatearDoc("NP", 1, "0001", 123456789)).toBe("NP1 0001-123456789");
  });
});

describe("reservarNumeroDoc", () => {
  it("arranca en 1 cuando no hay numerador", () => {
    const [num, nums] = reservarNumeroDoc({}, "NP", 1, "0001");
    expect(num).toBe("NP1 0001-00000001");
    expect(nums).toEqual({ "NP|1|0001": 1 });
  });

  it("sigue desde el último y no muta los numeradores recibidos", () => {
    const antes: Numeradores = { "NP|2|0001": 67298 };
    const [num, despues] = reservarNumeroDoc(antes, "NP", 2, "0001");
    expect(num).toBe("NP2 0001-00067299");
    expect(despues["NP|2|0001"]).toBe(67299);
    expect(antes).toEqual({ "NP|2|0001": 67298 });
  });

  it("numeración independiente por código, circuito y punto de venta", () => {
    let n: Numeradores = {};
    const emitidos: string[] = [];
    const reservar = (...args: Parameters<typeof reservarNumeroDoc> extends [Numeradores, ...infer R] ? R : never) => {
      const [num, sig] = reservarNumeroDoc(n, ...args);
      n = sig;
      emitidos.push(num);
    };
    reservar("NP", 1, "0001");
    reservar("NP", 1, "0001");
    reservar("NP", 2, "0001");
    reservar("NP", 1, "0002");
    reservar("F", 1, "0001");
    reservar("RM", 1, "00016");
    reservar("TRF", null, "0001");
    reservar("NP", 1, "0001");
    expect(emitidos).toEqual([
      "NP1 0001-00000001",
      "NP1 0001-00000002",
      "NP2 0001-00000001",
      "NP1 0002-00000001",
      "F1 0001-00000001",
      "RM1 00016-00000001",
      "TRF 0001-00000001",
      "NP1 0001-00000003",
    ]);
    expect(n).toEqual({
      "NP|1|0001": 3,
      "NP|2|0001": 1,
      "NP|1|0002": 1,
      "F|1|0001": 1,
      "RM|1|00016": 1,
      "TRF|0|0001": 1,
    });
  });
});

describe("parsearNumeroDoc", () => {
  it.each([
    ["NP2 0001-00067299", { codigo: "NP", circuito: 2, puntoVenta: "0001", correlativo: 67299 }],
    ["F1 0001-00088073", { codigo: "F", circuito: 1, puntoVenta: "0001", correlativo: 88073 }],
    ["RM2 00016-00013536", { codigo: "RM", circuito: 2, puntoVenta: "00016", correlativo: 13536 }],
    ["ACD1 0002-00000005", { codigo: "ACD", circuito: 1, puntoVenta: "0002", correlativo: 5 }],
    ["ACP2 0001-00000012", { codigo: "ACP", circuito: 2, puntoVenta: "0001", correlativo: 12 }],
    ["TRF 0001-00000042", { codigo: "TRF", circuito: null, puntoVenta: "0001", correlativo: 42 }],
    ["AJU   0001-00000007", { codigo: "AJU", circuito: null, puntoVenta: "0001", correlativo: 7 }],
  ] as const)("%s", (numero, esperado) => {
    expect(parsearNumeroDoc(numero)).toEqual(esperado);
  });

  it("es la inversa de formatearDoc", () => {
    const num = formatearDoc("RC", 2, "0002", 4321);
    expect(parsearNumeroDoc(num)).toEqual({ codigo: "RC", circuito: 2, puntoVenta: "0002", correlativo: 4321 });
  });

  it("OJO: la devolución DP2 0001-00067661-1 se parsea ignorando el sufijo '-1'", () => {
    expect(parsearNumeroDoc("DP2 0001-00067661-1")).toEqual({ codigo: "DP", circuito: 2, puntoVenta: "0001", correlativo: 67661 });
  });

  it("devuelve null con formatos inválidos", () => {
    expect(parsearNumeroDoc("")).toBeNull();
    expect(parsearNumeroDoc("NP2")).toBeNull();
    expect(parsearNumeroDoc("NP2-0001-00000001")).toBeNull(); // falta el espacio
    expect(parsearNumeroDoc("np2 0001-00000001")).toBeNull(); // minúsculas
    expect(parsearNumeroDoc("0001-00000001")).toBeNull(); // sin código
    expect(parsearNumeroDoc("NP2 0001")).toBeNull(); // sin correlativo
  });

  it("OJO: un circuito distinto de 1/2 no matchea (NP3 → null)", () => {
    expect(parsearNumeroDoc("NP3 0001-00000001")).toBeNull();
  });
});

describe("numeroCorto", () => {
  it("código + circuito + correlativo sin ceros", () => {
    expect(numeroCorto("NP2 0001-00067299")).toBe("NP2 67299");
    expect(numeroCorto("F1 0001-00000001")).toBe("F1 1");
    expect(numeroCorto("TRF 0001-00000042")).toBe("TRF 42");
    expect(numeroCorto("RM2 00016-00013536")).toBe("RM2 13536");
  });

  it("si no parsea devuelve el texto tal cual", () => {
    expect(numeroCorto("sin número")).toBe("sin número");
    expect(numeroCorto("")).toBe("");
  });

  it("OJO: pierde el sufijo de la devolución (DP2 0001-00067661-1 → DP2 67661) y pierde el punto de venta", () => {
    expect(numeroCorto("DP2 0001-00067661-1")).toBe("DP2 67661");
    expect(numeroCorto("NP1 0002-00000005")).toBe(numeroCorto("NP1 0001-00000005"));
  });
});

describe("numeradoresDesde", () => {
  it("toma el máximo correlativo por clave e ignora lo que no parsea", () => {
    expect(
      numeradoresDesde([
        "NP2 0001-00067299",
        "NP2 0001-00067100",
        "NP2 0001-00067300",
        "NP1 0001-00000010",
        "NP2 0002-00000003",
        "RM2 00016-00013536",
        "TRF 0001-00000042",
        "basura",
        "",
      ]),
    ).toEqual({
      "NP|2|0001": 67300,
      "NP|1|0001": 10,
      "NP|2|0002": 3,
      "RM|2|00016": 13536,
      "TRF|0|0001": 42,
    });
  });

  it("sin números devuelve {} y las claves coinciden con claveNumerador (se puede seguir reservando)", () => {
    expect(numeradoresDesde([])).toEqual({});
    const n = numeradoresDesde(["F1 0001-00088072"]);
    expect(reservarNumeroDoc(n, "F", 1, "0001")[0]).toBe("F1 0001-00088073");
  });

  it("la DP con sufijo cuenta por su correlativo base", () => {
    expect(numeradoresDesde(["DP2 0001-00067661-1"])).toEqual({ "DP|2|0001": 67661 });
  });
});

describe("filasNumeracion", () => {
  it("genera todas las combinaciones previstas: 51 filas con dos sucursales", () => {
    // sucursal con circuito: NP, AC, ACD, COT, F, NC, RC, SI, RD → 9 × 2 circuitos × 2 PV = 36
    // DES (sucursal, sin circuito) → 2; RM (PV de remito) → 2 × 2 = 4
    // central con circuito: OC, OP, ACP → 3 × 2 = 6; central sin circuito: RCP, TRF, AJU → 3
    const filas = filasNumeracion({}, SUCURSALES);
    expect(filas).toHaveLength(51);
    expect(new Set(filas.map((f) => f.clave)).size).toBe(51);
    expect(filas.every((f) => f.ultimo === 0)).toBe(true);
  });

  it("remitos usan el punto de venta de remito; OC/OP/ACP solo 0001", () => {
    const claves = filasNumeracion({}, SUCURSALES).map((f) => f.clave);
    expect(claves).toEqual(expect.arrayContaining(["RM|1|00016", "RM|2|00016", "RM|1|00006", "RM|2|00006"]));
    expect(claves).not.toContain("RM|1|0001");
    expect(claves).toContain("OC|2|0001");
    expect(claves).not.toContain("OC|1|0002");
    expect(claves).toEqual(expect.arrayContaining(["DES|0|0001", "DES|0|0002", "TRF|0|0001"]));
    expect(claves).not.toContain("TRF|0|0002");
  });

  it("completa el último número desde los numeradores", () => {
    const filas = filasNumeracion({ "NP|2|0001": 67299, "TRF|0|0001": 42 }, SUCURSALES);
    expect(filas.find((f) => f.clave === "NP|2|0001")).toEqual({
      clave: "NP|2|0001",
      codigo: "NP",
      nombre: "Nota de pedido",
      circuito: 2,
      puntoVenta: "0001",
      ultimo: 67299,
    });
    expect(filas.find((f) => f.clave === "TRF|0|0001")).toMatchObject({ circuito: null, ultimo: 42 });
  });

  it("agrega claves existentes no previstas (DP, ND) con el código como nombre si no está en la lista", () => {
    const filas = filasNumeracion({ "DP|2|0001": 67661, "NP|1|0099": 7 }, SUCURSALES);
    expect(filas).toHaveLength(53);
    expect(filas.find((f) => f.clave === "DP|2|0001")).toEqual({
      clave: "DP|2|0001",
      codigo: "DP",
      nombre: "DP",
      circuito: 2,
      puntoVenta: "0001",
      ultimo: 67661,
    });
    expect(filas.find((f) => f.clave === "NP|1|0099")).toMatchObject({ nombre: "Nota de pedido", circuito: 1, puntoVenta: "0099", ultimo: 7 });
  });

  it("OJO: DP (devolución de NP) y ND (nota de débito) no están en DOCUMENTOS_NUMERADOS", () => {
    const codigos = DOCUMENTOS_NUMERADOS.map((d) => d.codigo);
    expect(codigos).not.toContain("DP");
    expect(codigos).not.toContain("ND");
  });

  it("sucursales con el mismo punto de venta no duplican filas; sin sucursales solo quedan las centrales", () => {
    expect(filasNumeracion({}, [SUCURSALES[0], SUCURSALES[0]])).toHaveLength(9 * 2 + 1 + 2 + 6 + 3);
    expect(filasNumeracion({}, [])).toHaveLength(6 + 3);
  });
});
