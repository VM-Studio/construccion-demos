import type { EstadoInicial } from "@/domain/types";
import { BRAND } from "@/config/brand";

/** Configuración inicial (parámetros, motivos de ajuste y datos de la empresa). */
export function configInicial(): EstadoInicial["config"] {
  return {
    ivaPct: 21,
    validezPresupuestoDias: 7,
    diasVencimientoAcopio: 180,
    alicuotaIIBBPct: 0,
    alertaStockMinimo: true,
    umbralSubaCostoPct: 3,
    tipoCambioUSD: 1450,
    tipoCambioModo: "AUTO",
    tamanoMaxAdjuntoMB: 10,
    categoriasAdjunto: [
      { codigo: "REMITO_FIRMADO", nombre: "Remito firmado" },
      { codigo: "FACTURA_PROVEEDOR", nombre: "Factura de proveedor" },
      { codigo: "OTRO", nombre: "Otro" },
    ],
    motivosAjuste: [
      { codigo: "INVENTARIO_INICIAL", nombre: "Inventario inicial", activo: true },
      { codigo: "ROTURA", nombre: "Rotura", activo: true },
      { codigo: "FALTANTE", nombre: "Faltante en inventario", activo: true },
      { codigo: "SOBRANTE", nombre: "Sobrante en inventario", activo: true },
      { codigo: "VENCIMIENTO", nombre: "Vencimiento", activo: true },
      { codigo: "MUESTRA", nombre: "Muestra", activo: true },
      { codigo: "OTRO", nombre: "Otro", activo: true },
    ],
    empresa: {
      empresa: BRAND.empresa,
      razonSocial: BRAND.razonSocial,
      cuit: BRAND.cuit,
      direccion: BRAND.direccion,
      telefono: BRAND.telefono,
      email: BRAND.email,
    },
  };
}
