-- Tipo de cambio en OC / recepciones en USD
ALTER TABLE "ItemOC" ADD COLUMN "costoUSD" DECIMAL(14,4);
ALTER TABLE "ItemRecepcion" ADD COLUMN "costoUSD" DECIMAL(14,4);
ALTER TABLE "RecepcionMercaderia" ADD COLUMN "tipoCambioAplicado" DECIMAL(14,4),
ADD COLUMN "tipoCambioFecha" TIMESTAMP(3);
