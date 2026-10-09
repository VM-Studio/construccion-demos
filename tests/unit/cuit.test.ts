import { describe, expect, it } from "vitest";
import { digitoVerificadorCUIT, formatearCUIT, generarCUIT, validarCUIT } from "@/domain/cuit";

const ERR_LARGO = "El CUIT debe tener 11 dígitos (XX-XXXXXXXX-X).";
const ERR_PREFIJO = "El prefijo del CUIT no es válido.";
const ERR_DV = "El dígito verificador no coincide.";

// Pesos 5,4,3,2,7,6,5,4,3,2. Cuentas a mano:
//  20-12345678: 10+0+3+4+21+24+25+24+21+16 = 148; 148 % 11 = 5; 11 − 5 = 6
//  30-54668997: 15+0+15+8+42+36+40+36+27+14 = 233; 233 % 11 = 2; 11 − 2 = 9
//  30-00100000: 15+7 = 22; 22 % 11 = 0 → 11 → 0
//  20-01000000: 10+2 = 12; 12 % 11 = 1 → 10 → 9
//  27-00000000: 10+28 = 38; 38 % 11 = 5 → 6

describe("digitoVerificadorCUIT", () => {
  it.each<[string, number]>([
    ["2012345678", 6],
    ["3054668997", 9],
    ["3000100000", 0],
    ["2001000000", 9],
    ["2700000000", 6],
    ["20-12345678", 6], // ignora guiones
    ["20123456789999", 6], // usa solo los primeros 10
  ])("%s → %d", (base, dv) => {
    expect(digitoVerificadorCUIT(base)).toBe(dv);
  });
});

describe("formatearCUIT", () => {
  it("formatea 11 dígitos como XX-XXXXXXXX-X", () => {
    expect(formatearCUIT("20123456786")).toBe("20-12345678-6");
    expect(formatearCUIT("20.12345678.6")).toBe("20-12345678-6");
    expect(formatearCUIT("20-12345678-6")).toBe("20-12345678-6");
  });

  it("si no tiene 11 dígitos lo devuelve sin tocar", () => {
    expect(formatearCUIT("2012345678")).toBe("2012345678");
    expect(formatearCUIT("")).toBe("");
    expect(formatearCUIT("abc")).toBe("abc");
  });
});

describe("validarCUIT", () => {
  it.each(["20-12345678-6", "20123456786", "30-54668997-9", "30-00100000-0", " 20 12345678 6 "])("%j válido", (cuit) => {
    expect(validarCUIT(cuit)).toBeNull();
  });

  it("dígito verificador incorrecto", () => {
    expect(validarCUIT("20-12345678-5")).toBe(ERR_DV);
    expect(validarCUIT("30-54668997-0")).toBe(ERR_DV);
  });

  it("largo distinto de 11", () => {
    expect(validarCUIT("")).toBe(ERR_LARGO);
    expect(validarCUIT("20-1234567-6")).toBe(ERR_LARGO);
    expect(validarCUIT("20-123456789-6")).toBe(ERR_LARGO);
    expect(validarCUIT(null as unknown as string)).toBe(ERR_LARGO);
    expect(validarCUIT(undefined as unknown as string)).toBe(ERR_LARGO);
  });

  it.each(["20", "23", "24", "27", "30", "33", "34"])("prefijo %s aceptado", (pre) => {
    expect(validarCUIT(generarCUIT(pre, 12345678))).toBeNull();
  });

  it.each(["10", "21", "25", "31", "50", "99"])("prefijo %s rechazado (antes que el dígito)", (pre) => {
    expect(validarCUIT(`${pre}123456780`)).toBe(ERR_PREFIJO);
  });

  it("OJO: cuando el cálculo da 10 acepta 9 como verificador con cualquier prefijo (AFIP en ese caso cambia el prefijo a 23/24)", () => {
    expect(validarCUIT("20-01000000-9")).toBeNull();
  });
});

describe("generarCUIT", () => {
  it("rellena el número a 8 dígitos y agrega el verificador", () => {
    expect(generarCUIT("20", 12345678)).toBe("20-12345678-6");
    expect(generarCUIT("30", 54668997)).toBe("30-54668997-9");
    expect(generarCUIT("30", 100000)).toBe("30-00100000-0");
    expect(generarCUIT("27", 0)).toBe("27-00000000-6");
  });
});
