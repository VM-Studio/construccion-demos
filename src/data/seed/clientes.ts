import type { Circuito, Cliente, CondicionIVA, CondicionPago, Obra, TipoCliente } from "@/domain/types";
import { generarCUIT } from "@/domain/cuit";

type C = [
  id: string,
  codigo: string,
  razonSocial: string,
  fantasia: string | undefined,
  tipo: TipoCliente,
  cuit: [string, number],
  iva: CondicionIVA,
  circuito: Circuito,
  direccion: string,
  localidad: string,
  lista: string,
  cond: CondicionPago,
  limite: number,
  vendedor: string,
  sucursal: string,
  telefono: string,
  obras: [string, string?, string?][],
];

const DATA: C[] = [
  ["cli_ramos", "C17354", "Ramos María Zulema", undefined, "PARTICULAR", ["27", 17354882], "CF", 2, "Av. Italia 1420", "Tigre", "lst_gen", "CONTADO", 0, "usr_lucas", "suc_central", "11 4405-2231", [["Canton Islas Lote 268", "Barrio Canton Islas, Lote 268", "Benavídez"], ["CANTON GOLF LOTE 377", "Barrio Canton Golf, Lote 377", "Benavídez"]]],
  ["cli_sp2", "C0456", "SP2 Group S.A.", "SP2 Group", "CONSTRUCTORA", ["30", 71456231], "RI", 1, "Av. Maipú 2150", "Vicente López", "lst_may", "CTA_CTE_30", 60_000_000, "usr_lucas", "suc_central", "(011) 4791-6600", [["Edificio Maipú 2150", "Av. Maipú 2150", "Vicente López"], ["Torre Olivos", "Corrientes 1850", "Olivos"]]],
  ["cli_bencen", "C0225", "Bencen Construcciones S.R.L.", "Bencen", "CONSTRUCTORA", ["30", 71225890], "RI", 1, "Laprida 3300", "Florida", "lst_may", "CTA_CTE_30", 45_000_000, "usr_lucas", "suc_central", "(011) 4761-2200", [["Edificio Laprida 3300", "Laprida 3300", "Florida"]]],
  ["cli_pavifer", "C0241", "Pavifer Asfaltos S.A.", "Pavifer", "CONSTRUCTORA", ["30", 70241558], "RI", 1, "Ruta 197 1450", "José C. Paz", "lst_may", "CTA_CTE_60", 50_000_000, "usr_rocio", "suc_2", "(02320) 42-1100", [["Pavimento Barrio San Jorge", "Calle 12 y 7", "José C. Paz"], ["Playón Industrial Panamericana", "Panamericana km 32", "Tortuguitas"]]],
  ["cli_indinaco", "C0202", "Indinaco S.R.L.", "Indinaco", "CONSTRUCTORA", ["30", 71202336], "RI", 2, "Av. Mitre 4120", "Munro", "lst_may", "CTA_CTE_30", 30_000_000, "usr_lucas", "suc_central", "(011) 4756-0102", [["Galpón Munro", "Av. Mitre 4120", "Munro"], ["Casa Carapachay", "Melo 2200", "Carapachay"]]],
  ["cli_mammarella", "C1061", "Mammarella Reformas S.R.L.", "Mammarella", "CONSTRUCTORA", ["30", 71061447], "RI", 2, "Belgrano 880", "San Isidro", "lst_gen", "CTA_CTE_15", 8_000_000, "usr_lucas", "suc_central", "(011) 4743-1061", [["Reforma Belgrano 880", "Belgrano 880", "San Isidro"]]],
  ["cli_delplata", "C0207", "Constructora del Plata S.A.", "Constructora del Plata", "CONSTRUCTORA", ["30", 70207114], "RI", 1, "Av. Libertador 13200", "Martínez", "lst_may", "CTA_CTE_60", 70_000_000, "usr_lucas", "suc_central", "(011) 4798-0207", [["Nordelta Castaños 225", "Castaños 225, Nordelta", "Tigre"], ["Edificio Libertador", "Av. Libertador 13200", "Martínez"], ["Barrio Los Robles Lote 14", "Los Robles Lote 14", "Pilar"]]],
  ["cli_enjinia", "C0554", "Enjinia Construcciones S.A.", "Enjinia", "CONSTRUCTORA", ["30", 71554090], "RI", 1, "Sucre 1560", "Villa Adelina", "lst_may", "CTA_CTE_30", 40_000_000, "usr_rocio", "suc_2", "(011) 4717-5540", [["Edificio Sucre 1560", "Sucre 1560", "Villa Adelina"], ["Dúplex Boulogne", "Avellaneda 1200", "Boulogne"]]],
  ["cli_ioc", "C1072", "IOC Soluciones S.R.L.", "IOC Soluciones", "CONSTRUCTORA", ["30", 71072318], "RI", 1, "Av. Constituyentes 5800", "Villa Maipú", "lst_gen", "CTA_CTE_30", 15_000_000, "usr_rocio", "suc_2", "(011) 4753-1072", [["Local Constituyentes", "Av. Constituyentes 5800", "Villa Maipú"]]],
  ["cli_naku", "C0761", "Naku Construcciones S.R.L.", "Naku Construcciones", "CONSTRUCTORA", ["30", 71761529], "RI", 2, "Av. Fondo de la Legua 1100", "Boulogne", "lst_gen", "CTA_CTE_30", 12_000_000, "usr_lucas", "suc_central", "(011) 4737-0761", [["Casa Fondo de la Legua", "Fondo de la Legua 1100", "Boulogne"], ["Quinta Del Viso", "Croacia 450", "Del Viso"]]],
  ["cli_pampa", "C0415", "Grupo Edilicio Pampa S.A.", "Edilicio Pampa", "CONSTRUCTORA", ["30", 71345678], "RI", 1, "Panamericana km 42,5", "Pilar", "lst_may", "CTA_CTE_60", 55_000_000, "usr_lucas", "suc_central", "(0230) 444-7000", [["Barrio Los Robles Lote 22", "Los Robles Lote 22", "Pilar"], ["Barrio Los Robles Lote 23", "Los Robles Lote 23", "Pilar"]]],
  ["cli_brickell", "C2210", "Brickell Trade & Co. S.A.", "Brickell Trade", "CORRALON", ["30", 71221076], "RI", 2, "Av. Vergara 2340", "Villa Tesei", "lst_may", "CTA_CTE_30", 20_000_000, "usr_rocio", "suc_2", "(011) 4489-2210", [["Corralón Villa Tesei", "Av. Vergara 2340", "Villa Tesei"]]],
  ["cli_lurbrecht", "C1480", "Lurbrecht S.R.L.", "Lurbrecht", "CORRALON", ["30", 71480263], "RI", 1, "Av. Perón 3500", "San Miguel", "lst_may", "CTA_CTE_30", 18_000_000, "usr_rocio", "suc_2", "(011) 4664-1480", [["Corralón San Miguel", "Av. Perón 3500", "San Miguel"]]],
  ["cli_donpepe", "C0312", "Corralón Don Pepe S.R.L.", "Corralón Don Pepe", "CORRALON", ["30", 71312455], "RI", 1, "Ruta 25 km 4,2", "Escobar", "lst_may", "CTA_CTE_30", 16_000_000, "usr_lucas", "suc_central", "(0348) 442-0312", [["Corralón Escobar", "Ruta 25 km 4,2", "Escobar"]]],
  ["cli_launion", "C0388", "Corralón La Unión S.A.", "Corralón La Unión", "CORRALON", ["30", 70388112], "RI", 2, "Av. San Martín 3800", "Caseros", "lst_may", "CTA_CTE_15", 6_000_000, "usr_rocio", "suc_2", "(011) 4750-0388", [["Corralón Caseros", "Av. San Martín 3800", "Caseros"]]],
  ["cli_eltornillo", "C3101", "Ferretería El Tornillo", "El Tornillo", "FERRETERIA", ["20", 25310144], "MONOTRIBUTO", 2, "Av. Bartolomé Mitre 2210", "Munro", "lst_may", "CTA_CTE_15", 3_000_000, "usr_lucas", "suc_central", "(011) 4762-3101", [["Local Munro", "Av. B. Mitre 2210", "Munro"]]],
  ["cli_sanandres", "C3102", "Ferretería San Andrés S.R.L.", "Ferretería San Andrés", "FERRETERIA", ["30", 71310288], "RI", 1, "Calle 91 Nº 3456", "San Andrés", "lst_may", "CTA_CTE_30", 5_000_000, "usr_rocio", "suc_2", "(011) 4752-3102", [["Local San Andrés", "Calle 91 Nº 3456", "San Andrés"]]],
  ["cli_munrohogar", "C3103", "Munro Hogar", "Munro Hogar", "FERRETERIA", ["27", 30310377], "MONOTRIBUTO", 2, "Vélez Sarsfield 4800", "Munro", "lst_may", "CTA_CTE_15", 2_500_000, "usr_lucas", "suc_central", "(011) 4756-3103", [["Local Vélez Sarsfield", "Vélez Sarsfield 4800", "Munro"]]],
  ["cli_bulonera", "C3104", "Bulonera Villa Adelina S.R.L.", "Bulonera Villa Adelina", "FERRETERIA", ["30", 71310455], "RI", 1, "Av. Paraná 6500", "Villa Adelina", "lst_may", "CTA_CTE_30", 4_000_000, "usr_rocio", "suc_2", "(011) 4717-3104", [["Local Av. Paraná", "Av. Paraná 6500", "Villa Adelina"]]],
  ["cli_bianchi", "C0905", "Lucía Bianchi", "Estudio Arq. Bianchi", "ARQUITECTO", ["27", 31789456], "MONOTRIBUTO", 1, "Pueyrredón 1430", "San Martín", "lst_gen", "CTA_CTE_15", 4_000_000, "usr_rocio", "suc_2", "11 6677-4521", [["Casa Villa Ballester", "Alvear 2210", "Villa Ballester"], ["PH Saavedra", "Plaza 3400", "CABA"]]],
  ["cli_luna", "C0918", "Federico Luna", "Arq. Federico Luna", "ARQUITECTO", ["20", 29874563], "MONOTRIBUTO", 2, "Chacabuco 220", "Escobar", "lst_gen", "CONTADO", 0, "usr_lucas", "suc_central", "11 4455-9087", [["Casa Maschwitz", "Los Ceibos 140", "Ingeniero Maschwitz"]]],
  ["cli_ortiz", "C2305", "Ortiz Adrián Saúl", undefined, "PARTICULAR", ["20", 23054411], "CF", 2, "Rivadavia 1820", "Florida Oeste", "lst_pub", "CONTADO", 0, "usr_lucas", "suc_central", "11 3344-2305", [["Casa propia Rivadavia 1820", "Rivadavia 1820", "Florida Oeste"]]],
  ["cli_paulino", "C2318", "Paulino Gómez", undefined, "PARTICULAR", ["20", 22318776], "CF", 2, "Los Aromos 145", "Pilar", "lst_pub", "CONTADO", 0, "usr_lucas", "suc_central", "11 5512-2318", [["Ampliación Los Aromos", "Los Aromos 145", "Pilar"]]],
  ["cli_carabetta", "C2347", "Carabetta Leonardo", "Leo Carabetta", "PARTICULAR", ["20", 23470123], "CF", 2, "Pringles 940", "Florida", "lst_pub", "CONTADO", 0, "usr_lucas", "suc_central", "11 6611-2347", [["Quincho Pringles", "Pringles 940", "Florida"]]],
  ["cli_lopez", "C2352", "López Verónica Mabel", undefined, "PARTICULAR", ["27", 23520987], "CF", 2, "Ayacucho 3450", "San Martín", "lst_pub", "CONTADO", 0, "usr_rocio", "suc_2", "11 3098-2352", [["Casa Ayacucho", "Ayacucho 3450", "San Martín"]]],
  ["cli_borghetti", "C1533", "Borghetti Marisa", undefined, "PARTICULAR", ["27", 15334560], "MONOTRIBUTO", 2, "Moreno 870", "Caseros", "lst_gen", "CTA_CTE_15", 1_500_000, "usr_rocio", "suc_2", "11 4321-1533", [["Departamento Moreno 870", "Moreno 870", "Caseros"]]],
  ["cli_alcides", "C2401", "Rodríguez Alcides", undefined, "PARTICULAR", ["20", 24012345], "CF", 2, "Las Heras 1230", "Munro", "lst_pub", "CONTADO", 0, "usr_lucas", "suc_central", "11 5098-2401", [["Casa Las Heras", "Las Heras 1230", "Munro"]]],
  ["cli_doblado", "C2402", "Doblado Osvaldo", undefined, "PARTICULAR", ["20", 24027788], "CF", 2, "Gral. Paz 4510", "Villa Martelli", "lst_pub", "CONTADO", 0, "usr_lucas", "suc_central", "11 4789-2402", [["Galpón Villa Martelli", "Gral. Paz 4510", "Villa Martelli"]]],
];

export function seedClientes(ts: string): { clientes: Cliente[]; obras: Obra[] } {
  const clientes: Cliente[] = [];
  const obras: Obra[] = [];
  for (const [id, codigo, razonSocial, nombreFantasia, tipo, [pref, num], condicionIVA, circuitoHabitual, direccion, localidad, listaPreciosId, condicionPago, limiteCredito, vendedorId, sucursalPreferidaId, telefono, obs] of DATA) {
    clientes.push({
      id,
      codigo,
      razonSocial,
      nombreFantasia,
      tipo,
      cuit: generarCUIT(pref, num),
      condicionIVA,
      circuitoHabitual,
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
      notas: id === "cli_ramos" ? "Cliente con acopio histórico AC2 3633. Dos obras en Canton (Islas y Golf)." : undefined,
      creadoEn: ts,
      actualizadoEn: ts,
    });
    obs.forEach(([nombre, dir, loc], i) =>
      obras.push({ id: `obra_${id.slice(4)}_${i + 1}`, clienteId: id, nombre, direccion: dir, localidad: loc, activa: true, creadoEn: ts, actualizadoEn: ts }),
    );
  }
  return { clientes, obras };
}
