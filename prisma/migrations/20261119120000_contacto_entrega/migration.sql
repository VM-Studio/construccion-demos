-- Contacto para la entrega (persona / teléfono) en notas de pedido y remitos. Solo agrega columnas opcionales.
ALTER TABLE "NotaPedido" ADD COLUMN "contactoEntrega" TEXT;
ALTER TABLE "Remito" ADD COLUMN "contactoEntrega" TEXT;
