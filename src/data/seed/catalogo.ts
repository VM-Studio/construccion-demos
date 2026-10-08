import type { ListaPrecios, Proveedor, Rubro, TipoProveedor, Unidad } from "@/domain/types";
import { generarCUIT } from "@/domain/cuit";

/** Perfil de venta: define cantidades típicas por pedido y volumen de stock. */
export type Perfil = "granel" | "medio" | "unidad" | "chico";

export interface ProductoSpec {
  codigo: string;
  rubro: string;
  nombre: string;
  marca?: string;
  unidad: Unidad;
  /** Costo de reposición HOY (ARS, sin IVA). */
  costo: number;
  /** Precio de lista en 2022 (artículos del documento de referencia de acopio). */
  precio2022?: number;
  proveedor: string;
  pallet?: number;
  pesoKg: number;
  perfil: Perfil;
}

export function seedRubros(ts: string): Rubro[] {
  const base = { creadoEn: ts, actualizadoEn: ts };
  const r = (id: string, nombre: string, orden: number, prefijo: string, un: string): Rubro => ({ id, nombre, orden, prefijo, unidadNegocioId: un, ...base });
  return [
    r("rub_gruesos", "Materiales gruesos", 1, "10", "un_cor"),
    r("rub_hierros", "Hierros y mallas", 2, "20", "un_cor"),
    r("rub_ladrillos", "Ladrillos y bloques", 3, "30", "un_cor"),
    r("rub_viguetas", "Viguetas y premoldeados", 4, "40", "un_cor"),
    r("rub_cementos", "Cementos y cales", 5, "50", "un_cor"),
    r("rub_imper", "Impermeabilización", 6, "60", "un_cor"),
    r("rub_seco", "Construcción en seco", 7, "70", "un_cor"),
    r("rub_hman", "Herramientas manuales", 11, "81", "un_fer"),
    r("rub_helec", "Herramientas eléctricas", 12, "82", "un_fer"),
    r("rub_fij", "Fijaciones y tornillería", 13, "83", "un_fer"),
    r("rub_pint", "Pinturas y accesorios", 14, "84", "un_fer"),
    r("rub_elec", "Electricidad", 15, "85", "un_fer"),
    r("rub_sanit", "Sanitarios y griferías", 16, "86", "un_fer"),
    r("rub_seg", "Seguridad e indumentaria", 17, "87", "un_fer"),
  ];
}

export function seedProveedores(ts: string): Proveedor[] {
  const base = { creadoEn: ts, actualizadoEn: ts, activo: true };
  const p = (
    n: number,
    razonSocial: string,
    tipo: TipoProveedor,
    cuitNum: number,
    contacto: string,
    telefono: string,
    direccion: string,
    plazo: number,
    cond: Proveedor["condicionPago"],
    circuito: 1 | 2,
    uns: string[],
    notas?: string,
  ): Proveedor => ({
    id: `prov_${String(n).padStart(2, "0")}`,
    codigo: `P${String(n).padStart(4, "0")}`,
    razonSocial,
    tipo,
    cuit: generarCUIT("30", cuitNum),
    condicionIVA: "RI",
    circuitoHabitual: circuito,
    email: `ventas@${razonSocial.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]+/g, "").slice(0, 14)}.com.ar`,
    telefono,
    direccion,
    contacto,
    plazoEntregaDias: plazo,
    condicionPago: cond,
    unidadNegocioIds: uns,
    notas,
    ...base,
  });
  return [
    p(1, "Loma Negra C.I.A.S.A.", "FABRICANTE", 50053632, "Gabriel Ortiz", "(011) 4319-3000", "Cecilia Grierson 355, CABA", 5, "CTA_CTE_30", 1, ["un_cor"]),
    p(2, "Holcim (Argentina) S.A.", "FABRICANTE", 50105443, "Paula Benedetti", "(011) 4021-5800", "Av. del Libertador 6550, CABA", 6, "CTA_CTE_30", 1, ["un_cor"]),
    p(3, "Acindar Industria Argentina de Aceros S.A.", "FABRICANTE", 50111239, "Marcelo Sandoval", "(011) 4719-8500", "Estanislao Zeballos 2739, Béccar", 7, "CTA_CTE_30", 1, ["un_cor"]),
    p(4, "Cerámica Cerro Negro S.A.", "FABRICANTE", 50257314, "Ezequiel Mansilla", "(0230) 449-2200", "Ruta 8 km 60, Pilar", 5, "CTA_CTE_30", 2, ["un_cor"]),
    p(5, "Saint-Gobain Argentina S.A. (Weber)", "FABRICANTE", 50402897, "Andrea Lucero", "(011) 4630-9000", "Panamericana km 37,5, Garín", 8, "CTA_CTE_60", 1, ["un_cor"]),
    p(6, "Fischer Argentina S.A.", "FABRICANTE", 70984512, "Julieta Fonseca", "(011) 4712-0050", "Av. Mitre 2350, Munro", 4, "CTA_CTE_30", 1, ["un_fer"]),
    p(7, "Stanley Black & Decker Argentina S.R.L.", "FABRICANTE", 71623407, "Cristian Aguirre", "(011) 4787-1100", "Av. del Libertador 7208, CABA", 7, "CTA_CTE_30", 1, ["un_fer"]),
    p(8, "Sinteplast S.A.", "FABRICANTE", 69871234, "Florencia Ríos", "(011) 4209-6000", "Av. Hipólito Yrigoyen 5800, Lanús", 5, "CTA_CTE_30", 1, ["un_fer"]),
    p(9, "Tigre Argentina S.A.", "FABRICANTE", 71110345, "Rubén Paredes", "(011) 4489-7500", "Ruta 8 km 47, Escobar", 6, "CTA_CTE_30", 1, ["un_fer", "un_cor"]),
    p(10, "FV S.A.", "FABRICANTE", 71458821, "Mariela Gómez", "(011) 4768-5000", "Av. Márquez 3200, Villa Lynch", 6, "CTA_CTE_30", 1, ["un_fer"]),
    p(11, "Distribuidora Ferretera del Oeste S.A.", "DISTRIBUIDOR", 71234098, "Diego Pereyra", "(011) 4627-4455", "Av. Gaona 8800, Ituzaingó", 2, "CTA_CTE_15", 2, ["un_fer", "un_cor"], "Mayorista de ferretería: Bosch, Tramontina, Alba, Cambre, Ombú, Durlock."),
    p(12, "Hierros y Áridos del Plata S.A.", "DISTRIBUIDOR", 70876543, "Néstor Villalba", "(03488) 42-7710", "Ruta 9 km 72, Campana", 2, "CTA_CTE_15", 2, ["un_cor"], "Hierros, viguetas, áridos por m³, tonelada y bolsón."),
  ];
}

export function seedListas(ts: string): ListaPrecios[] {
  const base = { creadoEn: ts, actualizadoEn: ts, activa: true };
  return [
    { id: "lst_may", nombre: "Mayorista", descripcion: "Constructoras, corralones y grandes cuentas", markupPorDefecto: 22, ...base },
    { id: "lst_gen", nombre: "Corralón", descripcion: "Lista general de mostrador y cuenta corriente", markupPorDefecto: 28, ...base },
    { id: "lst_pub", nombre: "Público", descripcion: "Consumidor final", markupPorDefecto: 45, ...base },
  ];
}

// ───────────── Artículos de Corralón del documento de referencia (precios 2022) ─────────────
// [codigo, rubro, nombre, unidad, precio2022, proveedor, pesoKg, perfil, pallet?]
type FilaRef = [string, string, string, Unidad, number, string, number, Perfil, number?];
const REF: FilaRef[] = [
  ["10102", "rub_gruesos", "ARENA COMUN DE 3 a 8M3", "M3", 4707.32, "prov_12", 1500, "medio"],
  ["10103", "rub_gruesos", "CASCOTE PICADO x M3", "M3", 3039.04, "prov_12", 1300, "medio"],
  ["10104", "rub_gruesos", "PIEDRA PARTIDA DE 5 M3 O MAS", "M3", 10403.62, "prov_12", 1500, "medio"],
  ["10112", "rub_gruesos", "ARENA COMUN X BATEA X TN", "TN", 3334.63, "prov_12", 1000, "medio"],
  ["10114", "rub_gruesos", "PIEDRA PARTIDA X TN (M3 X 1,4)", "TN", 7337.1, "prov_12", 1000, "medio"],
  ["10118", "rub_gruesos", "ARENA COMUN DE 5 M3 O MAS - CABA", "M3", 5340.13, "prov_12", 1500, "medio"],
  ["10120", "rub_gruesos", "PIEDRA PARTIDA 3 A 8 M3", "M3", 10403.62, "prov_12", 1500, "medio"],
  ["10127", "rub_gruesos", "ARENA X BOLSON", "UN", 5253.01, "prov_12", 1000, "chico"],
  ["10128", "rub_gruesos", "CASCOTE X BOLSON", "UN", 3765.76, "prov_12", 900, "chico"],
  ["10129", "rub_gruesos", "PIEDRA PARTIDA X BOLSON", "UN", 10974.29, "prov_12", 1000, "chico"],
  ["20102", "rub_hierros", "HIERRO 6 MM", "UN", 770.25, "prov_03", 2.7, "granel"],
  ["20103", "rub_hierros", "HIERRO 8 MM", "UN", 1293.12, "prov_03", 4.7, "granel"],
  ["20104", "rub_hierros", "HIERRO 10 MM", "UN", 2020, "prov_03", 7.4, "granel"],
  ["20105", "rub_hierros", "HIERRO 12 MM", "UN", 2877.39, "prov_03", 10.7, "granel"],
  ["20106", "rub_hierros", "HIERRO 16 MM", "UN", 5069.22, "prov_03", 18.9, "medio"],
  ["20107", "rub_hierros", "HIERRO 20 MM", "UN", 7924.62, "prov_03", 29.6, "medio"],
  ["20108", "rub_hierros", "HIERRO 25 MM", "UN", 12352.13, "prov_03", 46.2, "medio"],
  ["20111", "rub_hierros", "MALLA 15X15 4.2MM (2X5 M) 10M2 - L. COMERCIAL", "UN", 4652.97, "prov_03", 15, "medio"],
  ["20113", "rub_hierros", "ALAMBRE DE FARDO N16", "KG", 766.87, "prov_03", 1, "medio"],
  ["20118", "rub_hierros", "CLAVOS PTA PARIS 2", "KG", 816.35, "prov_03", 1, "medio"],
  ["20119", "rub_hierros", "CLAVOS PTA PARIS 2 1/2", "KG", 779.88, "prov_03", 1, "medio"],
  ["20135", "rub_hierros", "HIERRO DULCE DE 4.2 MM", "UN", 838.56, "prov_03", 1.3, "medio"],
  ["20144", "rub_hierros", "HIERRO DULCE DE 6 MM", "UN", 782.83, "prov_03", 2.6, "medio"],
  ["20146", "rub_hierros", "GUARDACANTO GALVANIZADO X 2 ML", "UN", 533.27, "prov_12", 0.4, "chico"],
  ["20175", "rub_hierros", "MALLA 15X15 6MM (2X5 M) 10M2 - L. COMERCIAL", "UN", 9484.86, "prov_03", 31, "medio"],
  ["20188", "rub_hierros", "MALLA 15X15 8MM (2X5 M) 10M2 - L. COMERCIAL", "UN", 20096.56, "prov_03", 55, "medio"],
  ["20189", "rub_hierros", "GUARDACANTO GALVANIZADO X 2.6 ML", "UN", 694.91, "prov_12", 0.5, "chico"],
  ["20190", "rub_hierros", "METAL DESPLEGADO MEDIANO (360/400 Gr/m2)", "UN", 1476.4, "prov_12", 0.9, "chico"],
  ["20193", "rub_hierros", "METAL DESPLEGADO REFORZADO (430/450 Gr/m2)", "UN", 1578.02, "prov_12", 1, "chico"],
  ["30101", "rub_ladrillos", "LADRILLO COMUN", "UN", 32.01, "prov_04", 2.2, "granel", 1000],
  ["30102", "rub_ladrillos", "LADRILLO 1/2 VISTA", "UN", 76.82, "prov_04", 2.5, "granel", 500],
  ["30103", "rub_ladrillos", "LADRILLO REFRACTARIO RECTO 229X114X63 mm- FARA", "UN", 487.14, "prov_04", 3.4, "chico"],
  ["30104", "rub_ladrillos", "LADRILLO HUECO 8X18X33", "UN", 80.44, "prov_04", 4.8, "granel", 198],
  ["30105", "rub_ladrillos", "LADRILLO HUECO (6AG) 12X18X33", "UN", 95.22, "prov_04", 6.2, "granel", 144],
  ["30106", "rub_ladrillos", "LADRILLO HUECO (9AG) 12X18X33", "UN", 99.6, "prov_04", 6.4, "granel", 144],
  ["30107", "rub_ladrillos", "LADRILLO HUECO 18X18X33", "UN", 142.55, "prov_04", 8.5, "granel", 90],
  ["30108", "rub_ladrillos", "LADRILLO PORTANTE 12X19X33", "UN", 159.01, "prov_04", 7.6, "granel", 126],
  ["30109", "rub_ladrillos", "LADRILLO PORTANTE 18X19X33", "UN", 186.57, "prov_04", 9.6, "granel", 90],
  ["30115", "rub_ladrillos", "ARCILLA REFRACTARIA EN BOLSA X 10 KG FARA", "BOLSA", 1144.13, "prov_04", 10, "chico"],
  ["30119", "rub_ladrillos", "LISTON 220X60X17 MM SIN COLOR- FARA", "UN", 77.25, "prov_04", 0.5, "chico"],
  ["30125", "rub_ladrillos", "LADRILLO TELGOPOR 1000 X 420 X 120 MM", "UN", 435.44, "prov_12", 1.1, "medio"],
  ["30131", "rub_ladrillos", "LADRILLO TELGOPOR 1000 X 420 X 100 MM", "UN", 362.49, "prov_12", 0.9, "medio"],
  ["30204", "rub_ladrillos", "ARCILLA REFRACTARIA EN BOLSA X 30 KG FARA", "BOLSA", 2837.64, "prov_04", 30, "chico"],
  ...[727.32, 872.78, 1018.24, 1163.69, 1309.17, 1454.62, 1600.08, 1745.56, 1891.01, 2036.47, 2181.94, 2326.98, 2578.29, 2729.94, 2881.61, 3273.55, 3437.22, 4149.41, 4557.87, 4756.05, 5087.37, 5466.55, 6077.88, 6302.99, 6993.48, 8104.89, 8375.06, 9648.75, 10398.75, 10713.85, 11028.97].map(
    (precio, i): FilaRef => {
      const largo = 1 + i * 0.2;
      return [String(40101 + i * 2), "rub_viguetas", `VIGUETA X ${largo.toFixed(2)} M`, "UN", precio, "prov_12", Math.round(largo * 16), largo <= 4.4 ? "medio" : "chico"];
    },
  ),
  ["50101", "rub_cementos", "CEMENTO LOMA NEGRA X 50 KG", "BOLSA", 1178.42, "prov_01", 50, "granel", 42],
  ["50104", "rub_cementos", "CEMENTO HOLCIM X 50 KG", "BOLSA", 982.87, "prov_02", 50, "granel", 42],
  ["50106", "rub_cementos", "CAL COMUN CACIQUE PLUS X 20 KG", "BOLSA", 522.51, "prov_01", 20, "granel", 70],
  ["50108", "rub_cementos", "CAL MILAGRO X 25 KG", "BOLSA", 1511.77, "prov_12", 25, "granel", 60],
  ["50113", "rub_cementos", "PLASTICOR X 40 KG", "BOLSA", 936.29, "prov_01", 40, "granel", 50],
  ["50203", "rub_cementos", "WEBER IMPERMEABLE CON CERESITA X 30 KG.", "BOLSA", 1322.07, "prov_05", 30, "medio", 40],
  ["50206", "rub_cementos", "CAL HIDRAT EXTRA X 25 KG", "BOLSA", 458.54, "prov_02", 25, "granel", 60],
  ["50270", "rub_cementos", "YESO TUYANGO X 30KG", "BOLSA", 1076.38, "prov_12", 30, "medio", 40],
  ["50302", "rub_gruesos", "BOLSON RETORNABLE", "UN", 941.73, "prov_12", 2, "chico"],
  ["50318", "rub_cementos", "WEBER PORCELLANATO X 30 KG", "BOLSA", 2531.26, "prov_05", 30, "medio", 40],
  ["60103", "rub_imper", "TACURU X 10 LT", "UN", 10978.7, "prov_05", 11, "chico"],
  ["60104", "rub_imper", "TACURU X 20 LT", "UN", 21087.23, "prov_05", 22, "chico"],
  ["60312", "rub_imper", "HIDROF. WEBER HD PASTA X200 LT ( CERESITA )", "UN", 19153.88, "prov_05", 210, "chico"],
  ["60313", "rub_imper", "HIDROF. WEBER HD PASTA X20 LT ( CERESITA )", "UN", 3578.62, "prov_05", 21, "chico"],
  ["60314", "rub_imper", "HIDROF. WEBER HD PASTA X10 LT ( CERESITA )", "UN", 2300.42, "prov_05", 11, "chico"],
  ["140103", "rub_gruesos", "POLIETILENO 2A X 50L X 200 MIC", "ROLLO", 7697.41, "prov_11", 9, "chico"],
  ["140105", "rub_gruesos", "PALLET RETORNABLE CEMENTO O CAL", "UN", 4253.39, "prov_02", 20, "chico"],
  ["140106", "rub_gruesos", "POLIETILENO 2A X 100L X 100 MIC", "ROLLO", 7697.41, "prov_11", 9, "chico"],
  ["240029", "rub_cementos", "WEBER PORCELLANATO FLEX X 30KG", "BOLSA", 4147.49, "prov_05", 30, "medio", 40],
  ["270016", "rub_hierros", "MALLA 15X15 4.2MM (6 X 2 MTS) - 12M2 - L. COMERCIAL A.", "UN", 6054.86, "prov_03", 18, "medio"],
];

/** Hoy, el costo de reposición equivale a ~10× el precio de lista de 2022. */
const FACTOR_2026 = 10;

const corralonRef: ProductoSpec[] = REF.map(([codigo, rubro, nombre, unidad, precio2022, proveedor, pesoKg, perfil, pallet]) => ({
  codigo,
  rubro,
  nombre,
  unidad,
  precio2022,
  costo: Math.round(precio2022 * FACTOR_2026),
  proveedor,
  pesoKg,
  perfil,
  pallet,
  marca: /HOLCIM/.test(nombre) ? "Holcim" : /LOMA NEGRA|PLASTICOR/.test(nombre) ? "Loma Negra" : /WEBER|CERESITA|TACURU/.test(nombre) ? "Weber" : /CACIQUE/.test(nombre) ? "Cacique" : /MILAGRO/.test(nombre) ? "Milagro" : /FARA/.test(nombre) ? "Fara" : rubro === "rub_hierros" && /HIERRO|MALLA/.test(nombre) ? "Acindar" : undefined,
}));

const corralonExtra: ProductoSpec[] = [
  { codigo: "20202", rubro: "rub_hierros", nombre: "HIERRO ADN 6 MM EN VARILLA DE 12 MTS (X KG)", marca: "Acindar", unidad: "KG", costo: 1950, proveedor: "prov_03", pesoKg: 1, perfil: "granel" },
  { codigo: "20203", rubro: "rub_hierros", nombre: "HIERRO ADN 8 MM EN VARILLA DE 12 MTS (X KG)", marca: "Acindar", unidad: "KG", costo: 1890, proveedor: "prov_03", pesoKg: 1, perfil: "granel" },
  { codigo: "20204", rubro: "rub_hierros", nombre: "HIERRO ADN 10 MM EN VARILLA DE 12 MTS (X KG)", marca: "Acindar", unidad: "KG", costo: 1860, proveedor: "prov_03", pesoKg: 1, perfil: "granel" },
  { codigo: "20205", rubro: "rub_hierros", nombre: "HIERRO ADN 12 MM EN VARILLA DE 12 MTS (X KG)", marca: "Acindar", unidad: "KG", costo: 1840, proveedor: "prov_03", pesoKg: 1, perfil: "granel" },
  { codigo: "20206", rubro: "rub_hierros", nombre: "HIERRO ADN 16 MM EN VARILLA DE 12 MTS (X KG)", marca: "Acindar", unidad: "KG", costo: 1830, proveedor: "prov_03", pesoKg: 1, perfil: "granel" },
  { codigo: "20207", rubro: "rub_hierros", nombre: "MALLAS DE HIERRO 15X15 X 8MM 2,40M X 6M", marca: "Acindar", unidad: "UN", costo: 64000, proveedor: "prov_03", pesoKg: 57, perfil: "medio" },
  { codigo: "70101", rubro: "rub_seco", nombre: "PLACA DURLOCK STANDARD 12.5 MM 1.20 X 2.40", marca: "Durlock", unidad: "PLACA", costo: 14200, proveedor: "prov_11", pesoKg: 22, perfil: "medio", pallet: 50 },
  { codigo: "70102", rubro: "rub_seco", nombre: "PLACA DURLOCK RESISTENTE A LA HUMEDAD 12.5 MM", marca: "Durlock", unidad: "PLACA", costo: 19600, proveedor: "prov_11", pesoKg: 24, perfil: "medio", pallet: 50 },
  { codigo: "70103", rubro: "rub_seco", nombre: "MONTANTE GALVANIZADO 70 MM X 2.60 M", marca: "Barbieri", unidad: "UN", costo: 5300, proveedor: "prov_11", pesoKg: 1.6, perfil: "medio" },
  { codigo: "70104", rubro: "rub_seco", nombre: "SOLERA GALVANIZADA 70 MM X 2.60 M", marca: "Barbieri", unidad: "UN", costo: 4500, proveedor: "prov_11", pesoKg: 1.3, perfil: "medio" },
  { codigo: "70105", rubro: "rub_seco", nombre: "MASILLA DURLOCK LISTA PARA USAR X 32 KG", marca: "Durlock", unidad: "UN", costo: 26500, proveedor: "prov_11", pesoKg: 32, perfil: "chico" },
  { codigo: "70106", rubro: "rub_seco", nombre: "CINTA DE PAPEL MICROPERFORADA X 150 M", marca: "Durlock", unidad: "ROLLO", costo: 3900, proveedor: "prov_11", pesoKg: 0.6, perfil: "chico" },
  { codigo: "60401", rubro: "rub_imper", nombre: "MEMBRANA ASFALTICA 4 MM CON ALUMINIO X 10 M2", marca: "Megaflex", unidad: "ROLLO", costo: 53000, proveedor: "prov_11", pesoKg: 40, perfil: "chico" },
  { codigo: "60402", rubro: "rub_imper", nombre: "MEMBRANA LIQUIDA PARA TECHOS X 20 KG", marca: "Sinteplast", unidad: "UN", costo: 76000, proveedor: "prov_08", pesoKg: 20, perfil: "chico" },
];

const fer = (codigo: string, rubro: string, nombre: string, marca: string, unidad: Unidad, costo: number, proveedor: string, pesoKg: number, perfil: Perfil = "chico"): ProductoSpec => ({ codigo, rubro, nombre, marca, unidad, costo, proveedor, pesoKg, perfil });

const ferreteria: ProductoSpec[] = [
  fer("81001", "rub_hman", "MARTILLO CARPINTERO 20 OZ", "Stanley", "UN", 18500, "prov_07", 0.7),
  fer("81002", "rub_hman", "DESTORNILLADOR PHILLIPS PH2 X 100 MM", "Stanley", "UN", 4200, "prov_07", 0.1),
  fer("81003", "rub_hman", "PINZA UNIVERSAL 8\"", "Tramontina", "UN", 9800, "prov_11", 0.3),
  fer("81004", "rub_hman", "CINTA METRICA 5 M", "Stanley", "UN", 7600, "prov_07", 0.3),
  fer("81005", "rub_hman", "NIVEL DE ALUMINIO 60 CM", "Stanley", "UN", 16800, "prov_07", 0.5),
  fer("81006", "rub_hman", "LLAVE AJUSTABLE 10\"", "Tramontina", "UN", 14200, "prov_11", 0.4),
  fer("81007", "rub_hman", "CUCHARA DE ALBAÑIL 8\"", "Tramontina", "UN", 7200, "prov_11", 0.4),
  fer("82001", "rub_helec", "AMOLADORA ANGULAR 115 MM 750 W GWS 750", "Bosch", "UN", 96000, "prov_11", 2.2, "unidad"),
  fer("82002", "rub_helec", "TALADRO PERCUTOR 13 MM 600 W", "Black+Decker", "UN", 68000, "prov_07", 1.9, "unidad"),
  fer("82003", "rub_helec", "ATORNILLADOR INALAMBRICO 12 V GSR 120", "Bosch", "UN", 118000, "prov_11", 1.4, "unidad"),
  fer("82004", "rub_helec", "SIERRA CIRCULAR 7 1/4\" 1400 W", "Black+Decker", "UN", 125000, "prov_07", 4.3, "unidad"),
  fer("82005", "rub_helec", "ROTOMARTILLO SDS PLUS 800 W GBH 2-24", "Bosch", "UN", 245000, "prov_11", 2.8, "unidad"),
  fer("82006", "rub_helec", "DISCO DE CORTE METAL 115 X 1 MM (CAJA X 25)", "Bosch", "CAJA", 21000, "prov_11", 1.8),
  fer("83001", "rub_fij", "TARUGO S8 (CAJA X 100)", "Fischer", "CAJA", 4800, "prov_06", 0.3),
  fer("83002", "rub_fij", "TARUGO S6 (CAJA X 100)", "Fischer", "CAJA", 3600, "prov_06", 0.2),
  fer("83003", "rub_fij", "TORNILLO AUTOPERFORANTE T2 (CAJA X 1000)", "Fischer", "CAJA", 9500, "prov_06", 1.5),
  fer("83004", "rub_fij", "TORNILLO PARA MADERA 4 X 40 (CAJA X 500)", "Fischer", "CAJA", 6800, "prov_06", 1.1),
  fer("83005", "rub_fij", "ANCLAJE QUIMICO FIS V 360 ML", "Fischer", "UN", 23500, "prov_06", 0.6),
  fer("83006", "rub_fij", "BULON CON TUERCA 3/8 X 3\" (CAJA X 50)", "Fischer", "CAJA", 11200, "prov_06", 2.4),
  fer("84001", "rub_pint", "LATEX INTERIOR ALBALATEX X 20 LT", "Alba", "UN", 98000, "prov_11", 28),
  fer("84002", "rub_pint", "LATEX EXTERIOR RECUPLAST X 20 LT", "Sinteplast", "UN", 128000, "prov_08", 28),
  fer("84003", "rub_pint", "ESMALTE SINTETICO BRILLANTE X 4 LT", "Alba", "UN", 46000, "prov_11", 5),
  fer("84004", "rub_pint", "FIJADOR SELLADOR AL AGUA X 10 LT", "Sinteplast", "UN", 39000, "prov_08", 11),
  fer("84005", "rub_pint", "RODILLO LANA 23 CM", "Sinteplast", "UN", 7600, "prov_08", 0.4),
  fer("84006", "rub_pint", "PINCEL N° 20", "Alba", "UN", 3200, "prov_11", 0.1),
  fer("85001", "rub_elec", "CABLE UNIPOLAR 2.5 MM X 100 M", "Cambre", "ROLLO", 62000, "prov_11", 3.2),
  fer("85002", "rub_elec", "TOMACORRIENTE DOBLE SIGLO XXII", "Cambre", "UN", 5400, "prov_11", 0.1),
  fer("85003", "rub_elec", "LLAVE DE LUZ UN PUNTO SIGLO XXII", "Cambre", "UN", 3900, "prov_11", 0.1),
  fer("85004", "rub_elec", "CAJA RECTANGULAR PVC 5 X 10", "Cambre", "UN", 650, "prov_11", 0.05),
  fer("85005", "rub_elec", "TERMICA BIPOLAR 2 X 20 A", "Cambre", "UN", 14800, "prov_11", 0.3),
  fer("85006", "rub_elec", "CAÑO CORRUGADO 3/4 X 25 M", "Tigre", "ROLLO", 9800, "prov_09", 2),
  fer("86001", "rub_sanit", "CAÑO PPR TERMOFUSION 20 MM X 4 M", "Tigre", "UN", 6200, "prov_09", 0.8, "medio"),
  fer("86002", "rub_sanit", "CODO PPR 20 MM A 90°", "Tigre", "UN", 780, "prov_09", 0.05),
  fer("86003", "rub_sanit", "LLAVE DE PASO ESFERICA 3/4", "FV", "UN", 21000, "prov_10", 0.6),
  fer("86004", "rub_sanit", "GRIFERIA LAVATORIO MONOCOMANDO", "FV", "UN", 158000, "prov_10", 2.5, "unidad"),
  fer("86005", "rub_sanit", "CAÑO PVC CLOACAL 110 MM X 4 M", "Tigre", "UN", 24500, "prov_09", 6, "medio"),
  fer("86006", "rub_sanit", "FLEXIBLE MALLADO 30 CM", "FV", "UN", 3600, "prov_10", 0.1),
  fer("87001", "rub_seg", "BOTIN DE SEGURIDAD PUNTERA ACERO N° 42", "Ombú", "UN", 54000, "prov_11", 1.4, "unidad"),
  fer("87002", "rub_seg", "GUANTE MOTEADO (PAR)", "Ombú", "UN", 1900, "prov_11", 0.1),
  fer("87003", "rub_seg", "CASCO DE SEGURIDAD BLANCO", "Ombú", "UN", 8600, "prov_11", 0.4),
  fer("87004", "rub_seg", "ANTEOJO DE SEGURIDAD CLARO", "Ombú", "UN", 3800, "prov_11", 0.1),
  fer("87005", "rub_seg", "PANTALON CARGO DE TRABAJO T 44", "Ombú", "UN", 32000, "prov_11", 0.6),
];

export const PRODUCTOS: ProductoSpec[] = [...corralonRef, ...corralonExtra, ...ferreteria];

/** Unidad de negocio de cada rubro. */
export const UN_DE_RUBRO: Record<string, string> = {
  rub_gruesos: "un_cor",
  rub_hierros: "un_cor",
  rub_ladrillos: "un_cor",
  rub_viguetas: "un_cor",
  rub_cementos: "un_cor",
  rub_imper: "un_cor",
  rub_seco: "un_cor",
  rub_hman: "un_fer",
  rub_helec: "un_fer",
  rub_fij: "un_fer",
  rub_pint: "un_fer",
  rub_elec: "un_fer",
  rub_sanit: "un_fer",
  rub_seg: "un_fer",
};
