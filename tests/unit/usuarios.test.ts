import { describe, expect, it } from "vitest";
import { fortalezaPassword, generarPasswordTemporal, inicialesDe, validarCambioUsuario, validarPassword } from "@/domain/usuarios";
import type { Rol, Usuario } from "@/domain/types";

type U = Pick<Usuario, "id" | "rol" | "activo">;
const u = (id: string, rol: Rol, activo = true): U => ({ id, rol, activo });

const ERR_PROPIO_ROL = "No podés cambiar tu propio rol.";
const ERR_DESACTIVARSE = "No podés desactivar tu propio usuario.";
const ERR_ULTIMO_DUENO = "Tiene que quedar al menos un dueño activo.";

describe("validarCambioUsuario", () => {
  const felipe = u("felipe", "DUENO");
  const socio = u("socio", "DUENO");
  const admin = u("admin", "ADMINISTRACION");
  const vendedor = u("vendedor", "VENTAS");

  it("usuario inexistente", () => {
    expect(validarCambioUsuario([felipe], "felipe", "nadie", { rol: "VENTAS" })).toBe("El usuario no existe.");
  });

  it("no puede cambiarse el propio rol", () => {
    expect(validarCambioUsuario([felipe, socio], "felipe", "felipe", { rol: "ADMINISTRACION" })).toBe(ERR_PROPIO_ROL);
    expect(validarCambioUsuario([felipe, admin], "admin", "admin", { rol: "DUENO" })).toBe(ERR_PROPIO_ROL);
  });

  it("puede 'cambiarse' al mismo rol que ya tiene", () => {
    expect(validarCambioUsuario([felipe], "felipe", "felipe", { rol: "DUENO" })).toBeNull();
    expect(validarCambioUsuario([felipe], "felipe", "felipe", {})).toBeNull();
  });

  it("no puede desactivarse a sí mismo", () => {
    expect(validarCambioUsuario([felipe, socio], "felipe", "felipe", { activo: false })).toBe(ERR_DESACTIVARSE);
    expect(validarCambioUsuario([felipe, admin], "admin", "admin", { activo: false })).toBe(ERR_DESACTIVARSE);
  });

  it("el error del propio rol se informa antes que el de desactivarse", () => {
    expect(validarCambioUsuario([felipe, socio], "felipe", "felipe", { rol: "VENTAS", activo: false })).toBe(ERR_PROPIO_ROL);
  });

  it("no se puede bajar ni desactivar al único dueño activo", () => {
    expect(validarCambioUsuario([felipe, admin], "admin", "felipe", { rol: "VENTAS" })).toBe(ERR_ULTIMO_DUENO);
    expect(validarCambioUsuario([felipe, admin], "admin", "felipe", { activo: false })).toBe(ERR_ULTIMO_DUENO);
  });

  it("un dueño inactivo no cuenta como dueño activo", () => {
    const socioInactivo = u("socio", "DUENO", false);
    expect(validarCambioUsuario([felipe, socioInactivo, admin], "admin", "felipe", { activo: false })).toBe(ERR_ULTIMO_DUENO);
  });

  it("con dos dueños activos, uno puede bajar o desactivar al otro", () => {
    expect(validarCambioUsuario([felipe, socio], "felipe", "socio", { rol: "ADMINISTRACION" })).toBeNull();
    expect(validarCambioUsuario([felipe, socio], "felipe", "socio", { activo: false })).toBeNull();
  });

  it("cambios que no tocan dueños activos siempre valen", () => {
    expect(validarCambioUsuario([felipe, vendedor], "felipe", "vendedor", { rol: "DEPOSITO" })).toBeNull();
    expect(validarCambioUsuario([felipe, vendedor], "felipe", "vendedor", { activo: false })).toBeNull();
    expect(validarCambioUsuario([felipe, vendedor], "felipe", "vendedor", { rol: "DUENO" })).toBeNull();
  });

  it("reactivar o cambiar el rol de un dueño inactivo no exige otro dueño", () => {
    const socioInactivo = u("socio", "DUENO", false);
    expect(validarCambioUsuario([felipe, socioInactivo], "felipe", "socio", { rol: "VENTAS" })).toBeNull();
    expect(validarCambioUsuario([felipe, socioInactivo], "felipe", "socio", { activo: true })).toBeNull();
  });

  it("dueño activo que sigue dueño y activo es válido aunque sea el único", () => {
    expect(validarCambioUsuario([felipe, admin], "admin", "felipe", { rol: "DUENO", activo: true })).toBeNull();
  });
});

describe("validarPassword", () => {
  const EMAIL = "felipe@acerosrnf.com.ar";
  const ERR_LARGO = "La contraseña tiene que tener al menos 10 caracteres.";
  const ERR_EMAIL = "La contraseña no puede contener tu email.";

  it("mínimo 10 caracteres", () => {
    expect(validarPassword("Abc12345!", EMAIL)).toBe(ERR_LARGO); // 9
    expect(validarPassword("", EMAIL)).toBe(ERR_LARGO);
    expect(validarPassword("Abc12345!x", EMAIL)).toBeNull(); // 10
  });

  it("no puede contener el email completo ni su parte local (sin distinguir mayúsculas)", () => {
    expect(validarPassword("xx" + EMAIL + "xx", EMAIL)).toBe(ERR_EMAIL);
    expect(validarPassword("Felipe2026!!", EMAIL)).toBe(ERR_EMAIL);
    expect(validarPassword("miFELIPEclave", EMAIL)).toBe(ERR_EMAIL);
    expect(validarPassword("clave-segura-99", "FELIPE@AcerosRNF.com.ar")).toBeNull();
    expect(validarPassword("xxFELIPExxxx", "Felipe@AcerosRNF.com.ar")).toBe(ERR_EMAIL);
  });

  it("la parte local de menos de 3 caracteres no se controla", () => {
    expect(validarPassword("jc-clave-larga", "jc@acerosrnf.com.ar")).toBeNull();
    expect(validarPassword("abc-clave-larga", "abc@acerosrnf.com.ar")).toBe(ERR_EMAIL);
  });

  it("el largo se valida antes que el email", () => {
    expect(validarPassword("felipe", EMAIL)).toBe(ERR_LARGO);
  });

  it("si se pasa la anterior, tiene que ser distinta (distingue mayúsculas)", () => {
    expect(validarPassword("Corralon-2026", EMAIL, "Corralon-2026")).toBe("La contraseña nueva tiene que ser distinta de la anterior.");
    expect(validarPassword("Corralon-2026", EMAIL, "corralon-2026")).toBeNull();
    expect(validarPassword("Corralon-2026", EMAIL)).toBeNull();
  });
});

describe("fortalezaPassword", () => {
  it.each<[string, number]>([
    ["", 0],
    ["abc", 0],
    ["aB1!", 2], // corta, pero mezcla y número+símbolo
    ["abcdefghij", 1], // 10, solo minúsculas
    ["abcdefghijklmn", 2], // 14
    ["Abcdefghij", 2], // 10 + mayús/minús
    ["Abcdefgh1!", 3], // 10 + mezcla + número y símbolo
    ["Abcdefghijkl1!", 4], // todo
    ["abcdefghijkl12", 2], // número sin símbolo no suma
    ["abcdefghijkl!!", 2], // símbolo sin número no suma
    ["ABCDEFGHIJKLMN", 2], // solo mayúsculas no suma mezcla
  ])("%j → %d", (p, esperado) => {
    expect(fortalezaPassword(p)).toBe(esperado);
  });
});

describe("generarPasswordTemporal", () => {
  const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  /** Aleatorio determinístico que devuelve los bytes dados (rellena con 0). */
  const fijo = (bytes: number[]) => (n: number) => {
    const out = new Uint8Array(n);
    out.set(bytes.slice(0, n));
    return out;
  };
  /** LCG simple para generar muchas contraseñas reproducibles. */
  const lcg = (semilla: number) => {
    let s = semilla >>> 0;
    return (n: number) => {
      const out = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        out[i] = s >>> 24;
      }
      return out;
    };
  };

  it("el alfabeto tiene 56 caracteres y ninguno ambiguo", () => {
    expect(ALFABETO).toHaveLength(56);
    for (const c of "0O1lI") expect(ALFABETO).not.toContain(c);
  });

  it("pide 12 bytes y mapea byte % 56 al alfabeto", () => {
    let pedidos = 0;
    // índices 0..11 → "ABCDEFGHJKLM": sin número → el último pasa a "7".
    const r = generarPasswordTemporal((n) => {
      pedidos = n;
      return fijo([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])(n);
    });
    expect(pedidos).toBe(12);
    expect(r).toBe("ABCDEFGHJKL7");
  });

  it("con número y mayúscula no toca nada; usa módulo 56 (56 → 'A', 255 → índice 31 'h')", () => {
    // 48 → '2', 56 → 'A', 255 % 56 = 31 → 'h'
    expect(generarPasswordTemporal(fijo([48, 56, 255, 24, 25, 26, 27, 28, 29, 30, 31, 32]))).toBe("2Ahabcdefghi");
  });

  it("sin mayúscula: el primer carácter pasa a 'K'", () => {
    // 24..35 → "abcdefghijkm", sin número → último "7", sin mayúscula → primero "K"
    expect(generarPasswordTemporal(fijo([24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35]))).toBe("Kbcdefghijk7");
  });

  it("todo ceros → 'AAAAAAAAAAA7'", () => {
    expect(generarPasswordTemporal(fijo([]))).toBe("AAAAAAAAAAA7");
  });

  it("OJO: si el único número está en la primera posición y no hay mayúscula, la 'K' lo pisa y queda sin número", () => {
    // 48 → '2', resto minúsculas
    const r = generarPasswordTemporal(fijo([48, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34]));
    expect(r).toBe("Kabcdefghijk");
    expect(/\d/.test(r)).toBe(false);
  });

  it("OJO: si la única mayúscula está al final y no hay número, el '7' la pisa (después se repone con la 'K')", () => {
    // 24..34 minúsculas + 0 ('A') al final
    expect(generarPasswordTemporal(fijo([24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 0]))).toBe("Kbcdefghijk7");
  });

  it("muchas semillas: siempre 12 caracteres del alfabeto con al menos una mayúscula", () => {
    for (let semilla = 1; semilla <= 500; semilla++) {
      const p = generarPasswordTemporal(lcg(semilla));
      expect(p).toHaveLength(12);
      for (const c of p) expect(ALFABETO).toContain(c);
      expect(p).toMatch(/[A-Z]/);
    }
  });
});

describe("inicialesDe", () => {
  it.each<[string, string | undefined, string]>([
    ["Felipe", "Nuñez", "FN"],
    ["felipe", "nuñez", "FN"],
    ["Felipe", undefined, "F"],
    ["Felipe Andrés", undefined, "FA"],
    ["  Felipe   ", "  Nuñez ", "FN"],
    ["", "Nuñez", "N"],
    ["", undefined, "U"],
    ["   ", "  ", "U"],
    ["Ángel", "Óscar", "ÁÓ"],
  ])("%j %j → %s", (nombre, apellido, esperado) => {
    expect(inicialesDe(nombre, apellido)).toBe(esperado);
  });

  it("OJO: con nombre compuesto toma las dos primeras palabras del nombre y no la del apellido", () => {
    expect(inicialesDe("Juan Cruz", "Benitez")).toBe("JC");
  });
});
