-- Anular recibos y órdenes de pago (aditivo: columnas con default / nullable)
ALTER TABLE "Recibo" ADD COLUMN "anulado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Recibo" ADD COLUMN "motivoAnulacion" TEXT;
ALTER TABLE "OrdenPago" ADD COLUMN "anulado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrdenPago" ADD COLUMN "motivoAnulacion" TEXT;
