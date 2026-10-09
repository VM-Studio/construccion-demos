-- v_stock_posicion: el físico sale de StockDeposito.cantidadFisica (lo mismo que usa el dominio,
-- src/store/calculos.ts) en lugar de sumar todo el kardex. Con 200.000 movimientos la posición de
-- un depósito pasa de ~156 ms a pocos ms. `pnpm db:check` verifica que StockDeposito = Σ kardex.
CREATE OR REPLACE VIEW "v_stock_posicion" AS
WITH
fis AS (
  SELECT "productoId", "depositoId", "cantidadFisica" AS fisico FROM "StockDeposito"
),
picking AS NOT MATERIALIZED (
  SELECT ir."productoId", r."depositoId", ir."itemNPId", SUM(ir."cantidad") AS cantidad
  FROM "ItemRemito" ir JOIN "Remito" r ON r."id" = ir."remitoId"
  WHERE r."estado" = 'PICKING' AND r."tipo" IN ('VENTA', 'DESACOPIO')
  GROUP BY 1, 2, 3
),
res AS (
  SELECT "productoId", "depositoId", SUM("cantidad") AS reservado FROM picking GROUP BY 1, 2
),
pend AS (
  SELECT i."productoId", n."depositoId",
         SUM(GREATEST(0, i."cantidad" - i."entregados" - COALESCE(i."devueltos", 0) - COALESCE(p."cantidad", 0))) AS pendiente
  FROM "ItemNP" i
  JOIN "NotaPedido" n ON n."id" = i."notaPedidoId"
  LEFT JOIN picking p ON p."itemNPId" = i."id"
  WHERE n."estado" IN ('PENDIENTE', 'ENTREGADA_PARCIAL')
  GROUP BY 1, 2
),
trans_oc AS (
  SELECT it."productoId", o."depositoDestinoId" AS "depositoId", SUM(GREATEST(0, it."cantidadPedida" - it."cantidadRecibida")) AS cantidad
  FROM "ItemOC" it JOIN "OrdenCompra" o ON o."id" = it."ordenCompraId"
  WHERE o."estado" IN ('CONFIRMADA', 'RECIBIDA_PARCIAL')
  GROUP BY 1, 2
),
pedido_acp AS (
  SELECT o."acopioProveedorId", it."productoId", SUM(it."cantidadPedida") AS pedido
  FROM "ItemOC" it JOIN "OrdenCompra" o ON o."id" = it."ordenCompraId"
  WHERE o."acopioProveedorId" IS NOT NULL AND o."estado" NOT IN ('BORRADOR', 'CANCELADA')
  GROUP BY 1, 2
),
trans_acp AS (
  SELECT ia."productoId", a."depositoDestinoId" AS "depositoId", SUM(GREATEST(0, ia."cantidadPactada" - COALESCE(pa."pedido", 0))) AS cantidad
  FROM "ItemAcopioProveedor" ia
  JOIN "AcopioProveedor" a ON a."id" = ia."acopioProveedorId"
  LEFT JOIN pedido_acp pa ON pa."acopioProveedorId" = a."id" AND pa."productoId" = ia."productoId"
  WHERE a."modalidad" = 'CANTIDAD' AND a."estado" <> 'CANCELADO'
  GROUP BY 1, 2
)
SELECT
  p."id" AS "productoId",
  d."id" AS "depositoId",
  COALESCE(f.fisico, 0) AS fisico,
  COALESCE(pe.pendiente, 0) AS pendiente_entrega,
  COALESCE(r.reservado, 0) AS reservado,
  COALESCE(f.fisico, 0) - COALESCE(pe.pendiente, 0) - COALESCE(r.reservado, 0) AS disponible,
  COALESCE(t1.cantidad, 0) + COALESCE(t2.cantidad, 0) AS en_transito
FROM "Producto" p
CROSS JOIN "Deposito" d
LEFT JOIN fis f ON f."productoId" = p."id" AND f."depositoId" = d."id"
LEFT JOIN pend pe ON pe."productoId" = p."id" AND pe."depositoId" = d."id"
LEFT JOIN res r ON r."productoId" = p."id" AND r."depositoId" = d."id"
LEFT JOIN trans_oc t1 ON t1."productoId" = p."id" AND t1."depositoId" = d."id"
LEFT JOIN trans_acp t2 ON t2."productoId" = p."id" AND t2."depositoId" = d."id";

-- Remitos en picking por depósito (reservado) y NP pendientes por depósito.
CREATE INDEX IF NOT EXISTS "Remito_estado_depositoId_idx" ON "Remito" ("estado", "depositoId");
