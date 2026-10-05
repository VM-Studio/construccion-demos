# construccion-demos

Sistema de gestión para distribuidora de materiales de construcción. DEMO comercial de VM Studio: debe verse como producto terminado.

## Negocio
- Empresa de 7 años, 2 sucursales (Norte y Sur), cada una con su depósito. No fabrica: compra, acopia, almacena, vende y despacha.
- Flujos clave: Orden de compra → Ingreso de mercadería (recepción) → Stock por depósito → Venta (presupuesto → pedido → comprobante) → Despacho (remito) → Cobranza. Acopio: el cliente compra cantidades a precio fijo, paga, y retira en partes; el saldo pendiente es "deuda de mercadería".
- Rentabilidad por pedido = Σ (precio unitario vendido − costo unitario al momento de la venta) × cantidad. El costo se guarda como snapshot en cada línea, nunca se recalcula con el costo actual.
- Stock: físico, comprometido (pedidos confirmados sin despachar + saldos de acopio sin retirar), disponible = físico − comprometido, en tránsito (OC confirmadas sin recibir).

## Stack y reglas
- Next.js 15 App Router, TS strict, Tailwind v4 (tokens en globals.css), Zustand con persist, Recharts, Lucide, pnpm.
- SIN base de datos. `src/data/repositories/*` expone funciones tipadas; `src/store/*` las consume. Las pantallas nunca tocan localStorage directo.
- Toda regla de negocio vive en `src/domain/` como funciones puras testeables. Los componentes solo renderizan y llaman acciones del store.
- Dinero en ARS, siempre `formatMoney`. Fechas con date-fns y `formatDate`. Nunca `toLocaleString` suelto.
- UI: usar las primitivas de `src/components/ui`. No inventar colores: solo tokens. Un acento (ámbar) para lo importante. Densidad alta.
- Español rioplatense en toda la UI (vos/usted neutro: "Crear pedido", "Confirmar", "Cancelar"). Sin anglicismos innecesarios.
- Cada página: título, acción primaria arriba a la derecha, filtros, tabla o grilla, estado vacío con CTA.
- Mobile responsive obligatorio pero el diseño prioritario es escritorio (lo van a usar en PC de oficina y depósito).
- Commits en español, imperativo, cortos.
