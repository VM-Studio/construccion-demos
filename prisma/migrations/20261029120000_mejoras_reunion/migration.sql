-- Mejoras pedidas en la reunión con los dueños (2026-10-28). Todo aditivo salvo Cliente.tipo (enum → texto).

-- Cotizaciones: estado PENDIENTE, cotización rápida (sin cliente), respuesta.
ALTER TYPE "EstadoCotizacion" ADD VALUE IF NOT EXISTS 'PENDIENTE';
ALTER TABLE "Cotizacion" ALTER COLUMN "clienteId" DROP NOT NULL;
ALTER TABLE "Cotizacion" ADD COLUMN "prospectoNombre" TEXT;
ALTER TABLE "Cotizacion" ADD COLUMN "prospectoTelefono" TEXT;
ALTER TABLE "Cotizacion" ADD COLUMN "tipoCliente" TEXT;
ALTER TABLE "Cotizacion" ADD COLUMN "motivoRechazo" TEXT;
ALTER TABLE "Cotizacion" ADD COLUMN "fechaRespuesta" TIMESTAMP(3);

-- Medio de pago: comisión retenida (Mercado Libre / Mercado Pago).
ALTER TYPE "MedioPago" ADD VALUE IF NOT EXISTS 'COMISION';

-- Tipos de cliente editables: la columna pasa a texto y la lista vive en Configuracion.
ALTER TABLE "Cliente" ALTER COLUMN "tipo" TYPE TEXT USING "tipo"::text;
DROP TYPE IF EXISTS "TipoCliente";
ALTER TABLE "Configuracion" ADD COLUMN "tiposCliente" JSONB NOT NULL DEFAULT '[]';
UPDATE "Configuracion" SET "tiposCliente" = '[{"codigo": "MAYORISTA", "nombre": "Mayorista", "activo": true}, {"codigo": "FERRETERIA", "nombre": "Ferretería", "activo": true}, {"codigo": "CORRALON", "nombre": "Corralón", "activo": true}, {"codigo": "CONSTRUCTORA", "nombre": "Constructora", "activo": true}, {"codigo": "CONSUMIDOR_FINAL", "nombre": "Consumidor final", "activo": true}, {"codigo": "MELI", "nombre": "Mercado Libre", "activo": true}, {"codigo": "MADERERA", "nombre": "Maderera", "activo": true}, {"codigo": "PARTICULAR", "nombre": "Particular", "activo": false}, {"codigo": "ARQUITECTO", "nombre": "Arquitecto", "activo": false}]'::jsonb;

-- Unidad alternativa (hierro: barras ↔ toneladas).
ALTER TABLE "Producto" ADD COLUMN "unidadAlternativa" "Unidad";
ALTER TABLE "Producto" ADD COLUMN "factorAlternativa" DECIMAL(14,4);
ALTER TABLE "ItemCotizacion" ADD COLUMN "unidadVenta" "Unidad";
ALTER TABLE "ItemNP" ADD COLUMN "unidadVenta" "Unidad";
ALTER TABLE "ItemComprobante" ADD COLUMN "unidadVenta" "Unidad";

-- Listas de precios especiales por cliente.
ALTER TABLE "ListaPrecios" ADD COLUMN "clienteId" TEXT;
ALTER TABLE "ListaPrecios" ADD COLUMN "listaBaseId" TEXT;
ALTER TABLE "ListaPrecios" ADD COLUMN "ajustePct" DECIMAL(7,2);
ALTER TABLE "ListaPrecios" ADD COLUMN "reglasRubro" JSONB;
CREATE INDEX "ListaPrecios_clienteId_idx" ON "ListaPrecios"("clienteId");

-- Anulación de ventas.
ALTER TABLE "NotaPedido" ADD COLUMN "motivoAnulacion" TEXT;
ALTER TABLE "NotaPedido" ADD COLUMN "anuladaEn" TIMESTAMP(3);

-- Comprobantes: anulación, factura electrónica (ARCA) y Mercado Libre.
ALTER TABLE "Comprobante" ADD COLUMN "motivoAnulacion" TEXT;
ALTER TABLE "Comprobante" ADD COLUMN "arcaEstado" TEXT;
ALTER TABLE "Comprobante" ADD COLUMN "cae" TEXT;
ALTER TABLE "Comprobante" ADD COLUMN "caeVencimiento" TIMESTAMP(3);
ALTER TABLE "Comprobante" ADD COLUMN "arcaPuntoVenta" INTEGER;
ALTER TABLE "Comprobante" ADD COLUMN "arcaNumero" INTEGER;
ALTER TABLE "Comprobante" ADD COLUMN "arcaTipo" INTEGER;
ALTER TABLE "Comprobante" ADD COLUMN "arcaError" TEXT;
ALTER TABLE "Comprobante" ADD COLUMN "ventaML" TEXT;
ALTER TABLE "Comprobante" ADD COLUMN "compradorNombre" TEXT;
ALTER TABLE "Comprobante" ADD COLUMN "compradorDoc" TEXT;

-- Efectivo en dólares y caja en los medios de recibos y órdenes de pago.
ALTER TABLE "MedioRecibo" ADD COLUMN "moneda" "Moneda";
ALTER TABLE "MedioRecibo" ADD COLUMN "importeME" DECIMAL(14,2);
ALTER TABLE "MedioRecibo" ADD COLUMN "tipoCambio" DECIMAL(14,4);
ALTER TABLE "MedioRecibo" ADD COLUMN "cajaId" TEXT;
ALTER TABLE "MedioOrdenPago" ADD COLUMN "moneda" "Moneda";
ALTER TABLE "MedioOrdenPago" ADD COLUMN "importeME" DECIMAL(14,2);
ALTER TABLE "MedioOrdenPago" ADD COLUMN "tipoCambio" DECIMAL(14,4);
ALTER TABLE "MedioOrdenPago" ADD COLUMN "cajaId" TEXT;

-- Caja chica.
CREATE TABLE "Caja" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "sucursalId" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Caja_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MovimientoCaja" (
    "id" TEXT NOT NULL,
    "cajaId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "tipo" TEXT NOT NULL,
    "signo" INTEGER NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "importe" DECIMAL(14,2) NOT NULL,
    "concepto" TEXT NOT NULL,
    "categoria" TEXT,
    "referenciaTipo" TEXT,
    "referenciaId" TEXT,
    "cajaRelacionadaId" TEXT,
    "grupoId" TEXT,
    "usuarioId" TEXT NOT NULL,
    "anulado" BOOLEAN NOT NULL DEFAULT false,
    "motivoAnulacion" TEXT,
    "observaciones" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MovimientoCaja_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MovimientoCaja_cajaId_idx" ON "MovimientoCaja"("cajaId");
CREATE INDEX "MovimientoCaja_fecha_idx" ON "MovimientoCaja"("fecha");
CREATE INDEX "MovimientoCaja_referenciaId_idx" ON "MovimientoCaja"("referenciaId");

CREATE TABLE "ArqueoCaja" (
    "id" TEXT NOT NULL,
    "cajaId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "saldoSistema" DECIMAL(14,2) NOT NULL,
    "contado" DECIMAL(14,2) NOT NULL,
    "diferencia" DECIMAL(14,2) NOT NULL,
    "billetes" JSONB,
    "usuarioId" TEXT NOT NULL,
    "observaciones" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ArqueoCaja_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ArqueoCaja_cajaId_idx" ON "ArqueoCaja"("cajaId");

-- Caja inicial (se pueden crear todas las que se quieran desde Caja chica).
INSERT INTO "Caja" ("id", "nombre", "descripcion", "activa", "orden", "actualizadoEn") VALUES ('caja_principal', 'Caja chica', 'Efectivo del mostrador', true, 0, now()) ON CONFLICT ("id") DO NOTHING;
