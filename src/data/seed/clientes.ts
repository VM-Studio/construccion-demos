import type { Cliente, CondicionIVA, CondicionPago, TipoCliente } from "@/domain/types";
import { generarCUIT } from "@/domain/cuit";

type C = [
  id: string,
  razonSocial: string,
  nombreFantasia: string | undefined,
  tipo: TipoCliente,
  cuitPref: string,
  cuitNum: number,
  iva: CondicionIVA,
  direccion: string,
  localidad: string,
  lista: string,
  cond: CondicionPago,
  limite: number,
  vendedor: string,
  sucursal: string,
  telefono: string,
];

const DATA: C[] = [
  // Corralones
  ["cli_01", "Corralón El Amigo S.R.L.", "Corralón El Amigo", "CORRALON", "30", 71234098, "RI", "Av. Libertador 2450", "Moreno", "lst_cor", "CTA_CTE_30", 18_000_000, "usr_carla", "suc_norte", "(0237) 466-2210"],
  ["cli_02", "San Cayetano Materiales S.A.", "Corralón San Cayetano", "CORRALON", "30", 70876543, "RI", "Av. Presidente Perón 3300", "José C. Paz", "lst_may", "CTA_CTE_30", 25_000_000, "usr_carla", "suc_norte", "(02320) 42-8871"],
  ["cli_03", "Materiales Don Luis S.R.L.", "Don Luis Materiales", "CORRALON", "30", 71567234, "RI", "Ruta 25 km 4,2", "Escobar", "lst_cor", "CTA_CTE_30", 12_000_000, "usr_carla", "suc_norte", "(0348) 442-6619"],
  ["cli_04", "Corralón La Esquina de Del Viso S.R.L.", "Corralón La Esquina", "CORRALON", "30", 71998123, "RI", "Av. Croacia 1120", "Del Viso", "lst_cor", "CTA_CTE_30", 9_000_000, "usr_carla", "suc_norte", "(02320) 47-1105"],
  ["cli_05", "Los Hornos Pilar S.A.", "Corralón Los Hornos", "CORRALON", "30", 70345612, "RI", "Ruta 8 km 55", "Pilar", "lst_may", "CTA_CTE_30", 22_000_000, "usr_carla", "suc_norte", "(0230) 443-9080"],
  ["cli_06", "Materiales Sarmiento S.R.L.", "Materiales Sarmiento", "CORRALON", "30", 71450987, "RI", "Sarmiento 2890", "San Martín", "lst_cor", "CTA_CTE_30", 14_000_000, "usr_pablo", "suc_sur", "(011) 4753-2208"],
  ["cli_07", "Corralón Villa Ballester S.A.", "Corralón Ballester", "CORRALON", "30", 70654321, "RI", "Av. Rivadavia 4500", "Villa Ballester", "lst_cor", "CTA_CTE_30", 16_000_000, "usr_pablo", "suc_sur", "(011) 4768-0012"],
  ["cli_08", "Tres Hermanos Construcción S.R.L.", "Corralón Tres Hermanos", "CORRALON", "30", 71876234, "RI", "Av. San Martín 3800", "Caseros", "lst_cor", "CTA_CTE_15", 8_000_000, "usr_pablo", "suc_sur", "(011) 4750-7731"],
  // Constructoras
  ["cli_09", "Constructora Del Sol S.A.", "Del Sol", "CONSTRUCTORA", "30", 70123456, "RI", "Av. del Libertador 15200", "San Isidro", "lst_may", "CTA_CTE_60", 80_000_000, "usr_carla", "suc_norte", "(011) 4742-5500"],
  ["cli_10", "Grupo Edilicio Pampa S.A.", "Edilicio Pampa", "CONSTRUCTORA", "30", 71345678, "RI", "Panamericana km 42,5", "Pilar", "lst_may", "CTA_CTE_60", 50_000_000, "usr_carla", "suc_norte", "(0230) 444-7000"],
  ["cli_11", "Construcciones Ruta 8 S.R.L.", "Ruta 8 Construcciones", "CONSTRUCTORA", "30", 71654987, "RI", "Av. Márquez 980", "San Martín", "lst_may", "CTA_CTE_30", 40_000_000, "usr_pablo", "suc_sur", "(011) 4724-3300"],
  // Arquitectos
  ["cli_12", "Valeria Paz", "Arq. Valeria Paz", "ARQUITECTO", "27", 28456123, "MONOTRIBUTO", "Belgrano 655", "Pilar", "lst_cor", "CTA_CTE_15", 5_000_000, "usr_carla", "suc_norte", "11 5566-1123"],
  ["cli_13", "Estudio Luna & Asociados S.R.L.", "Estudio Luna", "ARQUITECTO", "30", 71223344, "RI", "Av. Santa Fe 1870 piso 3", "Martínez", "lst_cor", "CTA_CTE_30", 6_000_000, "usr_carla", "suc_norte", "(011) 4798-1200"],
  ["cli_14", "Sofía Bianchi", "Arq. Sofía Bianchi", "ARQUITECTO", "27", 31789456, "MONOTRIBUTO", "Pueyrredón 1430", "San Martín", "lst_cor", "CTA_CTE_15", 3_500_000, "usr_pablo", "suc_sur", "11 6677-4521"],
  ["cli_15", "MV Arquitectura S.R.L.", "Estudio MV", "ARQUITECTO", "30", 71889900, "RI", "Mitre 3020", "Villa Ballester", "lst_cor", "CTA_CTE_30", 4_500_000, "usr_pablo", "suc_sur", "(011) 4767-8890"],
  ["cli_16", "Tomás Ríos", "Arq. Tomás Ríos", "ARQUITECTO", "20", 29874563, "MONOTRIBUTO", "Chacabuco 220", "Escobar", "lst_cor", "CONTADO", 0, "usr_carla", "suc_norte", "11 4455-9087"],
  // Particulares
  ["cli_17", "Juan Pérez", undefined, "PARTICULAR", "20", 25678234, "CF", "Los Aromos 145, Barrio Los Pilares", "Pilar", "lst_pub", "CONTADO", 0, "usr_carla", "suc_norte", "11 3344-5566"],
  ["cli_18", "María González", undefined, "PARTICULAR", "27", 30123987, "CF", "Diagonal 82 Nº 1450", "San Martín", "lst_pub", "CONTADO", 0, "usr_pablo", "suc_sur", "11 2233-9988"],
  ["cli_19", "Roberto Álvarez", undefined, "PARTICULAR", "20", 22345876, "CF", "Lote 312, Barrio San Agustín", "Escobar", "lst_pub", "CONTADO", 0, "usr_carla", "suc_norte", "11 5512-3478"],
  ["cli_20", "Lucía Fernández", undefined, "PARTICULAR", "27", 33456123, "CF", "Alvear 2210", "Villa Ballester", "lst_pub", "CONTADO", 0, "usr_pablo", "suc_sur", "11 6611-2290"],
  ["cli_21", "Gustavo Torres", undefined, "PARTICULAR", "20", 27890345, "MONOTRIBUTO", "Lisandro de la Torre 780", "Del Viso", "lst_pub", "CTA_CTE_15", 1_500_000, "usr_carla", "suc_norte", "11 4789-1200"],
  ["cli_22", "Ana Martínez", undefined, "PARTICULAR", "27", 26543210, "CF", "Ayacucho 3450", "San Martín", "lst_pub", "CONTADO", 0, "usr_pablo", "suc_sur", "11 3098-7765"],
  ["cli_23", "Sergio Domínguez", undefined, "PARTICULAR", "20", 24567890, "CF", "Las Heras 1230", "Pilar", "lst_pub", "CONTADO", 0, "usr_carla", "suc_norte", "11 5098-4432"],
  ["cli_24", "Claudia Herrera", undefined, "PARTICULAR", "27", 29012345, "MONOTRIBUTO", "Moreno 870", "Caseros", "lst_pub", "CTA_CTE_15", 1_200_000, "usr_pablo", "suc_sur", "11 4321-8765"],
];

export function seedClientes(ts: string): Cliente[] {
  return DATA.map(
    ([id, razonSocial, nombreFantasia, tipo, cuitPref, cuitNum, condicionIVA, direccion, localidad, listaPreciosId, condicionPago, limiteCredito, vendedorId, sucursalPreferidaId, telefono]) => ({
      id,
      razonSocial,
      nombreFantasia,
      tipo,
      cuit: generarCUIT(cuitPref, cuitNum),
      condicionIVA,
      email: `${(nombreFantasia ?? razonSocial).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@gmail.com`,
      telefono,
      direccion,
      localidad,
      listaPreciosId,
      condicionPago,
      limiteCredito,
      vendedorId,
      sucursalPreferidaId,
      activo: true,
      notas: id === "cli_09" ? "Cliente estratégico. Obra Torres del Sol (Nordelta), acopio grande vigente." : undefined,
      creadoEn: ts,
      actualizadoEn: ts,
    }),
  );
}
