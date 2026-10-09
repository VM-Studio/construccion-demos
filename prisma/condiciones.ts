/** Condiciones de pago de referencia (tabla CondicionPago). */
export const CONDICIONES_PAGO = [
  { codigo: "CONTADO", nombre: "Contado", dias: 0 },
  { codigo: "CTA_CTE_15", nombre: "Cuenta corriente 15 días", dias: 15 },
  { codigo: "CTA_CTE_30", nombre: "Cuenta corriente 30 días", dias: 30 },
  { codigo: "CTA_CTE_60", nombre: "Cuenta corriente 60 días", dias: 60 },
  { codigo: "ANTICIPO", nombre: "Anticipo", dias: 0 },
] as const;
