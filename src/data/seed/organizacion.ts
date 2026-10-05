import type { Chofer, Deposito, Sucursal, Usuario, Vehiculo } from "@/domain/types";

export function seedOrganizacion(ts: string) {
  const base = { creadoEn: ts, actualizadoEn: ts };

  const sucursales: Sucursal[] = [
    {
      id: "suc_norte",
      nombre: "Sucursal Norte",
      direccion: "Av. Tomás Márquez 1850, Pilar",
      telefono: "(0230) 442-1850",
      depositoId: "dep_norte",
      puntoVenta: "0001",
      ...base,
    },
    {
      id: "suc_sur",
      nombre: "Sucursal Sur",
      direccion: "Av. Ricardo Balbín 3240, San Martín",
      telefono: "(011) 4754-3240",
      depositoId: "dep_sur",
      puntoVenta: "0002",
      ...base,
    },
  ];

  const depositos: Deposito[] = [
    { id: "dep_norte", nombre: "Depósito Norte", sucursalId: "suc_norte", direccion: "Ruta 8 km 52,5, Pilar", ...base },
    { id: "dep_sur", nombre: "Depósito Sur", sucursalId: "suc_sur", direccion: "Av. Ricardo Balbín 3260, San Martín", ...base },
  ];

  const usuarios: Usuario[] = [
    { id: "usr_martin", nombre: "Martín Ferrari", email: "martin@distribuidoranorte.com.ar", rol: "DUENO", activo: true, avatarIniciales: "MF", ...base },
    { id: "usr_laura", nombre: "Laura Giménez", email: "laura@distribuidoranorte.com.ar", rol: "ADMINISTRACION", activo: true, avatarIniciales: "LG", ...base },
    { id: "usr_diego", nombre: "Diego Romero", email: "diego@distribuidoranorte.com.ar", rol: "ADMINISTRACION", activo: true, avatarIniciales: "DR", ...base },
    { id: "usr_carla", nombre: "Carla Méndez", email: "carla@distribuidoranorte.com.ar", rol: "VENTAS", sucursalId: "suc_norte", activo: true, avatarIniciales: "CM", ...base },
    { id: "usr_pablo", nombre: "Pablo Sosa", email: "pablo@distribuidoranorte.com.ar", rol: "VENTAS", sucursalId: "suc_sur", activo: true, avatarIniciales: "PS", ...base },
    { id: "usr_jorge", nombre: "Jorge Benítez", email: "jorge@distribuidoranorte.com.ar", rol: "DEPOSITO", sucursalId: "suc_sur", activo: true, avatarIniciales: "JB", ...base },
  ];

  const choferes: Chofer[] = [
    { id: "cho_1", nombre: "Ramón Acosta", telefono: "11 5521-3348", activo: true, ...base },
    { id: "cho_2", nombre: "Hernán Quiroga", telefono: "11 6187-9012", activo: true, ...base },
    { id: "cho_3", nombre: "Luis Ledesma", telefono: "11 3345-7781", activo: true, ...base },
  ];

  const vehiculos: Vehiculo[] = [
    { id: "veh_1", patente: "AE 412 KD", descripcion: "Mercedes-Benz Atego 1726 con hidrogrúa", capacidadKg: 12000, choferId: "cho_1", activo: true, ...base },
    { id: "veh_2", patente: "AD 087 PS", descripcion: "Ford Cargo 1723 playo", capacidadKg: 9000, choferId: "cho_2", activo: true, ...base },
    { id: "veh_3", patente: "AF 233 LT", descripcion: "Iveco Daily 70C17 caja abierta", capacidadKg: 3500, choferId: "cho_3", activo: true, ...base },
  ];

  return { sucursales, depositos, usuarios, choferes, vehiculos };
}
