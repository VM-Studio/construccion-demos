/**
 * GET /api/<recurso> — lectura de negocio con filtros, búsqueda y paginación en el servidor:
 *   ?sucursal=&un=&estado=&desde=&hasta=&q=&pagina=&tamano=
 * Los datos salen del estado visible para el actor (ya filtrado por rol y circuito 2).
 * La búsqueda de artículos, clientes y proveedores usa pg_trgm (similitud) en la base.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { obtenerActor } from "@/server/auth/actor";
import { estadoPara } from "@/server/lectura";
import { posicionesDe, acopiosResumenDe, acopiosProveedorResumenDe, selectSaldosClientes, selectSaldosProveedores, hoyKey } from "@/store/calculos";
import { calcularAlertas } from "@/store/alertas-calc";
import { lineasPendientes } from "@/domain/stock";
import { ventasFacturadas, margenPeriodo } from "@/domain/metricas";
import { periodoDesdePreset } from "@/lib/periodos";
import type { EstadoInicial, Usuario } from "@/domain/types";

export const dynamic = "force-dynamic";

type Fila = Record<string, unknown>;
type Fuente = { coleccion?: keyof EstadoInicial; fecha?: string; texto?: (x: Fila) => string; trgm?: { tabla: string; columnas: string[] }; calcular?: (db: EstadoInicial, actor: Usuario) => Fila[] | Fila };

const RECURSOS: Record<string, Fuente> = {
  productos: { coleccion: "productos", texto: (x) => `${x.codigo} ${x.nombre} ${x.marca ?? ""} ${x.codigoBarras ?? ""}`, trgm: { tabla: "Producto", columnas: ["nombre", "codigo"] } },
  clientes: { coleccion: "clientes", texto: (x) => `${x.codigo} ${x.razonSocial} ${x.nombreFantasia ?? ""} ${x.cuit}`, trgm: { tabla: "Cliente", columnas: ["razonSocial", "nombreFantasia"] } },
  proveedores: { coleccion: "proveedores", texto: (x) => `${x.codigo} ${x.razonSocial} ${x.cuit}`, trgm: { tabla: "Proveedor", columnas: ["razonSocial"] } },
  "notas-pedido": { coleccion: "notasPedido", fecha: "fecha", texto: (x) => String(x.numero) },
  acopios: { coleccion: "acopios", fecha: "fechaCreacion", texto: (x) => String(x.numero) },
  "acopios-proveedor": { coleccion: "acopiosProveedor", fecha: "fechaCreacion", texto: (x) => String(x.numero) },
  "ordenes-compra": { coleccion: "ordenesCompra", fecha: "fechaEmision", texto: (x) => String(x.numero) },
  recepciones: { coleccion: "recepciones", fecha: "fecha", texto: (x) => `${x.numero} ${x.remitoProveedor}` },
  remitos: { coleccion: "remitos", fecha: "fecha", texto: (x) => String(x.numero) },
  despachos: { coleccion: "despachos", fecha: "fechaProgramada", texto: (x) => String(x.numero) },
  comprobantes: { coleccion: "comprobantes", fecha: "fecha", texto: (x) => String(x.numero) },
  recibos: { coleccion: "cobranzas", fecha: "fecha", texto: (x) => String(x.numero) },
  "ordenes-pago": { coleccion: "pagosProveedores", fecha: "fecha", texto: (x) => String(x.numero) },
  cheques: { coleccion: "cheques", fecha: "fechaCobro", texto: (x) => `${x.banco} ${x.numero}` },
  configuracion: { calcular: (db) => ({ ...db.config }) },
  stock: {
    calcular: (db) =>
      [...posicionesDe(db).values()].flatMap((p) =>
        Object.entries(p.porDeposito).map(([depositoId, d]) => ({ productoId: p.producto.id, codigo: p.producto.codigo, nombre: p.producto.nombre, unidadNegocioId: p.producto.unidadNegocioId, depositoId, ...d, estado: p.estado })),
      ),
  },
  "pendientes-entrega": { calcular: (db) => lineasPendientes(db.notasPedido, db.remitos) as unknown as Fila[] },
  "cuentas-corrientes": {
    calcular: (db) => {
      const cli = selectSaldosClientes(db.comprobantes, hoyKey());
      const prov = selectSaldosProveedores(db.comprobantes, hoyKey());
      return [...[...cli].map(([id, s]) => ({ tipo: "cliente", id, ...s })), ...[...prov].map(([id, s]) => ({ tipo: "proveedor", id, ...s }))];
    },
  },
  kpis: {
    calcular: (db) => {
      const mes = periodoDesdePreset("MES");
      const acopios = acopiosResumenDe(db).filter((a) => a.estado === "VIGENTE" || a.estado === "VENCIDO");
      const acps = acopiosProveedorResumenDe(db).filter((a) => a.estado === "VIGENTE" || a.estado === "VENCIDO");
      const pend = lineasPendientes(db.notasPedido, db.remitos);
      return {
        ventasMes: ventasFacturadas(db, mes, null),
        margenMes: margenPeriodo(db, mes, null).margen,
        porCobrar: db.comprobantes.filter((c) => c.clienteId && c.estado !== "ANULADO").reduce((s, c) => s + c.saldoPendiente, 0),
        deudaMercaderia: acopios.reduce((s, a) => s + Math.max(0, a.saldo), 0),
        acopiosProveedores: acps.reduce((s, a) => s + a.pendientePesos, 0),
        pendientesEntrega: pend.reduce((s, l) => s + l.pendiente * l.precio, 0),
        remitosSinFirmar: db.remitos.filter((r) => r.estado === "HECHO" && !r.firmadoAdjuntoId && (r.tipo === "VENTA" || r.tipo === "DESACOPIO")).length,
      };
    },
  },
  alertas: { calcular: (db, actor) => calcularAlertas(db, null, actor, hoyKey()).map(({ icono: _i, ...a }) => (void _i, a)) },
};

export async function GET(req: Request, { params }: { params: Promise<{ recurso: string }> }) {
  const { recurso } = await params;
  const fuente = RECURSOS[recurso];
  if (!fuente) return NextResponse.json({ error: "Recurso inexistente" }, { status: 404 });
  const actor = await obtenerActor();
  if (!actor) return NextResponse.json({ error: "Sesión requerida" }, { status: 401 });
  const { version, db } = await estadoPara(actor);
  const q = new URL(req.url).searchParams;
  const h = { "Cache-Control": "no-store" };

  let filas: Fila[];
  if (fuente.calcular) {
    const r = fuente.calcular(db, actor);
    if (!Array.isArray(r)) return NextResponse.json({ version: String(version), dato: r }, { headers: h });
    filas = r;
  } else filas = db[fuente.coleccion!] as unknown as Fila[];

  const sucursal = q.get("sucursal");
  const un = q.get("un");
  const estado = q.get("estado");
  const desde = q.get("desde");
  const hasta = q.get("hasta");
  if (sucursal) filas = filas.filter((x) => !("sucursalId" in x) || x.sucursalId === sucursal);
  if (un) filas = filas.filter((x) => !("unidadNegocioId" in x) || x.unidadNegocioId === un);
  if (estado) {
    const set = new Set(estado.split(","));
    filas = filas.filter((x) => set.has(String(x.estado)));
  }
  if (fuente.fecha && (desde || hasta)) filas = filas.filter((x) => (!desde || String(x[fuente.fecha!]) >= desde) && (!hasta || String(x[fuente.fecha!]) <= hasta));

  const texto = q.get("q")?.trim();
  if (texto) {
    if (fuente.trgm) {
      // Similitud por trigramas en la base (índices GIN); se cruza con lo visible para el actor.
      const cols = fuente.trgm.columnas.map((c) => `similarity(coalesce("${c}", ''), $1)`).join(", ");
      const conds = fuente.trgm.columnas.map((c) => `coalesce("${c}", '') ILIKE '%' || $1 || '%' OR "${c}" % $1`).join(" OR ");
      const ids = await prisma.$queryRawUnsafe<{ id: string }[]>(`SELECT "id" FROM "${fuente.trgm.tabla}" WHERE ${conds} ORDER BY GREATEST(${cols}) DESC LIMIT 500`, texto);
      const orden = new Map(ids.map((x, i) => [x.id, i]));
      filas = filas.filter((x) => orden.has(String(x.id))).sort((a, b) => orden.get(String(a.id))! - orden.get(String(b.id))!);
    } else if (fuente.texto) {
      const t = texto.toLowerCase();
      filas = filas.filter((x) => fuente.texto!(x).toLowerCase().includes(t));
    }
  }
  if (fuente.fecha) filas = [...filas].sort((a, b) => String(b[fuente.fecha!]).localeCompare(String(a[fuente.fecha!])));

  const tamano = Math.min(1000, Math.max(1, Number(q.get("tamano")) || 100));
  const pagina = Math.max(0, Number(q.get("pagina")) || 0);
  return NextResponse.json({ version: String(version), total: filas.length, pagina, tamano, filas: filas.slice(pagina * tamano, pagina * tamano + tamano) }, { headers: h });
}
