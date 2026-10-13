-- Tipos de cliente nuevos (aditivo: los valores anteriores quedan para clientes ya cargados)
ALTER TYPE "TipoCliente" ADD VALUE IF NOT EXISTS 'MAYORISTA';
ALTER TYPE "TipoCliente" ADD VALUE IF NOT EXISTS 'MELI';
ALTER TYPE "TipoCliente" ADD VALUE IF NOT EXISTS 'MADERERA';
