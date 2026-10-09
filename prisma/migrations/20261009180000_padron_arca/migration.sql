-- Padrón de ARCA: datos de domicilio completos en clientes y proveedores, caché de consultas y ticket WSAA.
ALTER TABLE "Cliente" ADD COLUMN "provincia" TEXT, ADD COLUMN "codigoPostal" TEXT;
ALTER TABLE "Proveedor" ADD COLUMN "localidad" TEXT, ADD COLUMN "provincia" TEXT, ADD COLUMN "codigoPostal" TEXT;

CREATE TABLE "PadronCache" (
    "id" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "datos" JSONB NOT NULL,
    "obtenidoEn" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PadronCache_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PadronCache_cuit_key" ON "PadronCache"("cuit");

CREATE TABLE "ArcaTicket" (
    "servicio" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "sign" TEXT NOT NULL,
    "expira" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ArcaTicket_pkey" PRIMARY KEY ("servicio")
);

-- CUIT de clientes y proveedores: búsqueda de duplicados.
CREATE INDEX IF NOT EXISTS "Cliente_cuit_idx" ON "Cliente"("cuit");
CREATE INDEX IF NOT EXISTS "Proveedor_cuit_idx" ON "Proveedor"("cuit");
