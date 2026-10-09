/**
 * Datos de ejemplo SOLO para desarrollo local (rama de Neon `desarrollo`).
 * Se niega a correr en producción o en Vercel. Reemplaza todo el contenido de la base.
 */
import { prisma } from "../src/server/db-base";
import { seedEjemplo } from "../src/data/seed";
import { COLECCIONES, guardarConfig, insertarMuchos } from "../src/server/datos/mapeo";
import { CONDICIONES_PAGO } from "./condiciones";
import bcrypt from "bcryptjs";

if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
  console.error("✘ db:seed:ejemplo está bloqueado en producción.");
  process.exit(1);
}
if (/ep-lingering-shape/.test(process.env.DATABASE_URL ?? "")) {
  console.error("✘ DATABASE_URL apunta a la base de producción: db:seed:ejemplo solo corre contra la rama `desarrollo`.");
  process.exit(1);
}

async function main() {
  const t0 = Date.now();
  const db = seedEjemplo(new Date());
  // Vaciar (orden inverso; los ítems se borran en cascada).
  for (const k of [...COLECCIONES].reverse()) await (prisma as unknown as Record<string, { deleteMany: () => Promise<unknown> }>)[modeloDelegado(k)].deleteMany();
  await prisma.contador.deleteMany();
  await prisma.cambio.deleteMany();
  let n = 0;
  // Los usuarios de ejemplo no tienen contraseña utilizable (hash inválido): se entra restableciéndola
  // desde un dueño, o con EJEMPLO_PASSWORD (solo desarrollo) si se define al correr el seed.
  const hash = process.env.EJEMPLO_PASSWORD ? await bcrypt.hash(process.env.EJEMPLO_PASSWORD, 10) : "!sin-acceso";
  for (const k of COLECCIONES) {
    if (k === "usuarios") {
      for (const u of db.usuarios) {
        const { id, nombre, apellido, email, rol, sucursalId, activo, avatarIniciales, creadoEn, actualizadoEn } = u;
        await prisma.usuario.create({ data: { id, nombre, apellido: apellido ?? null, email, rol, sucursalId: sucursalId ?? null, activo, avatarIniciales, creadoEn: new Date(creadoEn), actualizadoEn: new Date(actualizadoEn), passwordHash: hash } });
      }
      n += db.usuarios.length;
      continue;
    }
    await insertarMuchos(prisma, k, db[k] as object[]);
    n += (db[k] as object[]).length;
  }
  await guardarConfig(prisma, db.config);
  for (const [tipo, ultimo] of Object.entries(db.numeradores)) await prisma.contador.create({ data: { id: `cnt_${tipo}`, tipo, ultimo } });
  for (const [i, c] of CONDICIONES_PAGO.entries()) await prisma.condicionPago.upsert({ where: { codigo: c.codigo }, create: { ...c, orden: i }, update: {} });
  console.log(`✔ Datos de ejemplo cargados: ${n} registros en ${Math.round((Date.now() - t0) / 1000)} s.`);
}

function modeloDelegado(k: string) {
  const m = ({ sucursales: "Sucursal", depositos: "Deposito", usuarios: "Usuario", unidadesNegocio: "UnidadNegocio", rubros: "Rubro", proveedores: "Proveedor", productos: "Producto", listasPrecios: "ListaPrecios", precios: "PrecioProducto", stock: "StockDeposito", movimientos: "MovimientoStock", transferencias: "TransferenciaStock", ajustes: "AjusteStock", ordenesCompra: "OrdenCompra", recepciones: "RecepcionMercaderia", acopiosProveedor: "AcopioProveedor", clientes: "Cliente", obras: "Obra", cotizaciones: "Cotizacion", notasPedido: "NotaPedido", devoluciones: "DevolucionNP", ajustesAcopio: "AjusteAcopio", acopios: "Acopio", remitos: "Remito", adjuntos: "Adjunto", comprobantes: "Comprobante", vehiculos: "Vehiculo", choferes: "Chofer", despachos: "Despacho", hojasRuta: "HojaRuta", cobranzas: "Recibo", pagosProveedores: "OrdenPago", cheques: "Cheque", auditoria: "Auditoria" } as Record<string, string>)[k];
  return m.charAt(0).toLowerCase() + m.slice(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
