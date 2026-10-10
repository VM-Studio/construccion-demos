/**
 * Servicios críticos contra una base real (branch Neon `test`, con los datos de ejemplo cargados
 * por preparar.ts): numeración y stock bajo concurrencia, acopios, remitos y registro.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db-base";
import { invalidarCache, obtenerEstado } from "@/server/estado";
import { crearNotaPedido, registrarDevolucion } from "@/server/servicios/ventas";
import { generarRemito, marcarRemitoHecho } from "@/server/servicios/remitos";
import { crearAjuste } from "@/server/servicios/stock";
import { registrarPrimerDueno } from "@/server/auth/servicio";
import { posicionesDe } from "@/store/calculos";
import { saldoDisponible } from "@/domain/acopios";
import type { Usuario } from "@/domain/types";

const HOLCIM = "prod_50104";
const DEP = "dep_central";
const hoy = () => new Date().toISOString();
let dueno: Usuario;
let vendedor: Usuario;

const estado = async () => {
  invalidarCache();
  return (await obtenerEstado()).db;
};
const posicion = async (pid: string, dep = DEP) => posicionesDe(await estado()).get(pid)!.porDeposito[dep];
const idDe = (data: unknown) => (typeof data === "string" ? data : (data as { id: string }).id);

const venta = (cantidad: number, extra: Record<string, unknown> = {}) => ({
  clienteId: "cli_bencen",
  sucursalId: "suc_central",
  depositoId: DEP,
  fecha: hoy(),
  circuito: 1 as const,
  origen: "NUEVA" as const,
  formaPago: "CONTADO" as const,
  items: [{ productoId: HOLCIM, cantidad, precioUnitario: 15000 }],
  descuentoPct: 0,
  pendienteEntrega: true,
  modalidadEntrega: "RETIRA" as const,
  ...extra,
});

async function reponer(cantidad: number) {
  const r = await crearAjuste(dueno, { depositoId: DEP, items: [{ productoId: HOLCIM, cantidad, signo: 1, motivo: "SOBRANTE" }], observacion: "Prueba de integración" });
  expect(r.ok, r.ok ? "" : r.error).toBe(true);
}

beforeAll(async () => {
  const db = await estado();
  dueno = db.usuarios.find((u) => u.rol === "DUENO" && u.activo)!;
  vendedor = db.usuarios.find((u) => u.rol === "VENTAS" && u.activo)!;
  expect(dueno && vendedor).toBeTruthy();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Numeración concurrente", () => {
  it("20 notas de pedido en paralelo reciben 20 números distintos y consecutivos", async () => {
    await reponer(40);
    const res = await Promise.all(Array.from({ length: 20 }, () => crearNotaPedido(dueno, venta(1))));
    const fallidas = res.filter((r) => !r.ok);
    expect(fallidas.map((r) => (r.ok ? "" : r.error))).toEqual([]);
    const nps = await prisma.notaPedido.findMany({ where: { id: { in: res.map((r) => idDe(r.ok && r.data)) } }, select: { numero: true } });
    const nums = nps.map((n) => Number(n.numero!.split("-").at(-1))).sort((a, b) => a - b);
    expect(new Set(nums).size).toBe(20);
    expect(nums.at(-1)! - nums[0]).toBe(19);
  }, 300_000); // desde fuera de us-east cada transacción suma latencia
});

describe("Sobreventa concurrente", () => {
  it("dos ventas de las últimas unidades a la vez: pasa una sola y el disponible queda en 0", async () => {
    await reponer(10);
    const disp = (await posicion(HOLCIM)).disponible;
    expect(disp).toBeGreaterThan(0);
    const res = await Promise.all([crearNotaPedido(vendedor, venta(disp)), crearNotaPedido(vendedor, venta(disp))]);
    expect(res.filter((r) => r.ok)).toHaveLength(1);
    const rechazo = res.find((r) => !r.ok) as { error: string; codigo?: string };
    expect(rechazo.codigo).toBe("SIN_DISPONIBLE");
    expect((await posicion(HOLCIM)).disponible).toBe(0);
  });
});

describe("Acopios", () => {
  it("un retiro que excede el saldo del acopio se rechaza y el saldo no cambia", async () => {
    await reponer(60); // hay disponible: el rechazo tiene que ser por saldo, no por stock
    const db = await estado();
    const ramos = db.acopios.find((a) => a.numero === "AC2 0001-00003633")!;
    const antes = saldoDisponible(ramos, db.notasPedido, db.devoluciones, db.ajustesAcopio);
    const r = await crearNotaPedido(vendedor, {
      ...venta(40),
      clienteId: ramos.clienteId,
      sucursalId: ramos.sucursalId,
      depositoId: ramos.depositoId,
      circuito: 2,
      origen: "ACOPIO",
      acopioId: ramos.id,
      formaPago: "ACOPIO",
      items: [{ productoId: HOLCIM, obraId: "obra_ramos_2", cantidad: 40, precioUnitario: 1 }],
      pendienteEntrega: false,
    } as never);
    expect(r.ok).toBe(false);
    expect((r as { codigo?: string }).codigo).toBe("SALDO_ACOPIO");
    const db2 = await estado();
    expect(saldoDisponible(db2.acopios.find((a) => a.id === ramos.id)!, db2.notasPedido, db2.devoluciones, db2.ajustesAcopio)).toBeCloseTo(antes, 2);
  });

  it("una devolución de NP de acopio repone el saldo del acopio", async () => {
    const db = await estado();
    const np = db.notasPedido.find((n) => n.origen === "ACOPIO" && n.acopioId !== "aco_ramos_3633" && n.estado === "ENTREGADA" && n.items.some((i) => i.entregados - (i.devueltos ?? 0) >= 2))!;
    expect(np).toBeTruthy();
    const it_ = np.items.find((i) => i.entregados - (i.devueltos ?? 0) >= 2)!;
    const acopio = () => db.acopios.find((a) => a.id === np.acopioId)!;
    const antes = saldoDisponible(acopio(), db.notasPedido, db.devoluciones, db.ajustesAcopio);
    const r = await registrarDevolucion(dueno, { notaPedidoId: np.id, items: [{ itemId: it_.id, cantidad: 2 }], motivo: "Sobrante de obra (prueba)" });
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    const db2 = await estado();
    const despues = saldoDisponible(db2.acopios.find((a) => a.id === np.acopioId)!, db2.notasPedido, db2.devoluciones, db2.ajustesAcopio);
    expect(despues).toBeCloseTo(antes + 2 * it_.precioUnitario, 2);
  });
});

describe("Remitos", () => {
  it("marcar el remito como hecho baja el stock físico y suma los entregados de la NP", async () => {
    await reponer(5);
    const fisico = (await posicion(HOLCIM)).fisico;
    const np = await crearNotaPedido(dueno, venta(3, { modalidadEntrega: "ENVIO" }));
    expect(np.ok, np.ok ? "" : np.error).toBe(true);
    const npId = idDe(np.ok && np.data);
    const rem = await generarRemito(dueno, npId, { estado: "PICKING" });
    expect(rem.ok, rem.ok ? "" : rem.error).toBe(true);
    expect((await posicion(HOLCIM)).fisico).toBe(fisico);
    const hecho = await marcarRemitoHecho(dueno, idDe(rem.ok && rem.data));
    expect(hecho.ok, hecho.ok ? "" : hecho.error).toBe(true);
    expect((await posicion(HOLCIM)).fisico).toBe(fisico - 3);
    const npDb = (await estado()).notasPedido.find((n) => n.id === npId)!;
    expect(npDb.items[0].entregados).toBe(3);
    expect(npDb.estado).toBe("ENTREGADA");
  });
});

describe("Registro del primer dueño", () => {
  it("dos registros a la vez con la base sin usuarios: se crea uno solo", async () => {
    // Se guardan los usuarios de ejemplo (no tienen relaciones) y se restauran al final.
    const usuarios = await prisma.usuario.findMany();
    await prisma.usuario.deleteMany();
    try {
      const sello = Date.now().toString(36);
      const datos = (n: number) => ({ nombre: `Dueño ${n}`, apellido: "Prueba", email: `primero.${n}.${sello}@aceros-rnf.test`, password: `Clave-larga-${sello}-${n}` });
      const res = await Promise.all([registrarPrimerDueno(datos(1), {}), registrarPrimerDueno(datos(2), {})]);
      expect(res.filter((r) => r.ok)).toHaveLength(1);
      expect(await prisma.usuario.count()).toBe(1);
      const tercero = await registrarPrimerDueno(datos(3), {});
      expect(tercero.ok).toBe(false);
    } finally {
      await prisma.usuario.deleteMany();
      await prisma.usuario.createMany({ data: usuarios });
      invalidarCache();
    }
  });
});

describe("Estado en memoria de cada instancia", () => {
  it("la actualización incremental por filas da lo mismo que leer toda la base", async () => {
    const g = globalThis as unknown as { __estadoAceros?: { version: bigint; db: unknown } };
    const viejo = await obtenerEstado(); // "otra instancia" que quedó en esta versión
    // Escrituras desde "esta" instancia: alta de cliente, venta (NP + stock) y remito hecho.
    const { guardarCliente } = await import("@/server/servicios/clientes");
    const sello = Date.now().toString(36);
    const c = await guardarCliente(dueno, { codigo: "", razonSocial: `Incremental ${sello}`, tipo: "PARTICULAR", cuit: "", condicionIVA: "CF", circuitoHabitual: 1, email: "", telefono: "", direccion: "", localidad: "", listaPreciosId: "lst_pub", condicionPago: "CONTADO", limiteCredito: 0, sucursalPreferidaId: "suc_central", activo: true } as never);
    expect(c.ok, c.ok ? "" : c.error).toBe(true);
    await reponer(5);
    const np = await crearNotaPedido(dueno, venta(2, { modalidadEntrega: "ENVIO" }));
    expect(np.ok).toBe(true);
    const rem = await generarRemito(dueno, idDe(np.ok && np.data), { estado: "PICKING" });
    expect(rem.ok).toBe(true);
    await marcarRemitoHecho(dueno, idDe(rem.ok && rem.data));
    // La "otra instancia" se pone al día en forma incremental…
    g.__estadoAceros = viejo;
    const incremental = (await obtenerEstado()).db;
    // …y tiene que coincidir con una lectura completa.
    invalidarCache();
    const completo = (await obtenerEstado()).db;
    const ordenar = (xs: { id: string }[]) => [...xs].sort((a, b) => a.id.localeCompare(b.id));
    for (const k of ["clientes", "notasPedido", "remitos", "stock", "ajustes", "despachos", "comprobantes"] as const) {
      expect(ordenar(incremental[k] as { id: string }[]), k).toEqual(ordenar(completo[k] as { id: string }[]));
    }
    expect(incremental.numeradores).toEqual(completo.numeradores);
  });
});

describe("Duplicar artículo y crear serie", () => {
  it("solo crean artículos nuevos: los existentes, sus precios, su stock y los movimientos no cambian", async () => {
    const { duplicarProducto, crearSerieProductos } = await import("@/server/servicios/catalogo");
    const foto = async () => {
      const db = await estado();
      return {
        productos: new Map(db.productos.map((p) => [p.id, JSON.stringify(p)])),
        precios: new Map(db.precios.map((p) => [p.id, JSON.stringify(p)])),
        stock: new Map(db.stock.map((s) => [s.id, JSON.stringify(s)])),
        movimientos: await prisma.movimientoStock.count(),
        acopiosCongelados: await prisma.precioCongelado.count(),
      };
    };
    const antes = await foto();
    const db = await estado();
    const origen = db.productos.find((p) => p.costoUltimo > 0 && db.precios.filter((x) => x.productoId === p.id).length === db.listasPrecios.length)!;
    const stockOrigenAntes = db.stock.filter((s) => s.productoId === origen.id).map((s) => s.cantidadFisica);
    const sello = Date.now().toString(36).toUpperCase();

    // 1) Duplicar con otro costo: precios recalculados con el markup efectivo del origen.
    const nuevoCosto = Math.round(origen.costoUltimo * 1.37 * 100) / 100;
    const d = await duplicarProducto(dueno, origen.id, { codigo: `DUP${sello}`, nombre: `${origen.nombre} dup ${sello}`, costoUltimo: nuevoCosto });
    expect(d.ok, d.ok ? "" : d.error).toBe(true);
    const idDup = idDe(d.ok && d.data);
    // Nombre igual al del origen en el mismo rubro: se rechaza y no crea nada.
    const igual = await duplicarProducto(dueno, origen.id, { codigo: `DUQ${sello}`, nombre: origen.nombre });
    expect(igual.ok).toBe(false);
    expect((igual as { error: string }).error).toMatch(/Ya existe un artículo/);

    // 2) Serie de 3 + una serie con una fila inválida (no se crea ninguna).
    const filas = [1, 2, 3].map((n) => ({ codigo: `SER${sello}${n}`, nombre: `${origen.nombre} serie ${sello} ${n}`, pesoKg: n, costoUltimo: 100 * n, stockMinimo: 0 }));
    const s = await crearSerieProductos(dueno, origen.id, filas);
    expect(s.ok, s.ok ? "" : s.error).toBe(true);
    const mala = await crearSerieProductos(dueno, origen.id, [{ ...filas[0], codigo: `MAL${sello}1`, nombre: `ok ${sello}` }, { ...filas[1], codigo: `MAL${sello}2`, nombre: `ok2 ${sello}`, costoUltimo: 0 }]);
    expect(mala.ok).toBe(false);

    const despues = await foto();
    const db2 = await estado();
    // Existentes: mismo contenido, fila por fila.
    for (const [id, json] of antes.productos) expect(despues.productos.get(id), `producto ${id}`).toBe(json);
    for (const [id, json] of antes.precios) expect(despues.precios.get(id), `precio ${id}`).toBe(json);
    for (const [id, json] of antes.stock) expect(despues.stock.get(id), `stock ${id}`).toBe(json);
    // Cantidades: exactamente 1 + 3 artículos nuevos; sin movimientos ni precios congelados nuevos.
    expect(despues.productos.size).toBe(antes.productos.size + 4);
    expect(despues.movimientos).toBe(antes.movimientos);
    expect(despues.acopiosCongelados).toBe(antes.acopiosCongelados);
    expect(db2.productos.some((p) => p.codigo.startsWith(`MAL${sello}`))).toBe(false);
    // El origen quedó intacto: mismo stock y mismos precios.
    expect(db2.stock.filter((x) => x.productoId === origen.id).map((x) => x.cantidadFisica)).toEqual(stockOrigenAntes);
    // El duplicado: stock 0, sin código de barras, costo promedio = costo, precios con el markup del origen.
    const dup = db2.productos.find((p) => p.id === idDup)!;
    expect(dup.codigoBarras ?? "").toBe("");
    expect(dup.costoPromedio).toBe(nuevoCosto);
    expect(db2.stock.filter((x) => x.productoId === idDup).every((x) => x.cantidadFisica === 0)).toBe(true);
    for (const l of db2.listasPrecios) {
      const pOrig = db2.precios.find((x) => x.productoId === origen.id && x.listaPreciosId === l.id)!.precio;
      const pDup = db2.precios.find((x) => x.productoId === idDup && x.listaPreciosId === l.id)!.precio;
      expect(Math.abs(pDup - nuevoCosto * (pOrig / origen.costoUltimo))).toBeLessThanOrEqual(5); // redondeo a $10
    }
    // Auditoría de la serie.
    const aud = await prisma.auditoria.findFirst({ where: { accion: "Creó serie de artículos", entidadId: origen.id }, orderBy: { fecha: "desc" } });
    expect(aud?.detalle).toMatch(new RegExp(`Creó una serie de 3 artículos a partir de ${origen.codigo}`));
  });
});
