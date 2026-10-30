/**
 * Mejoras de la reunión con los dueños contra la base real: cotización rápida → venta en un paso
 * con cobro en dólares y caja chica, anulación en cascada, arqueo, tipos de cliente y lista especial.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db-base";
import { invalidarCache, obtenerEstado } from "@/server/estado";
import { aceptarCotizacion, anularVenta, guardarCotizacion, recuperarVenta } from "@/server/servicios/ventas";
import { guardarCaja, registrarArqueo, registrarMovimientoCaja, transferirEntreCajas } from "@/server/servicios/finanzas";
import { guardarTiposCliente } from "@/server/servicios/configuracion";
import { guardarLista } from "@/server/servicios/catalogo";
import { crearAjuste } from "@/server/servicios/stock";
import { saldoCaja, prestamosPendientes } from "@/domain/caja";
import { precioLista } from "@/domain/precios";
import type { Usuario } from "@/domain/types";

const HOLCIM = "prod_50104";
const estado = async () => {
  invalidarCache();
  return (await obtenerEstado()).db;
};
let dueno: Usuario;

beforeAll(async () => {
  dueno = (await estado()).usuarios.find((u) => u.rol === "DUENO" && u.activo)!;
  const r = await crearAjuste(dueno, { depositoId: "dep_central", items: [{ productoId: HOLCIM, cantidad: 50, signo: 1, motivo: "SOBRANTE" }], observacion: "Prueba reunión" });
  expect(r.ok).toBe(true);
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("Cotización rápida → venta en un paso → anular → recuperar", () => {
  it("persiste todo y la caja vuelve a cero al anular", async () => {
    const c = await guardarCotizacion(dueno, { prospectoNombre: "Integración Rápida", prospectoTelefono: "1100000000", tipoCliente: "CONSUMIDOR_FINAL", sucursalId: "suc_central", circuito: 2, fecha: new Date().toISOString(), validezDias: 7, items: [{ id: "", productoId: HOLCIM, cantidad: 3, precioUnitario: 10000, costoUnitarioSnapshot: 0, descuentoPct: 0 }], descuentoPct: 0 });
    expect(c.ok, c.ok ? "" : c.error).toBe(true);
    const cotId = (c as { data: string }).data;
    expect((await estado()).cotizaciones.find((x) => x.id === cotId)?.clienteId).toBeUndefined();
    const caja = (await estado()).cajas[0];
    const usdAntes = saldoCaja(caja.id, "USD", (await estado()).movimientosCaja);
    const a = await aceptarCotizacion(dueno, cotId, { cliente: { razonSocial: "Integración Rápida", condicionIVA: "CF" }, circuito: 2, formaPago: "CONTADO", entrega: "RETIRA_AHORA", facturar: true, cobro: { medios: [{ medio: "EFECTIVO", importe: 30000, moneda: "USD", importeME: 20, tipoCambio: 1500, cajaId: caja.id }] } });
    expect(a.ok, a.ok ? "" : a.error).toBe(true);
    const v = (a as { data: { npId: string; facturaId: string; reciboId: string; clienteId: string } }).data;
    let db = await estado();
    expect(db.clientes.some((x) => x.id === v.clienteId)).toBe(true);
    expect(db.comprobantes.find((x) => x.id === v.facturaId)?.saldoPendiente).toBe(0);
    expect(db.cobranzas.find((x) => x.id === v.reciboId)?.medios[0].importeME).toBe(20);
    expect(saldoCaja(caja.id, "USD", db.movimientosCaja)).toBe(usdAntes + 20);
    const an = await anularVenta(dueno, v.npId, "Prueba");
    expect(an.ok, an.ok ? "" : an.error).toBe(true);
    db = await estado();
    expect(db.notasPedido.find((x) => x.id === v.npId)?.estado).toBe("ANULADA");
    expect(db.cobranzas.find((x) => x.id === v.reciboId)?.anulado).toBe(true);
    expect(saldoCaja(caja.id, "USD", db.movimientosCaja)).toBe(usdAntes);
    const rec = await recuperarVenta(dueno, v.npId);
    expect(rec.ok).toBe(true);
    expect((await estado()).cotizaciones.find((x) => x.id === cotId)?.estado).toBe("PENDIENTE");
  });
});

describe("Caja chica, tipos de cliente y lista especial", () => {
  it("préstamo entre cajas y arqueo con billetes", async () => {
    const nueva = await guardarCaja(dueno, { nombre: `Caja integración ${Date.now()}`, activa: true });
    expect(nueva.ok).toBe(true);
    const origen = (await estado()).cajas[0];
    const ing = await registrarMovimientoCaja(dueno, { cajaId: origen.id, fecha: new Date().toISOString(), tipo: "INGRESO", moneda: "USD", importe: 10, concepto: "Aporte de prueba" });
    expect(ing.ok, ing.ok ? "" : ing.error).toBe(true);
    const t = await transferirEntreCajas(dueno, { origenId: origen.id, destinoId: (nueva as { data: string }).data, fecha: new Date().toISOString(), moneda: "USD", importe: 5, tipo: "PRESTAMO" });
    expect(t.ok, t.ok ? "" : t.error).toBe(true);
    expect(prestamosPendientes((await estado()).movimientosCaja).some((p) => p.deudorId === (nueva as { data: string }).data)).toBe(true);
    const arq = await registrarArqueo(dueno, { cajaId: origen.id, moneda: "ARS", contado: 1000, billetes: [{ denominacion: 1000, cantidad: 1 }] });
    expect(arq.ok, arq.ok ? "" : arq.error).toBe(true);
    expect((await estado()).arqueosCaja.at(-1)?.billetes?.[0]?.cantidad).toBe(1);
  });

  it("tipos de cliente editables y lista especial por rubro", async () => {
    const db = await estado();
    const r = await guardarTiposCliente(dueno, [...db.config.tiposCliente, { codigo: "REVENDEDOR", nombre: "Revendedor", activo: true }]);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);
    expect((await estado()).config.tiposCliente.some((t) => t.codigo === "REVENDEDOR")).toBe(true);
    const cli = db.clientes.find((c) => !db.listasPrecios.some((l) => l.clienteId === c.id))!;
    const prod = db.productos.find((p) => p.id === HOLCIM)!;
    const l = await guardarLista(dueno, { nombre: "Especial prueba", descripcion: "", markupPorDefecto: 22, activa: true, clienteId: cli.id, listaBaseId: "lst_may", ajustePct: -5, reglasRubro: [{ rubroId: prod.rubroId, markupPct: 12 }] });
    expect(l.ok, l.ok ? "" : l.error).toBe(true);
    const d2 = await estado();
    const lista = d2.listasPrecios.find((x) => x.clienteId === cli.id)!;
    expect(lista.reglasRubro?.[0].markupPct).toBe(12);
    expect(d2.clientes.find((c) => c.id === cli.id)?.listaPreciosId).toBe(lista.id);
    expect(precioLista(HOLCIM, lista.id, d2)).toBeGreaterThan(0);
  });
});
