import type { Chofer, Deposito, Sucursal, UnidadNegocio, Usuario, Vehiculo } from "@/domain/types";

export function seedOrganizacion(ts: string) {
  const base = { creadoEn: ts, actualizadoEn: ts };

  const unidadesNegocio: UnidadNegocio[] = [
    { id: "un_cor", nombre: "Corralón", codigo: "COR", orden: 1, ...base },
    { id: "un_fer", nombre: "Ferretería", codigo: "FER", orden: 2, ...base },
  ];

  const sucursales: Sucursal[] = [
    { id: "suc_central", nombre: "Casa Central", direccion: "Av. Gral. San Martín 4520, Florida Oeste", telefono: "(011) 4730-5520", depositoId: "dep_central", puntoVenta: "0001", puntoVentaRemito: "00016", ...base },
    { id: "suc_2", nombre: "Sucursal 2", direccion: "Av. Ricardo Balbín 2870, San Martín", telefono: "(011) 4754-2870", depositoId: "dep_2", puntoVenta: "0002", puntoVentaRemito: "00006", ...base },
  ];

  const depositos: Deposito[] = [
    { id: "dep_central", nombre: "Depósito Casa Central", sucursalId: "suc_central", direccion: "Av. Gral. San Martín 4560, Florida Oeste", posiciones: ["Playa 1", "Playa 2", "Galpón 1", "Mostrador"], ...base },
    { id: "dep_2", nombre: "Depósito Sucursal 2", sucursalId: "suc_2", direccion: "Av. Ricardo Balbín 2890, San Martín", posiciones: ["Playa", "Galpón 2", "Mostrador"], ...base },
  ];

  const usuarios: Usuario[] = [
    { id: "usr_felipe", nombre: "Felipe", apellido: "", email: "felipe@acerosrnf.com.ar", rol: "DUENO", activo: true, avatarIniciales: "F", ...base },
    { id: "usr_natalia", nombre: "Natalia Quiroga", email: "natalia@acerosrnf.com.ar", rol: "ADMINISTRACION", activo: true, avatarIniciales: "NQ", ...base },
    { id: "usr_sergio", nombre: "Sergio Medina", email: "sergio@acerosrnf.com.ar", rol: "ADMINISTRACION", activo: true, avatarIniciales: "SM", ...base },
    { id: "usr_lucas", nombre: "Lucas Fernández", email: "lucas@acerosrnf.com.ar", rol: "VENTAS", sucursalId: "suc_central", activo: true, avatarIniciales: "LF", ...base },
    { id: "usr_rocio", nombre: "Rocío Benítez", email: "rocio@acerosrnf.com.ar", rol: "VENTAS", sucursalId: "suc_2", activo: true, avatarIniciales: "RB", ...base },
    { id: "usr_hugo", nombre: "Hugo Ramírez", email: "hugo@acerosrnf.com.ar", rol: "DEPOSITO", sucursalId: "suc_central", activo: true, avatarIniciales: "HR", ...base },
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

  return { unidadesNegocio, sucursales, depositos, usuarios, choferes, vehiculos };
}
