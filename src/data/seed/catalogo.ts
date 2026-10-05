import type { ListaPrecios, Proveedor, Rubro, Unidad } from "@/domain/types";
import { generarCUIT } from "@/domain/cuit";

/** Perfil de venta: define cantidades típicas por pedido y volumen de stock. */
export type Perfil = "granel" | "medio" | "m2" | "unidad" | "chico";

export interface ProductoSpec {
  rubro: string;
  nombre: string;
  marca: string;
  unidad: Unidad;
  /** Costo de reposición HOY (ARS, sin IVA). */
  costo: number;
  proveedor: string;
  pallet?: number;
  pesoKg: number;
  perfil: Perfil;
  descripcion?: string;
}

export function seedRubros(ts: string): Rubro[] {
  const base = { creadoEn: ts, actualizadoEn: ts };
  return [
    { id: "rub_gru", nombre: "Materiales gruesos", orden: 1, prefijo: "GRU", ...base },
    { id: "rub_sec", nombre: "Construcción en seco", orden: 2, prefijo: "SEC", ...base },
    { id: "rub_pis", nombre: "Pisos y revestimientos", orden: 3, prefijo: "PIS", ...base },
    { id: "rub_san", nombre: "Sanitarios", orden: 4, prefijo: "SAN", ...base },
    { id: "rub_gri", nombre: "Griferías", orden: 5, prefijo: "GRI", ...base },
    { id: "rub_imp", nombre: "Impermeabilización", orden: 6, prefijo: "IMP", ...base },
    { id: "rub_ais", nombre: "Aislantes", orden: 7, prefijo: "AIS", ...base },
    { id: "rub_her", nombre: "Herramientas e insumos", orden: 8, prefijo: "HER", ...base },
  ];
}

export function seedProveedores(ts: string): Proveedor[] {
  const base = { creadoEn: ts, actualizadoEn: ts, activo: true };
  return [
    { id: "prov_01", razonSocial: "Loma Negra C.I.A.S.A.", cuit: generarCUIT("30", 50053632), condicionIVA: "RI", email: "pedidos@lomanegra.com", telefono: "(011) 4319-3000", direccion: "Cecilia Grierson 355, CABA", contacto: "Gabriel Ortiz", plazoEntregaDias: 5, condicionPago: "CTA_CTE_30", ...base },
    { id: "prov_02", razonSocial: "Holcim (Argentina) S.A.", cuit: generarCUIT("30", 50105443), condicionIVA: "RI", email: "ventas.amba@holcim.com", telefono: "(011) 4021-5800", direccion: "Av. del Libertador 6550, CABA", contacto: "Paula Benedetti", plazoEntregaDias: 6, condicionPago: "CTA_CTE_30", ...base },
    { id: "prov_03", razonSocial: "Áridos del Paraná S.R.L.", cuit: generarCUIT("30", 71458821), condicionIVA: "RI", email: "despacho@aridosparana.com.ar", telefono: "(03488) 42-7710", direccion: "Ruta 9 km 72, Campana", contacto: "Néstor Villalba", plazoEntregaDias: 2, condicionPago: "CTA_CTE_15", notas: "Entrega con batea propia. Mínimo 6 m³ por viaje.", ...base },
    { id: "prov_04", razonSocial: "Acindar Industria Argentina de Aceros S.A.", cuit: generarCUIT("30", 50111239), condicionIVA: "RI", email: "comercial@acindar.com.ar", telefono: "(011) 4719-8500", direccion: "Estanislao Zeballos 2739, Béccar", contacto: "Marcelo Sandoval", plazoEntregaDias: 7, condicionPago: "CTA_CTE_30", ...base },
    { id: "prov_05", razonSocial: "Seco Total Distribuidora S.R.L.", cuit: generarCUIT("30", 71623407), condicionIVA: "RI", email: "pedidos@secototal.com.ar", telefono: "(011) 4730-2215", direccion: "Av. Constituyentes 4100, Villa Maipú", contacto: "Julieta Fonseca", plazoEntregaDias: 3, condicionPago: "CTA_CTE_30", notas: "Distribuidor oficial Durlock, Knauf y Barbieri.", ...base },
    { id: "prov_06", razonSocial: "Revestimientos del Plata S.A.", cuit: generarCUIT("30", 70984512), condicionIVA: "RI", email: "ventas@revestimientosdelplata.com.ar", telefono: "(011) 4768-9900", direccion: "Ruta 197 3120, Grand Bourg", contacto: "Ezequiel Mansilla", plazoEntregaDias: 5, condicionPago: "CTA_CTE_30", notas: "Ilva, Cortines, Cerro Negro, Klaukol.", ...base },
    { id: "prov_07", razonSocial: "Saint-Gobain Argentina S.A.", cuit: generarCUIT("30", 50257314), condicionIVA: "RI", email: "clientes@saint-gobain.com.ar", telefono: "(011) 4630-9000", direccion: "Ruta Panamericana km 37,5, Garín", contacto: "Andrea Lucero", plazoEntregaDias: 8, condicionPago: "CTA_CTE_60", notas: "Weber e Isover.", ...base },
    { id: "prov_08", razonSocial: "Sanitarios Oeste S.A.", cuit: generarCUIT("30", 69871234), condicionIVA: "RI", email: "pedidos@sanitariosoeste.com.ar", telefono: "(011) 4627-4455", direccion: "Av. Gaona 8800, Ituzaingó", contacto: "Rubén Paredes", plazoEntregaDias: 4, condicionPago: "CTA_CTE_30", notas: "Ferrum, FV, Tigre, Awaduct, Rotoplas.", ...base },
    { id: "prov_09", razonSocial: "Sika Argentina S.A.I.C.", cuit: generarCUIT("30", 50402897), condicionIVA: "RI", email: "ventas.ar@sika.com", telefono: "(011) 4734-3500", direccion: "Juan B. Alberdi 5250, Caseros", contacto: "Florencia Ríos", plazoEntregaDias: 6, condicionPago: "CTA_CTE_30", ...base },
    { id: "prov_10", razonSocial: "Ferretería Industrial Mayorista S.A.", cuit: generarCUIT("30", 71110345), condicionIVA: "RI", email: "mayorista@fimsa.com.ar", telefono: "(011) 4512-6677", direccion: "Av. San Martín 6900, CABA", contacto: "Cristian Aguirre", plazoEntregaDias: 3, condicionPago: "CTA_CTE_15", notas: "Pinturas Alba, herramientas e insumos.", ...base },
  ];
}

export function seedListas(ts: string): ListaPrecios[] {
  const base = { creadoEn: ts, actualizadoEn: ts, activa: true };
  return [
    { id: "lst_may", nombre: "Mayorista", descripcion: "Constructoras y grandes cuentas", markupPorDefecto: 22, ...base },
    { id: "lst_cor", nombre: "Corralón", descripcion: "Corralones y reventa", markupPorDefecto: 28, ...base },
    { id: "lst_pub", nombre: "Público", descripcion: "Mostrador y particulares", markupPorDefecto: 45, ...base },
  ];
}

export const PRODUCTOS: ProductoSpec[] = [
  // ── Materiales gruesos
  { rubro: "rub_gru", nombre: "Cemento Portland normal 50 kg", marca: "Loma Negra", unidad: "BOLSA", costo: 10200, proveedor: "prov_01", pallet: 42, pesoKg: 50, perfil: "granel" },
  { rubro: "rub_gru", nombre: "Cemento Portland compuesto 50 kg", marca: "Holcim", unidad: "BOLSA", costo: 9800, proveedor: "prov_02", pallet: 42, pesoKg: 50, perfil: "granel" },
  { rubro: "rub_gru", nombre: "Cemento de albañilería Plasticor 40 kg", marca: "Loma Negra", unidad: "BOLSA", costo: 7600, proveedor: "prov_01", pallet: 50, pesoKg: 40, perfil: "granel" },
  { rubro: "rub_gru", nombre: "Cemento de albañilería 40 kg", marca: "Holcim", unidad: "BOLSA", costo: 7350, proveedor: "prov_02", pallet: 50, pesoKg: 40, perfil: "granel" },
  { rubro: "rub_gru", nombre: "Cal hidratada 25 kg", marca: "Cacique", unidad: "BOLSA", costo: 4300, proveedor: "prov_01", pallet: 60, pesoKg: 25, perfil: "granel" },
  { rubro: "rub_gru", nombre: "Ladrillo hueco 12x18x33 cm", marca: "Cerámica Quilmes", unidad: "UN", costo: 900, proveedor: "prov_03", pallet: 144, pesoKg: 6.2, perfil: "granel" },
  { rubro: "rub_gru", nombre: "Ladrillo hueco 8x18x33 cm", marca: "Cerámica Quilmes", unidad: "UN", costo: 720, proveedor: "prov_03", pallet: 180, pesoKg: 4.8, perfil: "granel" },
  { rubro: "rub_gru", nombre: "Ladrillo hueco portante 18x19x33 cm", marca: "Cerámica Quilmes", unidad: "UN", costo: 1450, proveedor: "prov_03", pallet: 90, pesoKg: 9, perfil: "granel" },
  { rubro: "rub_gru", nombre: "Ladrillo común de cal", marca: "Hornos San Pedro", unidad: "UN", costo: 210, proveedor: "prov_03", pallet: 1000, pesoKg: 2.2, perfil: "granel" },
  { rubro: "rub_gru", nombre: "Bloque de hormigón 20x20x40 cm", marca: "Blokret", unidad: "UN", costo: 1350, proveedor: "prov_03", pallet: 90, pesoKg: 15, perfil: "granel" },
  { rubro: "rub_gru", nombre: "Arena gruesa", marca: "Áridos del Paraná", unidad: "M3", costo: 55000, proveedor: "prov_03", pesoKg: 1500, perfil: "medio" },
  { rubro: "rub_gru", nombre: "Arena fina", marca: "Áridos del Paraná", unidad: "M3", costo: 58000, proveedor: "prov_03", pesoKg: 1450, perfil: "medio" },
  { rubro: "rub_gru", nombre: "Piedra partida 6-20", marca: "Áridos del Paraná", unidad: "M3", costo: 82000, proveedor: "prov_03", pesoKg: 1500, perfil: "medio" },
  { rubro: "rub_gru", nombre: "Hierro ADN 420 Ø 8 mm x 12 m", marca: "Acindar", unidad: "UN", costo: 9800, proveedor: "prov_04", pesoKg: 4.7, perfil: "granel" },
  { rubro: "rub_gru", nombre: "Hierro ADN 420 Ø 10 mm x 12 m", marca: "Acindar", unidad: "UN", costo: 15200, proveedor: "prov_04", pesoKg: 7.4, perfil: "granel" },
  { rubro: "rub_gru", nombre: "Hierro ADN 420 Ø 12 mm x 12 m", marca: "Acindar", unidad: "UN", costo: 21800, proveedor: "prov_04", pesoKg: 10.7, perfil: "medio" },
  { rubro: "rub_gru", nombre: "Malla Sima 15x15 Ø 4,2 mm 2,40x6 m", marca: "Acindar", unidad: "UN", costo: 38000, proveedor: "prov_04", pesoKg: 30, perfil: "medio" },
  // ── Construcción en seco
  { rubro: "rub_sec", nombre: "Placa de yeso estándar 12,5 mm 1,20x2,40 m", marca: "Durlock", unidad: "PLACA", costo: 14000, proveedor: "prov_05", pallet: 50, pesoKg: 22, perfil: "medio" },
  { rubro: "rub_sec", nombre: "Placa de yeso resistente a la humedad 12,5 mm", marca: "Durlock", unidad: "PLACA", costo: 19500, proveedor: "prov_05", pallet: 50, pesoKg: 24, perfil: "medio" },
  { rubro: "rub_sec", nombre: "Placa de yeso estándar 12,5 mm 1,20x2,40 m", marca: "Knauf", unidad: "PLACA", costo: 13600, proveedor: "prov_05", pallet: 50, pesoKg: 22, perfil: "medio" },
  { rubro: "rub_sec", nombre: "Perfil montante 70 mm x 2,60 m", marca: "Barbieri", unidad: "UN", costo: 5200, proveedor: "prov_05", pesoKg: 1.6, perfil: "medio" },
  { rubro: "rub_sec", nombre: "Perfil solera 70 mm x 2,60 m", marca: "Barbieri", unidad: "UN", costo: 4400, proveedor: "prov_05", pesoKg: 1.3, perfil: "medio" },
  { rubro: "rub_sec", nombre: "Masilla lista para usar 32 kg", marca: "Durlock", unidad: "UN", costo: 26000, proveedor: "prov_05", pesoKg: 32, perfil: "chico" },
  { rubro: "rub_sec", nombre: "Cinta de papel microperforada 150 m", marca: "Durlock", unidad: "ROLLO", costo: 3800, proveedor: "prov_05", pesoKg: 0.6, perfil: "chico" },
  { rubro: "rub_sec", nombre: "Tornillo T2 punta aguja (caja x 1000)", marca: "Barbieri", unidad: "CAJA", costo: 9800, proveedor: "prov_05", pesoKg: 1.5, perfil: "chico" },
  { rubro: "rub_sec", nombre: "Placa cementicia 8 mm 1,20x2,40 m", marca: "Superboard", unidad: "PLACA", costo: 32000, proveedor: "prov_05", pallet: 40, pesoKg: 33, perfil: "chico" },
  // ── Pisos y revestimientos
  { rubro: "rub_pis", nombre: "Porcelanato 60x60 Gris Pulido rectificado", marca: "Ilva", unidad: "M2", costo: 22000, proveedor: "prov_06", pesoKg: 24, perfil: "m2" },
  { rubro: "rub_pis", nombre: "Porcelanato 60x60 Beige Mate", marca: "Ilva", unidad: "M2", costo: 20800, proveedor: "prov_06", pesoKg: 24, perfil: "m2" },
  { rubro: "rub_pis", nombre: "Porcelanato 58x58 Cemento Gris", marca: "Cortines", unidad: "M2", costo: 18500, proveedor: "prov_06", pesoKg: 23, perfil: "m2" },
  { rubro: "rub_pis", nombre: "Cerámica piso 36x36 Travertino", marca: "Cerro Negro", unidad: "M2", costo: 9200, proveedor: "prov_06", pesoKg: 18, perfil: "m2" },
  { rubro: "rub_pis", nombre: "Cerámica revestimiento 30x45 Blanco brillante", marca: "Cerro Negro", unidad: "M2", costo: 8700, proveedor: "prov_06", pesoKg: 16, perfil: "m2" },
  { rubro: "rub_pis", nombre: "Cerámica piso 45x45 Madera Roble", marca: "Cortines", unidad: "M2", costo: 11500, proveedor: "prov_06", pesoKg: 19, perfil: "m2" },
  { rubro: "rub_pis", nombre: "Adhesivo cerámico impermeable 30 kg", marca: "Klaukol", unidad: "BOLSA", costo: 9200, proveedor: "prov_06", pallet: 40, pesoKg: 30, perfil: "medio" },
  { rubro: "rub_pis", nombre: "Adhesivo para porcelanato 30 kg", marca: "Klaukol", unidad: "BOLSA", costo: 14800, proveedor: "prov_06", pallet: 40, pesoKg: 30, perfil: "medio" },
  { rubro: "rub_pis", nombre: "Pastina para porcelanato 1 kg", marca: "Klaukol", unidad: "UN", costo: 2900, proveedor: "prov_06", pesoKg: 1, perfil: "chico" },
  { rubro: "rub_pis", nombre: "Adhesivo flexible weber.col flex 30 kg", marca: "Weber", unidad: "BOLSA", costo: 15400, proveedor: "prov_07", pallet: 40, pesoKg: 30, perfil: "medio" },
  // ── Sanitarios
  { rubro: "rub_san", nombre: "Inodoro largo Andina", marca: "Ferrum", unidad: "UN", costo: 118000, proveedor: "prov_08", pesoKg: 22, perfil: "unidad" },
  { rubro: "rub_san", nombre: "Mochila Andina con herrajes", marca: "Ferrum", unidad: "UN", costo: 95000, proveedor: "prov_08", pesoKg: 14, perfil: "unidad" },
  { rubro: "rub_san", nombre: "Lavatorio Bari 3 agujeros", marca: "Ferrum", unidad: "UN", costo: 52000, proveedor: "prov_08", pesoKg: 12, perfil: "unidad" },
  { rubro: "rub_san", nombre: "Bidet Andina 3 agujeros", marca: "Ferrum", unidad: "UN", costo: 89000, proveedor: "prov_08", pesoKg: 18, perfil: "unidad" },
  { rubro: "rub_san", nombre: "Caño PPR termofusión Ø 20 mm x 4 m", marca: "Tigre", unidad: "UN", costo: 4800, proveedor: "prov_08", pesoKg: 0.8, perfil: "medio" },
  { rubro: "rub_san", nombre: "Caño PPR termofusión Ø 25 mm x 4 m", marca: "Tigre", unidad: "UN", costo: 7200, proveedor: "prov_08", pesoKg: 1.1, perfil: "medio" },
  { rubro: "rub_san", nombre: "Caño PVC cloacal Ø 110 mm x 4 m", marca: "Awaduct", unidad: "UN", costo: 21500, proveedor: "prov_08", pesoKg: 6, perfil: "medio" },
  { rubro: "rub_san", nombre: "Caño PVC cloacal Ø 40 mm x 4 m", marca: "Awaduct", unidad: "UN", costo: 6800, proveedor: "prov_08", pesoKg: 1.6, perfil: "medio" },
  { rubro: "rub_san", nombre: "Codo PVC Ø 110 mm a 90°", marca: "Awaduct", unidad: "UN", costo: 2600, proveedor: "prov_08", pesoKg: 0.4, perfil: "chico" },
  { rubro: "rub_san", nombre: "Tanque de agua tricapa 1000 L", marca: "Rotoplas", unidad: "UN", costo: 210000, proveedor: "prov_08", pesoKg: 25, perfil: "unidad" },
  // ── Griferías
  { rubro: "rub_gri", nombre: "Grifería lavatorio monocomando Arizona", marca: "FV", unidad: "UN", costo: 145000, proveedor: "prov_08", pesoKg: 2.5, perfil: "unidad" },
  { rubro: "rub_gri", nombre: "Juego de ducha Arizona con transferencia", marca: "FV", unidad: "UN", costo: 198000, proveedor: "prov_08", pesoKg: 3.5, perfil: "unidad" },
  { rubro: "rub_gri", nombre: "Grifería cocina pared Allegro", marca: "FV", unidad: "UN", costo: 112000, proveedor: "prov_08", pesoKg: 2.2, perfil: "unidad" },
  { rubro: "rub_gri", nombre: "Llave de paso esférica 3/4\"", marca: "FV", unidad: "UN", costo: 18500, proveedor: "prov_08", pesoKg: 0.6, perfil: "chico" },
  { rubro: "rub_gri", nombre: "Canilla de servicio 1/2\"", marca: "FV", unidad: "UN", costo: 9800, proveedor: "prov_08", pesoKg: 0.4, perfil: "chico" },
  { rubro: "rub_gri", nombre: "Flexible mallado 30 cm", marca: "FV", unidad: "UN", costo: 2900, proveedor: "prov_08", pesoKg: 0.1, perfil: "chico" },
  // ── Impermeabilización
  { rubro: "rub_imp", nombre: "Hidrófugo Sika 1 x 10 L", marca: "Sika", unidad: "UN", costo: 21000, proveedor: "prov_09", pesoKg: 10, perfil: "chico" },
  { rubro: "rub_imp", nombre: "Membrana líquida Sikafill techos 20 kg", marca: "Sika", unidad: "UN", costo: 78000, proveedor: "prov_09", pesoKg: 20, perfil: "chico" },
  { rubro: "rub_imp", nombre: "Membrana asfáltica 4 mm con aluminio (rollo 10 m²)", marca: "Megaflex", unidad: "ROLLO", costo: 52000, proveedor: "prov_09", pesoKg: 40, perfil: "chico" },
  { rubro: "rub_imp", nombre: "Recuplast Techos membrana líquida 20 L", marca: "Alba", unidad: "UN", costo: 92000, proveedor: "prov_10", pesoKg: 22, perfil: "chico" },
  { rubro: "rub_imp", nombre: "Impermeabilizante cementicio weber.dry 25 kg", marca: "Weber", unidad: "BOLSA", costo: 36000, proveedor: "prov_07", pesoKg: 25, perfil: "chico" },
  { rubro: "rub_imp", nombre: "Sellador poliuretánico Sikaflex 1A 300 ml", marca: "Sika", unidad: "UN", costo: 12500, proveedor: "prov_09", pesoKg: 0.4, perfil: "chico" },
  // ── Aislantes
  { rubro: "rub_ais", nombre: "Lana de vidrio 50 mm rollo 1,20x18 m", marca: "Isover", unidad: "ROLLO", costo: 64000, proveedor: "prov_07", pesoKg: 18, perfil: "chico" },
  { rubro: "rub_ais", nombre: "Lana de vidrio 50 mm con aluminio rollo 1,20x18 m", marca: "Isover", unidad: "ROLLO", costo: 82000, proveedor: "prov_07", pesoKg: 19, perfil: "chico" },
  { rubro: "rub_ais", nombre: "Placa de poliestireno expandido 1x1 m 20 mm", marca: "Isover", unidad: "PLACA", costo: 2400, proveedor: "prov_07", pesoKg: 0.3, perfil: "medio" },
  { rubro: "rub_ais", nombre: "Aislante espuma 10 mm con aluminio (rollo 20 m²)", marca: "Isolant", unidad: "ROLLO", costo: 38000, proveedor: "prov_10", pesoKg: 6, perfil: "chico" },
  // ── Herramientas e insumos
  { rubro: "rub_her", nombre: "Látex interior mate 20 L", marca: "Alba", unidad: "UN", costo: 98000, proveedor: "prov_10", pesoKg: 28, perfil: "chico" },
  { rubro: "rub_her", nombre: "Fijador sellador al agua 20 L", marca: "Alba", unidad: "UN", costo: 64000, proveedor: "prov_10", pesoKg: 21, perfil: "chico" },
  { rubro: "rub_her", nombre: "Carretilla reforzada 70 L rueda maciza", marca: "Gherardi", unidad: "UN", costo: 92000, proveedor: "prov_10", pesoKg: 17, perfil: "unidad" },
  { rubro: "rub_her", nombre: "Balde albañil reforzado 12 L", marca: "Biassoni", unidad: "UN", costo: 3500, proveedor: "prov_10", pesoKg: 0.7, perfil: "chico" },
  { rubro: "rub_her", nombre: "Cuchara de albañil 8\"", marca: "Bellota", unidad: "UN", costo: 7800, proveedor: "prov_10", pesoKg: 0.4, perfil: "chico" },
  { rubro: "rub_her", nombre: "Nivel de aluminio 60 cm", marca: "Stanley", unidad: "UN", costo: 18500, proveedor: "prov_10", pesoKg: 0.6, perfil: "chico" },
  { rubro: "rub_her", nombre: "Disco de corte metal 115 mm (caja x 25)", marca: "Tyrolit", unidad: "CAJA", costo: 16000, proveedor: "prov_10", pesoKg: 1.8, perfil: "chico" },
  { rubro: "rub_her", nombre: "Alambre negro recocido N° 16", marca: "Acindar", unidad: "KG", costo: 3200, proveedor: "prov_04", pesoKg: 1, perfil: "medio" },
  { rubro: "rub_her", nombre: "Clavos punta París 2\"", marca: "Acindar", unidad: "KG", costo: 3800, proveedor: "prov_04", pesoKg: 1, perfil: "chico" },
];
