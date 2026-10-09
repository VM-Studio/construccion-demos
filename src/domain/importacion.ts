/**
 * Importación masiva desde CSV: plantillas, mapeo automático de columnas y
 * validación fila a fila. Funciones puras: no tocan el store ni React.
 */
import type {
  Circuito,
  Cliente,
  CondicionIVA,
  CondicionPago,
  EstadoInicial,
  Producto,
  Proveedor,
  TipoCliente,
  TipoProveedor,
  Unidad,
} from "./types";
import { validarCUIT, formatearCUIT } from "./cuit";
import { siguienteCodigoProducto } from "./productos";

export type TipoImportacion = "articulos" | "clientes" | "proveedores";

type ProductoInput = Omit<Producto, "id" | "creadoEn" | "actualizadoEn">;
type ClienteInput = Omit<Cliente, "id" | "creadoEn" | "actualizadoEn">;
type ProveedorInput = Omit<Proveedor, "id" | "creadoEn" | "actualizadoEn">;

export interface ClienteImportado {
  cliente: ClienteInput;
  obras: string[];
}

export interface DatosImportacion {
  articulos: ProductoInput;
  clientes: ClienteImportado;
  proveedores: ProveedorInput;
}

export type DbImportacion = Pick<
  EstadoInicial,
  "rubros" | "unidadesNegocio" | "listasPrecios" | "proveedores" | "productos" | "clientes" | "sucursales"
>;

/** Estado compartido entre filas de un mismo archivo (duplicados internos, códigos autogenerados). */
export interface ContextoValidacion {
  ahora: string;
  codigosVistos: Map<string, number>;
  cuitsVistos: Map<string, number>;
  /** Códigos de artículo autogenerados en filas anteriores, por rubro. */
  productosGenerados: Pick<Producto, "codigo" | "rubroId">[];
  /** Número de fila (1 = primera fila de datos). */
  fila: number;
}

export function crearContexto(ahora = new Date().toISOString()): ContextoValidacion {
  return { ahora, codigosVistos: new Map(), cuitsVistos: new Map(), productosGenerados: [], fila: 0 };
}

export interface ResultadoFila<T> {
  ok: boolean;
  errores: string[];
  datos?: T;
}

/** Fila ya mapeada: clave = columna del sistema, valor = texto de la celda. */
export type FilaSistema = Record<string, string>;
/** Mapeo columna del sistema → cabecera del archivo ("" = sin asignar). */
export type Mapeo = Record<string, string>;

export interface ColumnaPlantilla {
  clave: string;
  etiqueta: string;
  requerida?: boolean;
  sinonimos: string[];
}

// ───────────────────────── Normalización ─────────────────────────

/** Sin acentos, minúsculas, espacios/guiones/puntos → `_`. */
export function normalizarClave(s: string): string {
  return (s ?? "")
    .replace(/^﻿/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/³/g, "3")
    .replace(/²/g, "2")
    .replace(/[\s\-./]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Texto para comparar valores (sin acentos, minúsculas, espacios simples). */
function norm(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/³/g, "3")
    .replace(/²/g, "2")
    .replace(/[.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Convierte un número en formato argentino ("1.234,56") o con punto decimal
 * ("1234.56"). Un número con puntos cada 3 dígitos y sin coma ("6.500") se toma
 * como separador de miles. Devuelve null si está vacío y NaN si es inválido.
 */
export function parsearNumero(valor: string): number | null {
  let s = (valor ?? "").replace(/\$|ARS|\s/gi, "").trim();
  if (!s) return null;
  const neg = s.startsWith("-");
  if (neg) s = s.slice(1);
  const coma = s.lastIndexOf(",");
  const punto = s.lastIndexOf(".");
  if (coma >= 0 && punto >= 0) {
    s = coma > punto ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (coma >= 0) {
    s = /^\d{1,3}(,\d{3}){2,}$/.test(s) ? s.replace(/,/g, "") : s.replace(/,/g, ".");
  } else if (punto >= 0 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
  const n = Number(s);
  return neg ? -n : n;
}

// ───────────────────────── Catálogos de valores ─────────────────────────

const UNIDADES: Record<string, Unidad> = {
  un: "UN", u: "UN", uni: "UN", unid: "UN", unidad: "UN", unidades: "UN", c_u: "UN", cu: "UN", pza: "UN", pieza: "UN", barra: "UN", barras: "UN",
  bolsa: "BOLSA", bolsas: "BOLSA", bol: "BOLSA", bls: "BOLSA",
  m3: "M3", mt3: "M3", metro_cubico: "M3", metros_cubicos: "M3",
  m2: "M2", mt2: "M2", metro_cuadrado: "M2", metros_cuadrados: "M2",
  ml: "ML", m: "ML", mt: "ML", mts: "ML", metro: "ML", metros: "ML", metro_lineal: "ML", metros_lineales: "ML",
  kg: "KG", kgs: "KG", kilo: "KG", kilos: "KG", kilogramo: "KG", kilogramos: "KG",
  lt: "LT", l: "LT", lts: "LT", litro: "LT", litros: "LT",
  pallet: "PALLET", pallets: "PALLET", palet: "PALLET", pal: "PALLET",
  caja: "CAJA", cajas: "CAJA", cja: "CAJA", cj: "CAJA",
  rollo: "ROLLO", rollos: "ROLLO", rll: "ROLLO",
  placa: "PLACA", placas: "PLACA",
  tn: "TN", t: "TN", ton: "TN", tonelada: "TN", toneladas: "TN",
};

export function parsearUnidad(v: string): Unidad | null {
  return UNIDADES[normalizarClave(v)] ?? null;
}

export function parsearCondicionIVA(v: string): CondicionIVA | null {
  const k = normalizarClave(v);
  if (!k) return null;
  if (["ri", "responsable_inscripto", "resp_inscripto", "inscripto", "iva_responsable_inscripto"].includes(k)) return "RI";
  if (["monotributo", "monotributista", "mt", "mono", "responsable_monotributo", "rs"].includes(k)) return "MONOTRIBUTO";
  if (["exento", "ex", "iva_exento"].includes(k)) return "EXENTO";
  if (["cf", "consumidor_final", "final", "consumidor"].includes(k)) return "CF";
  return null;
}

export function parsearCondicionPago(v: string): CondicionPago | null {
  const k = normalizarClave(v);
  if (!k) return null;
  if (["contado", "efectivo", "cont", "contado_efectivo"].includes(k)) return "CONTADO";
  if (k.includes("anticip") || k.includes("adelantado")) return "ANTICIPO";
  const n = k.match(/\d+/)?.[0];
  if (n === "15") return "CTA_CTE_15";
  if (n === "30") return "CTA_CTE_30";
  if (n === "60") return "CTA_CTE_60";
  if (!n && (k.includes("cta_cte") || k.includes("cuenta_corriente") || k === "cc")) return "CTA_CTE_30";
  return null;
}

export function parsearTipoCliente(v: string): TipoCliente | null {
  const k = normalizarClave(v);
  if (!k) return null;
  if (k.startsWith("constructor") || k.includes("empresa")) return "CONSTRUCTORA";
  if (k.startsWith("corralon")) return "CORRALON";
  if (k.startsWith("ferreter")) return "FERRETERIA";
  if (k.startsWith("particular") || k === "consumidor_final" || k === "persona") return "PARTICULAR";
  if (k.startsWith("arquitect") || k.startsWith("estudio") || k.startsWith("ingenier")) return "ARQUITECTO";
  return null;
}

export function parsearTipoProveedor(v: string): TipoProveedor | null {
  const k = normalizarClave(v);
  if (!k) return null;
  if (k.startsWith("fabric")) return "FABRICANTE";
  if (k.startsWith("distribuid") || k.startsWith("mayorist")) return "DISTRIBUIDOR";
  if (k.startsWith("transport") || k.startsWith("flete")) return "TRANSPORTISTA";
  if (k.startsWith("servicio")) return "SERVICIOS";
  return null;
}

export function parsearCircuito(v: string): Circuito | null {
  const k = normalizarClave(v);
  if (!k) return null;
  if (["1", "ac1", "fiscal", "ac1_fiscal", "f"].includes(k)) return 1;
  if (["2", "ac2", "interno", "ac2_interno", "i"].includes(k)) return 2;
  return null;
}

// ───────────────────────── Plantillas ─────────────────────────

const col = (clave: string, etiqueta: string, sinonimos: string[] = [], requerida = false): ColumnaPlantilla => ({ clave, etiqueta, sinonimos, requerida });

export const COLUMNAS: Record<TipoImportacion, ColumnaPlantilla[]> = {
  articulos: [
    col("codigo", "Código", ["cod", "codigo_articulo", "cod_articulo", "articulo", "sku", "id"]),
    col("nombre", "Nombre", ["descripcion", "detalle", "producto", "nombre_articulo", "denominacion"], true),
    col("marca", "Marca", ["fabricante", "marca_comercial"]),
    col("unidad_negocio", "Unidad de negocio", ["un", "unidad_de_negocio", "negocio", "linea"]),
    col("rubro", "Rubro", ["categoria", "familia", "rubro_nombre"], true),
    col("unidad", "Unidad", ["unidad_medida", "unidad_de_medida", "um", "u_m", "medida"], true),
    col("costo", "Costo", ["precio_costo", "costo_unitario", "costo_sin_iva", "precio_de_costo", "costo_ultimo", "costo_reposicion"]),
    col("moneda_costo", "Moneda del costo", ["moneda", "moneda_de_costo", "divisa"]),
    col("costo_usd", "Costo USD", ["costo_dolares", "costo_en_dolares", "costo_u_s_d", "usd", "costo_dolar"]),
    col("stock_minimo", "Stock mínimo", ["minimo", "stock_min", "punto_de_pedido", "punto_pedido"]),
    col("unidades_por_pallet", "Unidades por pallet", ["por_pallet", "x_pallet", "un_pallet", "unidades_pallet", "pallet"]),
    col("codigo_barras", "Código de barras", ["ean", "ean13", "codigo_de_barras", "cod_barras", "barras"]),
    col("proveedor_habitual", "Proveedor habitual", ["proveedor", "cod_proveedor", "codigo_proveedor"]),
  ],
  clientes: [
    col("codigo", "Código", ["cod", "codigo_cliente", "cod_cliente", "nro_cliente", "id"]),
    col("razon_social", "Razón social", ["nombre", "cliente", "razon", "nombre_razon_social", "apellido_y_nombre"], true),
    col("nombre_fantasia", "Nombre de fantasía", ["fantasia", "nombre_comercial"]),
    col("tipo", "Tipo", ["tipo_cliente", "categoria"]),
    col("cuit", "CUIT", ["cuil", "cuit_cuil", "nro_cuit", "documento"]),
    col("condicion_iva", "Condición IVA", ["iva", "cond_iva", "condicion_frente_al_iva", "situacion_iva"]),
    col("email", "Email", ["mail", "correo", "e_mail", "correo_electronico"]),
    col("telefono", "Teléfono", ["tel", "celular", "telefonos", "whatsapp"]),
    col("direccion", "Dirección", ["domicilio", "calle"]),
    col("localidad", "Localidad", ["ciudad", "partido", "barrio"]),
    col("lista_precios", "Lista de precios", ["lista", "lista_de_precios", "lista_precio"]),
    col("condicion_pago", "Condición de pago", ["cond_pago", "forma_pago", "forma_de_pago", "plazo_pago"]),
    col("limite_credito", "Límite de crédito", ["limite", "credito", "limite_de_credito"]),
    col("circuito_habitual", "Circuito habitual", ["circuito"]),
    col("obras", "Obras", ["obra"]),
  ],
  proveedores: [
    col("codigo", "Código", ["cod", "codigo_proveedor", "cod_proveedor", "id"]),
    col("razon_social", "Razón social", ["nombre", "proveedor", "razon"], true),
    col("tipo", "Tipo", ["tipo_proveedor", "categoria"]),
    col("cuit", "CUIT", ["cuil", "nro_cuit"], true),
    col("condicion_iva", "Condición IVA", ["iva", "cond_iva", "situacion_iva"]),
    col("email", "Email", ["mail", "correo", "e_mail"]),
    col("telefono", "Teléfono", ["tel", "celular", "telefonos"]),
    col("contacto", "Contacto", ["persona_contacto", "vendedor", "referente"]),
    col("plazo_entrega_dias", "Plazo de entrega (días)", ["plazo_entrega", "plazo", "dias_entrega", "demora"]),
    col("condicion_pago", "Condición de pago", ["cond_pago", "forma_pago", "forma_de_pago"]),
    col("circuito_habitual", "Circuito habitual", ["circuito"]),
  ],
};

export const NOMBRE_PLANTILLA: Record<TipoImportacion, { singular: string; plural: string; archivo: string }> = {
  articulos: { singular: "artículo", plural: "artículos", archivo: "plantilla-articulos.csv" },
  clientes: { singular: "cliente", plural: "clientes", archivo: "plantilla-clientes.csv" },
  proveedores: { singular: "proveedor", plural: "proveedores", archivo: "plantilla-proveedores.csv" },
};

/** Mapeo automático: por nombre exacto normalizado y luego por sinónimos. */
export function mapearColumnas(tipo: TipoImportacion, cabeceras: string[]): Mapeo {
  const disponibles = cabeceras.map((c) => ({ original: c, k: normalizarClave(c) }));
  const usadas = new Set<string>();
  const mapeo: Mapeo = {};
  const columnas = COLUMNAS[tipo];
  // 1ª pasada: nombre exacto; 2ª: sinónimos (así "codigo" no se roba "codigo_barras").
  for (const c of columnas) {
    const hit = disponibles.find((d) => !usadas.has(d.original) && d.k === c.clave);
    mapeo[c.clave] = hit?.original ?? "";
    if (hit) usadas.add(hit.original);
  }
  for (const c of columnas) {
    if (mapeo[c.clave]) continue;
    const hit = disponibles.find((d) => !usadas.has(d.original) && c.sinonimos.includes(d.k));
    if (hit) {
      mapeo[c.clave] = hit.original;
      usadas.add(hit.original);
    }
  }
  return mapeo;
}

/** Pasa una fila cruda del archivo (por cabecera) a columnas del sistema. */
export function aplicarMapeo(fila: Record<string, unknown>, mapeo: Mapeo): FilaSistema {
  const out: FilaSistema = {};
  for (const [clave, cabecera] of Object.entries(mapeo)) out[clave] = cabecera ? String(fila[cabecera] ?? "").trim() : "";
  return out;
}

// ───────────────────────── Helpers de validación ─────────────────────────

function registrarUnico(mapa: Map<string, number>, clave: string, fila: number): number | undefined {
  const previa = mapa.get(clave);
  if (previa === undefined) mapa.set(clave, fila);
  return previa;
}

function numero(f: FilaSistema, clave: string, etiqueta: string, errores: string[], opts: { entero?: boolean; min?: number } = {}): number | undefined {
  const raw = f[clave] ?? "";
  const n = parsearNumero(raw);
  if (n === null) return undefined;
  if (Number.isNaN(n)) {
    errores.push(`${etiqueta}: "${raw}" no es un número válido.`);
    return undefined;
  }
  if (opts.min !== undefined && n < opts.min) {
    errores.push(`${etiqueta} no puede ser menor a ${opts.min}.`);
    return undefined;
  }
  if (opts.entero && !Number.isInteger(n)) {
    errores.push(`${etiqueta} debe ser un número entero.`);
    return undefined;
  }
  return n;
}

function validarEmail(email: string, errores: string[]) {
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errores.push(`Email inválido: "${email}".`);
}

function buscarListaPrecios(db: DbImportacion, nombre: string) {
  const k = norm(nombre);
  return db.listasPrecios.find((l) => norm(l.nombre) === k || l.id === nombre) ?? db.listasPrecios.find((l) => norm(l.nombre).startsWith(k));
}

function buscarUnidadNegocio(db: DbImportacion, v: string) {
  const k = norm(v);
  return db.unidadesNegocio.find((u) => norm(u.codigo) === k || norm(u.nombre) === k || u.id === v || norm(u.nombre).startsWith(k));
}

/** Rubro por nombre normalizado, por prefijo numérico o por comienzo del nombre. */
function buscarRubros(db: DbImportacion, v: string) {
  const k = norm(v);
  if (!k) return [];
  const exactos = db.rubros.filter((r) => norm(r.nombre) === k || r.prefijo === k || r.id === v);
  if (exactos.length) return exactos;
  return db.rubros.filter((r) => norm(r.nombre).startsWith(k));
}

// ───────────────────────── Validación por plantilla ─────────────────────────

export function validarFilaArticulo(f: FilaSistema, db: DbImportacion, ctx: ContextoValidacion): ResultadoFila<ProductoInput> {
  const errores: string[] = [];
  const nombre = f.nombre?.trim() ?? "";
  if (!nombre) errores.push("Falta el nombre.");

  // Unidad de negocio
  let unidadNegocioId: string | undefined;
  if (f.unidad_negocio) {
    const un = buscarUnidadNegocio(db, f.unidad_negocio);
    if (!un) errores.push(`Unidad de negocio desconocida: "${f.unidad_negocio}" (usá FER o COR).`);
    else unidadNegocioId = un.id;
  }

  // Rubro (debe pertenecer a la unidad de negocio)
  let rubroId: string | undefined;
  if (!f.rubro) errores.push("Falta el rubro.");
  else {
    const candidatos = buscarRubros(db, f.rubro);
    const deLaUnidad = unidadNegocioId ? candidatos.filter((r) => r.unidadNegocioId === unidadNegocioId) : candidatos;
    if (!candidatos.length) errores.push(`Rubro inexistente: "${f.rubro}".`);
    else if (!deLaUnidad.length) {
      const un = db.unidadesNegocio.find((u) => u.id === unidadNegocioId);
      errores.push(`El rubro "${candidatos[0].nombre}" no pertenece a ${un?.nombre ?? "la unidad de negocio indicada"}.`);
    } else if (deLaUnidad.length > 1) errores.push(`Rubro ambiguo: "${f.rubro}" coincide con ${deLaUnidad.map((r) => r.nombre).join(", ")}.`);
    else {
      rubroId = deLaUnidad[0].id;
      unidadNegocioId = deLaUnidad[0].unidadNegocioId;
    }
  }

  // Unidad de medida
  let unidad: Unidad | null = null;
  if (!f.unidad) errores.push("Falta la unidad.");
  else {
    unidad = parsearUnidad(f.unidad);
    if (!unidad) errores.push(`Unidad desconocida: "${f.unidad}".`);
  }

  const costo = numero(f, "costo", "Costo", errores, { min: 0 }) ?? 0;
  // Moneda del costo: ARS (por defecto) o USD. Con USD, el costo en pesos lo calcula el servidor
  // con el tipo de cambio vigente al importar.
  const costoUSD = numero(f, "costo_usd", "Costo USD", errores, { min: 0 });
  let monedaCosto: "ARS" | "USD" = costoUSD ? "USD" : "ARS";
  if (f.moneda_costo?.trim()) {
    const m = normalizarClave(f.moneda_costo);
    if (["usd", "u_s_d", "us", "dolar", "dolares", "u_s"].includes(m)) monedaCosto = "USD";
    else if (["ars", "pesos", "peso", "arg", "$"].includes(m) || !m) monedaCosto = "ARS";
    else errores.push(`Moneda del costo desconocida: "${f.moneda_costo}" (usá ARS o USD).`);
  }
  if (monedaCosto === "USD" && !costoUSD) errores.push("Falta el costo en USD (columna costo_usd).");
  const stockMinimo = numero(f, "stock_minimo", "Stock mínimo", errores, { min: 0 }) ?? 0;
  const porPallet = numero(f, "unidades_por_pallet", "Unidades por pallet", errores, { min: 0, entero: true });

  const codigoBarras = (f.codigo_barras ?? "").replace(/\s/g, "");
  if (codigoBarras && !/^\d{8,14}$/.test(codigoBarras)) errores.push(`Código de barras inválido: "${f.codigo_barras}" (8 a 14 dígitos).`);

  let proveedorHabitualId: string | undefined;
  if (f.proveedor_habitual) {
    const k = f.proveedor_habitual.trim().toLowerCase();
    const prov = db.proveedores.find((p) => p.codigo.toLowerCase() === k);
    if (!prov) errores.push(`Proveedor habitual inexistente: "${f.proveedor_habitual}".`);
    else proveedorHabitualId = prov.id;
  }

  // Código (autogenerado por rubro si viene vacío)
  let codigo = (f.codigo ?? "").trim();
  if (!codigo && rubroId) {
    codigo = siguienteCodigoProducto(rubroId, [...db.productos, ...(ctx.productosGenerados as Producto[])], db.rubros);
    ctx.productosGenerados.push({ codigo, rubroId });
  }
  if (!codigo) errores.push("Falta el código.");
  else {
    const dup = db.productos.find((p) => p.codigo.toLowerCase() === codigo.toLowerCase());
    if (dup) errores.push(`El código ${codigo} ya existe (${dup.nombre}).`);
    const previa = registrarUnico(ctx.codigosVistos, codigo.toLowerCase(), ctx.fila);
    if (previa !== undefined) errores.push(`Código ${codigo} repetido en el archivo (fila ${previa}).`);
  }

  if (errores.length || !rubroId || !unidadNegocioId || !unidad) return { ok: false, errores };
  const datos: ProductoInput = {
    codigo,
    nombre,
    rubroId,
    unidadNegocioId,
    unidad,
    costoUltimo: costo,
    costoPromedio: costo,
    fechaUltimoCosto: ctx.ahora,
    stockMinimo,
    activo: true,
  };
  if (monedaCosto === "USD" && costoUSD) {
    datos.monedaCosto = "USD";
    datos.costoUSD = costoUSD;
  }
  if (f.marca) datos.marca = f.marca.trim();
  if (porPallet) datos.unidadesPorPallet = porPallet;
  if (codigoBarras) datos.codigoBarras = codigoBarras;
  if (proveedorHabitualId) datos.proveedorHabitualId = proveedorHabitualId;
  return { ok: true, errores, datos };
}

function validarCodigoYCuit(
  f: FilaSistema,
  existentes: { codigo: string; cuit: string; razonSocial: string }[],
  ctx: ContextoValidacion,
  errores: string[],
  cuitObligatorio: boolean,
): string {
  const codigo = (f.codigo ?? "").trim();
  if (codigo) {
    const dup = existentes.find((x) => x.codigo.toLowerCase() === codigo.toLowerCase());
    if (dup) errores.push(`El código ${codigo} ya existe (${dup.razonSocial}).`);
    const previa = registrarUnico(ctx.codigosVistos, codigo.toLowerCase(), ctx.fila);
    if (previa !== undefined) errores.push(`Código ${codigo} repetido en el archivo (fila ${previa}).`);
  }
  const cuitRaw = (f.cuit ?? "").trim();
  if (!cuitRaw) {
    if (cuitObligatorio) errores.push("Falta el CUIT.");
    return "";
  }
  const err = validarCUIT(cuitRaw);
  if (err) {
    errores.push(`CUIT inválido (${cuitRaw}): ${err}`);
    return "";
  }
  const cuit = formatearCUIT(cuitRaw);
  const digitos = cuit.replace(/\D/g, "");
  const dup = existentes.find((x) => x.cuit.replace(/\D/g, "") === digitos);
  if (dup) errores.push(`Ya existe ${dup.razonSocial} con el CUIT ${cuit}.`);
  const previa = registrarUnico(ctx.cuitsVistos, digitos, ctx.fila);
  if (previa !== undefined) errores.push(`CUIT ${cuit} repetido en el archivo (fila ${previa}).`);
  return cuit;
}

export function validarFilaCliente(f: FilaSistema, db: DbImportacion, ctx: ContextoValidacion): ResultadoFila<ClienteImportado> {
  const errores: string[] = [];
  const razonSocial = (f.razon_social ?? "").trim();
  if (!razonSocial) errores.push("Falta la razón social.");

  let condicionIVA: CondicionIVA | null = f.cuit ? "RI" : "CF";
  if (f.condicion_iva) {
    condicionIVA = parsearCondicionIVA(f.condicion_iva);
    if (!condicionIVA) errores.push(`Condición de IVA desconocida: "${f.condicion_iva}".`);
  }
  const cuit = validarCodigoYCuit(f, db.clientes, ctx, errores, condicionIVA !== "CF");

  let tipo: TipoCliente | null = condicionIVA === "CF" ? "PARTICULAR" : "CONSTRUCTORA";
  if (f.tipo) {
    tipo = parsearTipoCliente(f.tipo);
    if (!tipo) errores.push(`Tipo de cliente desconocido: "${f.tipo}".`);
  }

  let listaPreciosId = "";
  if (f.lista_precios) {
    const l = buscarListaPrecios(db, f.lista_precios);
    if (!l) errores.push(`Lista de precios inexistente: "${f.lista_precios}".`);
    else listaPreciosId = l.id;
  } else {
    const activas = db.listasPrecios.filter((l) => l.activa);
    listaPreciosId = ((condicionIVA === "CF" && activas.find((l) => norm(l.nombre) === "publico")) || activas[0] || db.listasPrecios[0])?.id ?? "";
    if (!listaPreciosId) errores.push("No hay listas de precios cargadas.");
  }

  let condicionPago: CondicionPago | null = "CONTADO";
  if (f.condicion_pago) {
    condicionPago = parsearCondicionPago(f.condicion_pago);
    if (!condicionPago) errores.push(`Condición de pago desconocida: "${f.condicion_pago}".`);
  }

  let circuitoHabitual: Circuito | null = 1;
  if (f.circuito_habitual) {
    circuitoHabitual = parsearCircuito(f.circuito_habitual);
    if (!circuitoHabitual) errores.push(`Circuito desconocido: "${f.circuito_habitual}" (usá 1 o 2).`);
  }

  const limiteCredito = numero(f, "limite_credito", "Límite de crédito", errores, { min: 0 }) ?? 0;
  const email = (f.email ?? "").trim();
  validarEmail(email, errores);
  const sucursalPreferidaId = db.sucursales[0]?.id ?? "";

  const obras = Array.from(
    new Set(
      (f.obras ?? "")
        .split("|")
        .map((o) => o.trim())
        .filter(Boolean),
    ),
  );

  if (errores.length || !condicionIVA || !tipo || !condicionPago || !circuitoHabitual) return { ok: false, errores };
  const cliente: ClienteInput = {
    codigo: (f.codigo ?? "").trim(),
    razonSocial,
    tipo,
    cuit,
    condicionIVA,
    circuitoHabitual,
    email,
    telefono: (f.telefono ?? "").trim(),
    direccion: (f.direccion ?? "").trim(),
    localidad: (f.localidad ?? "").trim(),
    listaPreciosId,
    condicionPago,
    limiteCredito,
    sucursalPreferidaId,
    activo: true,
  };
  if (f.nombre_fantasia) cliente.nombreFantasia = f.nombre_fantasia.trim();
  return { ok: true, errores, datos: { cliente, obras } };
}

export function validarFilaProveedor(f: FilaSistema, db: DbImportacion, ctx: ContextoValidacion): ResultadoFila<ProveedorInput> {
  const errores: string[] = [];
  const razonSocial = (f.razon_social ?? "").trim();
  if (!razonSocial) errores.push("Falta la razón social.");
  const cuit = validarCodigoYCuit(f, db.proveedores, ctx, errores, true);

  let tipo: TipoProveedor | null = "DISTRIBUIDOR";
  if (f.tipo) {
    tipo = parsearTipoProveedor(f.tipo);
    if (!tipo) errores.push(`Tipo de proveedor desconocido: "${f.tipo}".`);
  }
  let condicionIVA: CondicionIVA | null = "RI";
  if (f.condicion_iva) {
    condicionIVA = parsearCondicionIVA(f.condicion_iva);
    if (!condicionIVA) errores.push(`Condición de IVA desconocida: "${f.condicion_iva}".`);
  }
  let condicionPago: CondicionPago | null = "CTA_CTE_30";
  if (f.condicion_pago) {
    condicionPago = parsearCondicionPago(f.condicion_pago);
    if (!condicionPago) errores.push(`Condición de pago desconocida: "${f.condicion_pago}".`);
  }
  let circuitoHabitual: Circuito | null = 1;
  if (f.circuito_habitual) {
    circuitoHabitual = parsearCircuito(f.circuito_habitual);
    if (!circuitoHabitual) errores.push(`Circuito desconocido: "${f.circuito_habitual}" (usá 1 o 2).`);
  }
  const plazoEntregaDias = numero(f, "plazo_entrega_dias", "Plazo de entrega", errores, { min: 0, entero: true }) ?? 5;
  const email = (f.email ?? "").trim();
  validarEmail(email, errores);

  if (errores.length || !tipo || !condicionIVA || !condicionPago || !circuitoHabitual) return { ok: false, errores };
  return {
    ok: true,
    errores,
    datos: {
      codigo: (f.codigo ?? "").trim(),
      razonSocial,
      tipo,
      cuit,
      condicionIVA,
      circuitoHabitual,
      email,
      telefono: (f.telefono ?? "").trim(),
      direccion: "",
      contacto: (f.contacto ?? "").trim(),
      plazoEntregaDias,
      condicionPago,
      // La plantilla no trae rubros: se habilita para todas las unidades de negocio.
      unidadNegocioIds: db.unidadesNegocio.map((u) => u.id),
      activo: true,
    },
  };
}

type Validador<T extends TipoImportacion> = (f: FilaSistema, db: DbImportacion, ctx: ContextoValidacion) => ResultadoFila<DatosImportacion[T]>;

export const PLANTILLAS: { [T in TipoImportacion]: { columnas: ColumnaPlantilla[]; mapearColumnas: (cabeceras: string[]) => Mapeo; validarFila: Validador<T> } } = {
  articulos: { columnas: COLUMNAS.articulos, mapearColumnas: (c) => mapearColumnas("articulos", c), validarFila: validarFilaArticulo },
  clientes: { columnas: COLUMNAS.clientes, mapearColumnas: (c) => mapearColumnas("clientes", c), validarFila: validarFilaCliente },
  proveedores: { columnas: COLUMNAS.proveedores, mapearColumnas: (c) => mapearColumnas("proveedores", c), validarFila: validarFilaProveedor },
};

export interface FilaValidada<T> extends ResultadoFila<T> {
  /** Número de fila de datos (1 = primera debajo de la cabecera). */
  fila: number;
  valores: FilaSistema;
}

/** Valida todas las filas de un archivo con un mismo contexto (detecta duplicados internos). */
export function validarArchivo<T extends TipoImportacion>(
  tipo: T,
  filas: Record<string, unknown>[],
  mapeo: Mapeo,
  db: DbImportacion,
  ahora = new Date().toISOString(),
): FilaValidada<DatosImportacion[T]>[] {
  const ctx = crearContexto(ahora);
  const validar = PLANTILLAS[tipo].validarFila as Validador<T>;
  return filas.map((cruda, i) => {
    ctx.fila = i + 1;
    const valores = aplicarMapeo(cruda, mapeo);
    const faltantes = COLUMNAS[tipo].filter((c) => c.requerida && !mapeo[c.clave]);
    const r = validar(valores, db, ctx);
    if (faltantes.length) {
      const extra = faltantes.map((c) => `Columna "${c.clave}" sin asignar.`);
      return { ...r, ok: false, datos: undefined, errores: [...extra, ...r.errores.filter((e) => !extra.includes(e))], fila: i + 1, valores };
    }
    return { ...r, fila: i + 1, valores };
  });
}

// ───────────────────────── Plantillas CSV ─────────────────────────

const EJEMPLOS: Record<TipoImportacion, string[][]> = {
  articulos: [
    ["50120", "CEMENTO PORTLAND NORMAL X 50 KG", "Loma Negra", "COR", "Cementos y cales", "BOLSA", "9850", "ARS", "", "200", "40", "7790123000014", ""],
    ["83120", "TARUGO NYLON S10 CON TORNILLO (CAJA X 50)", "Fischer", "FER", "Fijaciones y tornillería", "CAJA", "", "USD", "4,35", "20", "", "", ""],
  ],
  clientes: [
    ["", "Constructora del Sur S.R.L.", "CDS Obras", "Constructora", "30-71234567-1", "Responsable Inscripto", "compras@constructoradelsur.com.ar", "(011) 4244-1020", "Av. Hipólito Yrigoyen 8450", "Lomas de Zamora", "Mayorista", "30 días", "15000000", "1", "Edificio Boedo 1240|Barrio Las Acacias"],
    ["", "Martín Gómez", "", "Particular", "", "Consumidor final", "martin.gomez@gmail.com", "11 5523-8890", "Calle 14 N° 1532", "Berazategui", "Público", "Contado", "0", "2", "Casa Hudson"],
  ],
  proveedores: [
    ["", "Cementos Avellaneda S.A.", "Fabricante", "30-52087314-3", "Responsable Inscripto", "ventas@cavellaneda.com.ar", "(011) 4319-4500", "Lucía Fernández", "5", "30 días", "1"],
    ["", "Distribuidora Ferretera Norte S.R.L.", "Distribuidor", "30-71904456-1", "RI", "pedidos@ferreteranorte.com.ar", "(011) 4740-2210", "Hernán Castro", "2", "15 días", "2"],
  ],
};

function escaparCSV(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function aFilasCSV(cabeceras: string[], filas: string[][]): string {
  return [cabeceras, ...filas].map((f) => f.map(escaparCSV).join(",")).join("\r\n") + "\r\n";
}

/** Texto CSV (separador coma) con cabeceras y dos filas de ejemplo. */
export function generarPlantillaCSV(tipo: TipoImportacion): string {
  return aFilasCSV(
    COLUMNAS[tipo].map((c) => c.clave),
    EJEMPLOS[tipo],
  );
}

// ───────────────────────── Padrón de ARCA en la importación ─────────────────────────

/** Filas (índices) de clientes/proveedores con CUIT válido y razón social vacía: se consultan al padrón. */
export function filasParaPadron(filas: Record<string, unknown>[], mapeo: Mapeo): number[] {
  const out: number[] = [];
  filas.forEach((cruda, i) => {
    const v = aplicarMapeo(cruda, mapeo);
    if (!(v.razon_social ?? "").trim() && v.cuit && !validarCUIT(v.cuit)) out.push(i);
  });
  return out;
}

/**
 * Completa una fila con los datos del padrón sin pisar lo que ya trae. Las columnas que el archivo
 * no tiene se agregan como "(padrón) …" y se asignan en el mapeo.
 */
export function completarFilaConPadron(
  fila: Record<string, unknown>,
  mapeo: Mapeo,
  datos: { razonSocial: string; condicionIVA?: string; domicilio?: string; localidad?: string },
): { fila: Record<string, unknown>; mapeo: Mapeo } {
  const f = { ...fila };
  const m = { ...mapeo };
  const IVA: Record<string, string> = { RI: "RI", MONOTRIBUTO: "Monotributo", EXENTO: "Exento", CF: "CF", NO_INSCRIPTO: "CF" };
  const poner = (clave: string, valor: string | undefined) => {
    if (!valor) return;
    const col = m[clave] ?? `(padrón) ${clave}`;
    m[clave] = col;
    if (!String(f[col] ?? "").trim()) f[col] = valor;
  };
  poner("razon_social", datos.razonSocial);
  poner("condicion_iva", datos.condicionIVA ? IVA[datos.condicionIVA] : undefined);
  poner("direccion", datos.domicilio);
  poner("localidad", datos.localidad);
  return { fila: f, mapeo: m };
}
