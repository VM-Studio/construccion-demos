-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('DUENO', 'ADMINISTRACION', 'VENTAS', 'DEPOSITO');

-- CreateEnum
CREATE TYPE "Unidad" AS ENUM ('UN', 'BOLSA', 'M3', 'M2', 'ML', 'KG', 'LT', 'PALLET', 'CAJA', 'ROLLO', 'PLACA', 'TN');

-- CreateEnum
CREATE TYPE "CodigoUnidadNegocio" AS ENUM ('FER', 'COR');

-- CreateEnum
CREATE TYPE "EstadoOC" AS ENUM ('BORRADOR', 'ENVIADA', 'CONFIRMADA', 'RECIBIDA_PARCIAL', 'RECIBIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "EstadoCotizacion" AS ENUM ('BORRADOR', 'ENVIADA', 'ACEPTADA', 'RECHAZADA', 'VENCIDA');

-- CreateEnum
CREATE TYPE "EstadoNP" AS ENUM ('BORRADOR', 'PENDIENTE', 'ENTREGADA_PARCIAL', 'ENTREGADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "EstadoAcopio" AS ENUM ('VIGENTE', 'VENCIDO', 'AGOTADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoRemito" AS ENUM ('INICIAL', 'PICKING', 'HECHO', 'ANULADO');

-- CreateEnum
CREATE TYPE "TipoRemito" AS ENUM ('VENTA', 'DESACOPIO', 'DEVOLUCION', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "EstadoDespacho" AS ENUM ('ESPERA', 'PREPARACION', 'FINALIZADO', 'EN_VIAJE', 'ENTREGADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoMovimientoStock" AS ENUM ('INGRESO_COMPRA', 'EGRESO_VENTA', 'EGRESO_ACOPIO', 'TRANSFERENCIA_SALIDA', 'TRANSFERENCIA_ENTRADA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'DEVOLUCION_CLIENTE', 'DEVOLUCION_PROVEEDOR');

-- CreateEnum
CREATE TYPE "TipoComprobante" AS ENUM ('FACTURA', 'NOTA_CREDITO', 'NOTA_DEBITO', 'SALDO_A_FAVOR', 'SALDO_INICIAL');

-- CreateEnum
CREATE TYPE "LetraComprobante" AS ENUM ('A', 'B');

-- CreateEnum
CREATE TYPE "TipoCliente" AS ENUM ('CONSTRUCTORA', 'CORRALON', 'FERRETERIA', 'PARTICULAR', 'ARQUITECTO');

-- CreateEnum
CREATE TYPE "TipoProveedor" AS ENUM ('FABRICANTE', 'DISTRIBUIDOR', 'TRANSPORTISTA', 'SERVICIOS');

-- CreateEnum
CREATE TYPE "CondicionPagoTipo" AS ENUM ('CONTADO', 'CTA_CTE_15', 'CTA_CTE_30', 'CTA_CTE_60', 'ANTICIPO');

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'ECHEQ', 'TARJETA', 'MERCADOPAGO');

-- CreateEnum
CREATE TYPE "CondicionIVA" AS ENUM ('RI', 'MONOTRIBUTO', 'EXENTO', 'CF');

-- CreateEnum
CREATE TYPE "FormaPagoAcopio" AS ENUM ('ANTICIPO', 'CUENTA_CORRIENTE');

-- CreateEnum
CREATE TYPE "FormaPagoVenta" AS ENUM ('CONTADO', 'CUENTA_CORRIENTE', 'ACOPIO');

-- CreateEnum
CREATE TYPE "OrigenVenta" AS ENUM ('NUEVA', 'ACOPIO');

-- CreateEnum
CREATE TYPE "ModalidadEntrega" AS ENUM ('ENVIO', 'RETIRA');

-- CreateEnum
CREATE TYPE "EstadoTransferencia" AS ENUM ('PENDIENTE', 'EN_TRANSITO', 'RECIBIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "EstadoComprobante" AS ENUM ('PENDIENTE', 'PARCIAL', 'PAGADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "EstadoHojaRuta" AS ENUM ('PLANIFICADA', 'EN_CURSO', 'CERRADA');

-- CreateEnum
CREATE TYPE "EstadoCheque" AS ENUM ('EN_CARTERA', 'DEPOSITADO', 'ENTREGADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "TipoCheque" AS ENUM ('CHEQUE', 'ECHEQ');

-- CreateEnum
CREATE TYPE "ReferenciaTipo" AS ENUM ('OC', 'REMITO', 'TRANSFERENCIA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "DiferenciaRecepcion" AS ENUM ('OK', 'FALTANTE', 'ROTURA', 'EXTRA');

-- CreateEnum
CREATE TYPE "CategoriaAdjunto" AS ENUM ('REMITO_FIRMADO', 'FACTURA_PROVEEDOR', 'OTRO');

-- CreateEnum
CREATE TYPE "EntidadAdjunto" AS ENUM ('REMITO', 'ACOPIO', 'ACOPIO_PROVEEDOR', 'NOTA_PEDIDO', 'ORDEN_COMPRA', 'RECEPCION', 'CLIENTE', 'PROVEEDOR', 'COMPROBANTE');

-- CreateEnum
CREATE TYPE "TipoNotaPedido" AS ENUM ('RETIRO_ACOPIO', 'VENTA');

-- CreateEnum
CREATE TYPE "TipoAjusteAcopio" AS ENUM ('TRASPASO_ENTRADA', 'TRASPASO_SALIDA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "ModalidadAcopioProveedor" AS ENUM ('MONTO', 'CANTIDAD');

-- CreateEnum
CREATE TYPE "Moneda" AS ENUM ('ARS', 'USD');

-- CreateEnum
CREATE TYPE "TipoCambioModo" AS ENUM ('AUTO', 'MANUAL');

-- CreateTable
CREATE TABLE "Sucursal" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "depositoId" TEXT NOT NULL,
    "puntoVenta" TEXT NOT NULL,
    "puntoVentaRemito" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sucursal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deposito" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deposito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosicionCarga" (
    "id" TEXT NOT NULL,
    "depositoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosicionCarga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT,
    "email" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "sucursalId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "avatarIniciales" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnidadNegocio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" "CodigoUnidadNegocio" NOT NULL,
    "orden" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnidadNegocio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rubro" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "prefijo" TEXT NOT NULL,
    "unidadNegocioId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rubro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proveedor" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "tipo" "TipoProveedor" NOT NULL,
    "cuit" TEXT NOT NULL,
    "condicionIVA" "CondicionIVA" NOT NULL,
    "circuitoHabitual" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "contacto" TEXT NOT NULL,
    "plazoEntregaDias" INTEGER NOT NULL,
    "condicionPago" "CondicionPagoTipo" NOT NULL,
    "unidadNegocioIds" TEXT[],
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "rubroId" TEXT NOT NULL,
    "unidadNegocioId" TEXT NOT NULL,
    "marca" TEXT,
    "unidad" "Unidad" NOT NULL,
    "unidadesPorPallet" DECIMAL(14,3),
    "proveedorHabitualId" TEXT,
    "costoUltimo" DECIMAL(14,4) NOT NULL,
    "costoPromedio" DECIMAL(14,4) NOT NULL,
    "fechaUltimoCosto" TIMESTAMP(3) NOT NULL,
    "monedaCosto" "Moneda" NOT NULL DEFAULT 'ARS',
    "costoUSD" DECIMAL(14,4),
    "stockMinimo" DECIMAL(14,3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "codigoBarras" TEXT,
    "pesoKg" DECIMAL(14,3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListaPrecios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "markupPorDefecto" DECIMAL(7,2) NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListaPrecios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecioProducto" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "listaPreciosId" TEXT NOT NULL,
    "precio" DECIMAL(14,2) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrecioProducto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockDeposito" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "depositoId" TEXT NOT NULL,
    "cantidadFisica" DECIMAL(14,3) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockDeposito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoStock" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "depositoId" TEXT NOT NULL,
    "tipo" "TipoMovimientoStock" NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "signo" INTEGER NOT NULL,
    "costoUnitario" DECIMAL(14,4) NOT NULL,
    "referenciaTipo" "ReferenciaTipo" NOT NULL,
    "referenciaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "observacion" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MovimientoStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferenciaStock" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "depositoOrigenId" TEXT NOT NULL,
    "depositoDestinoId" TEXT NOT NULL,
    "estado" "EstadoTransferencia" NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "fechaDespacho" TIMESTAMP(3),
    "fechaRecepcion" TIMESTAMP(3),
    "observacion" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferenciaStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemTransferencia" (
    "id" TEXT NOT NULL,
    "transferenciaId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "ItemTransferencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AjusteStock" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "depositoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "observacion" TEXT,
    "forzado" BOOLEAN,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AjusteStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemAjuste" (
    "id" TEXT NOT NULL,
    "ajusteId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "signo" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "costoUnitario" DECIMAL(14,4),

    CONSTRAINT "ItemAjuste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotivoAjuste" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MotivoAjuste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "nombreFantasia" TEXT,
    "tipo" "TipoCliente" NOT NULL,
    "cuit" TEXT NOT NULL,
    "condicionIVA" "CondicionIVA" NOT NULL,
    "circuitoHabitual" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "contacto" TEXT,
    "direccion" TEXT NOT NULL,
    "localidad" TEXT NOT NULL,
    "listaPreciosId" TEXT NOT NULL,
    "condicionPago" "CondicionPagoTipo" NOT NULL,
    "limiteCredito" DECIMAL(14,2) NOT NULL,
    "vendedorId" TEXT,
    "sucursalPreferidaId" TEXT NOT NULL,
    "facturaEnUSD" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Obra" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "localidad" TEXT,
    "contacto" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Obra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CondicionPago" (
    "id" TEXT NOT NULL,
    "codigo" "CondicionPagoTipo" NOT NULL,
    "nombre" TEXT NOT NULL,
    "dias" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CondicionPago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Acopio" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "circuito" INTEGER NOT NULL,
    "clienteId" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "depositoId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "obraIds" TEXT[],
    "fechaCreacion" TIMESTAMP(3) NOT NULL,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "importe" DECIMAL(14,2) NOT NULL,
    "alicuotaIIBBPct" DECIMAL(7,3) NOT NULL,
    "importeConIIBB" DECIMAL(14,2) NOT NULL,
    "formaPago" "FormaPagoAcopio" NOT NULL,
    "listaPreciosBaseId" TEXT NOT NULL,
    "unidadNegocioId" TEXT NOT NULL,
    "comprobanteIds" TEXT[],
    "reciboIds" TEXT[],
    "estado" "EstadoAcopio" NOT NULL,
    "observaciones" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Acopio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecioCongelado" (
    "id" TEXT NOT NULL,
    "acopioId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "productoId" TEXT NOT NULL,
    "precio" DECIMAL(14,2) NOT NULL,
    "costoSnapshot" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "PrecioCongelado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AjusteAcopio" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "circuito" INTEGER NOT NULL,
    "acopioId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "tipo" "TipoAjusteAcopio" NOT NULL,
    "acopioRelacionadoId" TEXT,
    "monto" DECIMAL(14,2) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AjusteAcopio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cotizacion" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "circuito" INTEGER NOT NULL,
    "clienteId" TEXT NOT NULL,
    "obraId" TEXT,
    "sucursalId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "estado" "EstadoCotizacion" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "validezDias" INTEGER NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "descuentoPct" DECIMAL(7,3) NOT NULL,
    "iva" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "observaciones" TEXT,
    "notaPedidoId" TEXT,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "tipoCambioAplicado" DECIMAL(14,4),
    "tipoCambioFecha" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCotizacion" (
    "id" TEXT NOT NULL,
    "cotizacionId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "productoId" TEXT NOT NULL,
    "obraId" TEXT,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "precioUnitario" DECIMAL(14,2) NOT NULL,
    "costoUnitarioSnapshot" DECIMAL(14,4) NOT NULL,
    "descuentoPct" DECIMAL(7,3) NOT NULL,

    CONSTRAINT "ItemCotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaPedido" (
    "id" TEXT NOT NULL,
    "numero" TEXT,
    "circuito" INTEGER NOT NULL,
    "tipo" "TipoNotaPedido" NOT NULL,
    "origen" "OrigenVenta" NOT NULL,
    "acopioId" TEXT,
    "cotizacionId" TEXT,
    "clienteId" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "depositoId" TEXT NOT NULL,
    "vendedorId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "fechaConfirmacion" TIMESTAMP(3),
    "monto" DECIMAL(14,2) NOT NULL,
    "descuentoPct" DECIMAL(7,3) NOT NULL,
    "iva" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "estado" "EstadoNP" NOT NULL,
    "formaPago" "FormaPagoVenta" NOT NULL,
    "condicionPago" "CondicionPagoTipo" NOT NULL,
    "pendienteEntrega" BOOLEAN NOT NULL,
    "modalidadEntrega" "ModalidadEntrega" NOT NULL,
    "direccionEntrega" TEXT,
    "fechaEntregaProgramada" TIMESTAMP(3),
    "remitoIds" TEXT[],
    "comprobanteIds" TEXT[],
    "observaciones" TEXT,
    "forzadoSinDisponible" BOOLEAN,
    "autorizadoSaldoNegativo" BOOLEAN,
    "excepcionCredito" BOOLEAN,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "tipoCambioAplicado" DECIMAL(14,4),
    "tipoCambioFecha" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotaPedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemNP" (
    "id" TEXT NOT NULL,
    "notaPedidoId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "productoId" TEXT NOT NULL,
    "obraId" TEXT,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "entregados" DECIMAL(14,3) NOT NULL,
    "devueltos" DECIMAL(14,3),
    "precioUnitario" DECIMAL(14,2) NOT NULL,
    "costoUnitarioSnapshot" DECIMAL(14,4) NOT NULL,
    "descuentoPct" DECIMAL(7,3),
    "subtotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "ItemNP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevolucionNP" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "circuito" INTEGER NOT NULL,
    "notaPedidoId" TEXT NOT NULL,
    "acopioId" TEXT,
    "clienteId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "remitoDevolucionId" TEXT,
    "notaCreditoId" TEXT,
    "remitosRef" TEXT[],
    "notasCreditoRef" TEXT[],
    "motivo" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevolucionNP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemDP" (
    "id" TEXT NOT NULL,
    "devolucionId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "itemNPId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "obraId" TEXT,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "precioUnitario" DECIMAL(14,2) NOT NULL,
    "subtotal" DECIMAL(14,2),

    CONSTRAINT "ItemDP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Remito" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "circuito" INTEGER NOT NULL,
    "tipo" "TipoRemito" NOT NULL,
    "notaPedidoId" TEXT,
    "acopioId" TEXT,
    "devolucionId" TEXT,
    "transferenciaId" TEXT,
    "clienteId" TEXT,
    "proveedorId" TEXT,
    "obraId" TEXT,
    "sucursalId" TEXT NOT NULL,
    "depositoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "fechaEntrega" TIMESTAMP(3),
    "direccionEntrega" TEXT,
    "cantidadTotal" DECIMAL(14,3) NOT NULL,
    "pesoTotalKg" DECIMAL(14,3) NOT NULL,
    "valorDeclarado" DECIMAL(14,2) NOT NULL,
    "estado" "EstadoRemito" NOT NULL,
    "facturado" BOOLEAN NOT NULL,
    "facturasRef" TEXT[],
    "despachoId" TEXT,
    "firmadoAdjuntoId" TEXT,
    "comentario" TEXT,
    "stockAplicado" BOOLEAN,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Remito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemRemito" (
    "id" TEXT NOT NULL,
    "remitoId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "itemNPId" TEXT,
    "obraId" TEXT,
    "nroSerie" TEXT[],

    CONSTRAINT "ItemRemito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Adjunto" (
    "id" TEXT NOT NULL,
    "entidadTipo" "EntidadAdjunto" NOT NULL,
    "entidadId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tamanoBytes" INTEGER NOT NULL,
    "tipoMime" TEXT NOT NULL,
    "categoria" "CategoriaAdjunto" NOT NULL,
    "subidoPor" TEXT NOT NULL,
    "subidoEn" TIMESTAMP(3) NOT NULL,
    "blobKey" TEXT NOT NULL,
    "url" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Adjunto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehiculo" (
    "id" TEXT NOT NULL,
    "patente" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "capacidadKg" DECIMAL(14,3) NOT NULL,
    "choferId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chofer" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chofer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Despacho" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "depositoId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "notaPedidoId" TEXT,
    "remitoId" TEXT,
    "modalidad" "ModalidadEntrega" NOT NULL,
    "estado" "EstadoDespacho" NOT NULL,
    "posicion" TEXT NOT NULL,
    "fechaProgramada" TIMESTAMP(3) NOT NULL,
    "fechaEspera" TIMESTAMP(3) NOT NULL,
    "fechaInicioPreparacion" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "fechaEntrega" TIMESTAMP(3),
    "vehiculoId" TEXT,
    "choferId" TEXT,
    "operarioId" TEXT,
    "direccionEntrega" TEXT NOT NULL,
    "obraId" TEXT,
    "observaciones" TEXT,
    "reprogramaciones" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Despacho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemDespacho" (
    "id" TEXT NOT NULL,
    "despachoId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "itemNPId" TEXT,

    CONSTRAINT "ItemDespacho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HojaRuta" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "vehiculoId" TEXT NOT NULL,
    "choferId" TEXT NOT NULL,
    "despachoIds" TEXT[],
    "estado" "EstadoHojaRuta" NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HojaRuta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenCompra" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "circuito" INTEGER NOT NULL,
    "origen" "OrigenVenta" NOT NULL,
    "acopioProveedorId" TEXT,
    "proveedorId" TEXT NOT NULL,
    "depositoDestinoId" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "estado" "EstadoOC" NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "fechaEntregaEstimada" TIMESTAMP(3) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "iva" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "observaciones" TEXT,
    "usuarioId" TEXT NOT NULL,
    "reclamos" TEXT[],
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "tipoCambioAplicado" DECIMAL(14,4),
    "tipoCambioFecha" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdenCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemOC" (
    "id" TEXT NOT NULL,
    "ordenCompraId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidadPedida" DECIMAL(14,3) NOT NULL,
    "cantidadRecibida" DECIMAL(14,3) NOT NULL,
    "costoUnitario" DECIMAL(14,4) NOT NULL,
    "descuentoPct" DECIMAL(7,3) NOT NULL,

    CONSTRAINT "ItemOC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecepcionMercaderia" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "ordenCompraId" TEXT NOT NULL,
    "depositoId" TEXT NOT NULL,
    "remitoProveedor" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "observaciones" TEXT,
    "comprobanteId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecepcionMercaderia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemRecepcion" (
    "id" TEXT NOT NULL,
    "recepcionId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "itemOCId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidadRecibida" DECIMAL(14,3) NOT NULL,
    "costoUnitario" DECIMAL(14,4) NOT NULL,
    "diferencia" "DiferenciaRecepcion",
    "observacion" TEXT,

    CONSTRAINT "ItemRecepcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcopioProveedor" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "circuito" INTEGER NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "sucursalId" TEXT NOT NULL,
    "depositoDestinoId" TEXT NOT NULL,
    "fechaCreacion" TIMESTAMP(3) NOT NULL,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "modalidad" "ModalidadAcopioProveedor" NOT NULL,
    "importe" DECIMAL(14,2) NOT NULL,
    "formaPago" "FormaPagoAcopio" NOT NULL,
    "pagado" DECIMAL(14,2) NOT NULL,
    "comprobanteCompraIds" TEXT[],
    "ordenPagoIds" TEXT[],
    "estado" "EstadoAcopio" NOT NULL,
    "observaciones" TEXT,
    "moneda" "Moneda" NOT NULL DEFAULT 'ARS',
    "tipoCambioAplicado" DECIMAL(14,4),
    "tipoCambioFecha" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcopioProveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostoCongelado" (
    "id" TEXT NOT NULL,
    "acopioProveedorId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "productoId" TEXT NOT NULL,
    "costo" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "CostoCongelado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemAcopioProveedor" (
    "id" TEXT NOT NULL,
    "acopioProveedorId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidadPactada" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "ItemAcopioProveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comprobante" (
    "id" TEXT NOT NULL,
    "tipo" "TipoComprobante" NOT NULL,
    "letra" "LetraComprobante",
    "circuito" INTEGER NOT NULL,
    "numero" TEXT NOT NULL,
    "clienteId" TEXT,
    "proveedorId" TEXT,
    "notaPedidoId" TEXT,
    "acopioId" TEXT,
    "acopioProveedorId" TEXT,
    "recepcionId" TEXT,
    "devolucionId" TEXT,
    "comprobanteOrigenId" TEXT,
    "sucursalId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "vencimiento" TIMESTAMP(3),
    "subtotal" DECIMAL(14,2) NOT NULL,
    "iva" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "saldoPendiente" DECIMAL(14,2) NOT NULL,
    "estado" "EstadoComprobante" NOT NULL,
    "observaciones" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comprobante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemComprobante" (
    "id" TEXT NOT NULL,
    "comprobanteId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "productoId" TEXT NOT NULL,
    "obraId" TEXT,
    "cantidad" DECIMAL(14,3) NOT NULL,
    "precioUnitario" DECIMAL(14,2) NOT NULL,
    "costoUnitarioSnapshot" DECIMAL(14,4) NOT NULL,
    "descuentoPct" DECIMAL(7,3) NOT NULL,

    CONSTRAINT "ItemComprobante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImputacionComprobante" (
    "id" TEXT NOT NULL,
    "origenId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "comprobanteId" TEXT NOT NULL,
    "importe" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "ImputacionComprobante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recibo" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "circuito" INTEGER NOT NULL,
    "clienteId" TEXT NOT NULL,
    "sucursalId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "saldoAFavor" DECIMAL(14,2),
    "usuarioId" TEXT NOT NULL,
    "observaciones" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recibo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedioRecibo" (
    "id" TEXT NOT NULL,
    "reciboId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "medio" "MedioPago" NOT NULL,
    "importe" DECIMAL(14,2) NOT NULL,
    "referencia" TEXT,
    "banco" TEXT,
    "numeroCheque" TEXT,
    "fechaCobro" TIMESTAMP(3),
    "chequeId" TEXT,

    CONSTRAINT "MedioRecibo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImputacionRecibo" (
    "id" TEXT NOT NULL,
    "reciboId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "comprobanteId" TEXT NOT NULL,
    "importe" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "ImputacionRecibo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenPago" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "circuito" INTEGER NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "observaciones" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrdenPago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedioOrdenPago" (
    "id" TEXT NOT NULL,
    "ordenPagoId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "medio" "MedioPago" NOT NULL,
    "importe" DECIMAL(14,2) NOT NULL,
    "referencia" TEXT,
    "banco" TEXT,
    "numeroCheque" TEXT,
    "fechaCobro" TIMESTAMP(3),
    "chequeId" TEXT,

    CONSTRAINT "MedioOrdenPago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImputacionOrdenPago" (
    "id" TEXT NOT NULL,
    "ordenPagoId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "comprobanteId" TEXT NOT NULL,
    "importe" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "ImputacionOrdenPago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cheque" (
    "id" TEXT NOT NULL,
    "tipo" "TipoCheque" NOT NULL,
    "banco" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "importe" DECIMAL(14,2) NOT NULL,
    "fechaCobro" TIMESTAMP(3) NOT NULL,
    "clienteId" TEXT NOT NULL,
    "cobranzaId" TEXT NOT NULL,
    "estado" "EstadoCheque" NOT NULL,
    "proveedorId" TEXT,
    "pagoProveedorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cheque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracion" (
    "id" TEXT NOT NULL DEFAULT 'config',
    "ivaPct" DECIMAL(7,2) NOT NULL,
    "validezPresupuestoDias" INTEGER NOT NULL,
    "diasVencimientoAcopio" INTEGER NOT NULL,
    "alicuotaIIBBPct" DECIMAL(7,3) NOT NULL,
    "alertaStockMinimo" BOOLEAN NOT NULL,
    "umbralSubaCostoPct" DECIMAL(7,2) NOT NULL,
    "tipoCambioUSD" DECIMAL(14,4),
    "tipoCambioModo" "TipoCambioModo" NOT NULL DEFAULT 'AUTO',
    "tipoCambioManual" DECIMAL(14,4),
    "tamanoMaxAdjuntoMB" INTEGER NOT NULL,
    "categoriasAdjunto" JSONB NOT NULL,
    "empresa" JSONB NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contador" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CotizacionUSD" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "divisaCompra" DECIMAL(14,4) NOT NULL,
    "divisaVenta" DECIMAL(14,4) NOT NULL,
    "billeteCompra" DECIMAL(14,4),
    "billeteVenta" DECIMAL(14,4),
    "fuente" TEXT NOT NULL,
    "obtenidoEn" TIMESTAMP(3) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CotizacionUSD_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cambio" (
    "id" BIGSERIAL NOT NULL,
    "tipos" TEXT[],
    "entidadIds" TEXT[],
    "usuarioId" TEXT,
    "resumen" TEXT,
    "href" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cambio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,
    "efectos" JSONB,
    "accionId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Deposito_sucursalId_idx" ON "Deposito"("sucursalId");

-- CreateIndex
CREATE INDEX "PosicionCarga_depositoId_idx" ON "PosicionCarga"("depositoId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_sucursalId_idx" ON "Usuario"("sucursalId");

-- CreateIndex
CREATE UNIQUE INDEX "UnidadNegocio_codigo_key" ON "UnidadNegocio"("codigo");

-- CreateIndex
CREATE INDEX "Rubro_unidadNegocioId_idx" ON "Rubro"("unidadNegocioId");

-- CreateIndex
CREATE UNIQUE INDEX "Proveedor_codigo_key" ON "Proveedor"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigo_key" ON "Producto"("codigo");

-- CreateIndex
CREATE INDEX "Producto_rubroId_idx" ON "Producto"("rubroId");

-- CreateIndex
CREATE INDEX "Producto_unidadNegocioId_idx" ON "Producto"("unidadNegocioId");

-- CreateIndex
CREATE INDEX "Producto_proveedorHabitualId_idx" ON "Producto"("proveedorHabitualId");

-- CreateIndex
CREATE INDEX "PrecioProducto_listaPreciosId_idx" ON "PrecioProducto"("listaPreciosId");

-- CreateIndex
CREATE UNIQUE INDEX "PrecioProducto_productoId_listaPreciosId_key" ON "PrecioProducto"("productoId", "listaPreciosId");

-- CreateIndex
CREATE INDEX "StockDeposito_depositoId_idx" ON "StockDeposito"("depositoId");

-- CreateIndex
CREATE UNIQUE INDEX "StockDeposito_productoId_depositoId_key" ON "StockDeposito"("productoId", "depositoId");

-- CreateIndex
CREATE INDEX "MovimientoStock_productoId_depositoId_idx" ON "MovimientoStock"("productoId", "depositoId");

-- CreateIndex
CREATE INDEX "MovimientoStock_fecha_idx" ON "MovimientoStock"("fecha");

-- CreateIndex
CREATE INDEX "MovimientoStock_referenciaId_idx" ON "MovimientoStock"("referenciaId");

-- CreateIndex
CREATE UNIQUE INDEX "TransferenciaStock_numero_key" ON "TransferenciaStock"("numero");

-- CreateIndex
CREATE INDEX "TransferenciaStock_estado_idx" ON "TransferenciaStock"("estado");

-- CreateIndex
CREATE INDEX "TransferenciaStock_fecha_idx" ON "TransferenciaStock"("fecha");

-- CreateIndex
CREATE INDEX "ItemTransferencia_transferenciaId_idx" ON "ItemTransferencia"("transferenciaId");

-- CreateIndex
CREATE UNIQUE INDEX "AjusteStock_numero_key" ON "AjusteStock"("numero");

-- CreateIndex
CREATE INDEX "AjusteStock_fecha_idx" ON "AjusteStock"("fecha");

-- CreateIndex
CREATE INDEX "ItemAjuste_ajusteId_idx" ON "ItemAjuste"("ajusteId");

-- CreateIndex
CREATE UNIQUE INDEX "MotivoAjuste_codigo_key" ON "MotivoAjuste"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_codigo_key" ON "Cliente"("codigo");

-- CreateIndex
CREATE INDEX "Cliente_sucursalPreferidaId_idx" ON "Cliente"("sucursalPreferidaId");

-- CreateIndex
CREATE INDEX "Obra_clienteId_idx" ON "Obra"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "CondicionPago_codigo_key" ON "CondicionPago"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Acopio_numero_key" ON "Acopio"("numero");

-- CreateIndex
CREATE INDEX "Acopio_clienteId_idx" ON "Acopio"("clienteId");

-- CreateIndex
CREATE INDEX "Acopio_estado_idx" ON "Acopio"("estado");

-- CreateIndex
CREATE INDEX "Acopio_sucursalId_idx" ON "Acopio"("sucursalId");

-- CreateIndex
CREATE INDEX "Acopio_unidadNegocioId_idx" ON "Acopio"("unidadNegocioId");

-- CreateIndex
CREATE INDEX "PrecioCongelado_acopioId_idx" ON "PrecioCongelado"("acopioId");

-- CreateIndex
CREATE UNIQUE INDEX "AjusteAcopio_numero_key" ON "AjusteAcopio"("numero");

-- CreateIndex
CREATE INDEX "AjusteAcopio_acopioId_idx" ON "AjusteAcopio"("acopioId");

-- CreateIndex
CREATE INDEX "AjusteAcopio_fecha_idx" ON "AjusteAcopio"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Cotizacion_numero_key" ON "Cotizacion"("numero");

-- CreateIndex
CREATE INDEX "Cotizacion_clienteId_idx" ON "Cotizacion"("clienteId");

-- CreateIndex
CREATE INDEX "Cotizacion_estado_idx" ON "Cotizacion"("estado");

-- CreateIndex
CREATE INDEX "Cotizacion_fecha_idx" ON "Cotizacion"("fecha");

-- CreateIndex
CREATE INDEX "Cotizacion_sucursalId_idx" ON "Cotizacion"("sucursalId");

-- CreateIndex
CREATE INDEX "ItemCotizacion_cotizacionId_idx" ON "ItemCotizacion"("cotizacionId");

-- CreateIndex
CREATE UNIQUE INDEX "NotaPedido_numero_key" ON "NotaPedido"("numero");

-- CreateIndex
CREATE INDEX "NotaPedido_clienteId_idx" ON "NotaPedido"("clienteId");

-- CreateIndex
CREATE INDEX "NotaPedido_acopioId_idx" ON "NotaPedido"("acopioId");

-- CreateIndex
CREATE INDEX "NotaPedido_estado_idx" ON "NotaPedido"("estado");

-- CreateIndex
CREATE INDEX "NotaPedido_fecha_idx" ON "NotaPedido"("fecha");

-- CreateIndex
CREATE INDEX "NotaPedido_sucursalId_idx" ON "NotaPedido"("sucursalId");

-- CreateIndex
CREATE INDEX "NotaPedido_depositoId_idx" ON "NotaPedido"("depositoId");

-- CreateIndex
CREATE INDEX "ItemNP_notaPedidoId_idx" ON "ItemNP"("notaPedidoId");

-- CreateIndex
CREATE INDEX "ItemNP_productoId_idx" ON "ItemNP"("productoId");

-- CreateIndex
CREATE UNIQUE INDEX "DevolucionNP_numero_key" ON "DevolucionNP"("numero");

-- CreateIndex
CREATE INDEX "DevolucionNP_notaPedidoId_idx" ON "DevolucionNP"("notaPedidoId");

-- CreateIndex
CREATE INDEX "DevolucionNP_acopioId_idx" ON "DevolucionNP"("acopioId");

-- CreateIndex
CREATE INDEX "DevolucionNP_clienteId_idx" ON "DevolucionNP"("clienteId");

-- CreateIndex
CREATE INDEX "DevolucionNP_fecha_idx" ON "DevolucionNP"("fecha");

-- CreateIndex
CREATE INDEX "ItemDP_devolucionId_idx" ON "ItemDP"("devolucionId");

-- CreateIndex
CREATE UNIQUE INDEX "Remito_numero_key" ON "Remito"("numero");

-- CreateIndex
CREATE INDEX "Remito_notaPedidoId_idx" ON "Remito"("notaPedidoId");

-- CreateIndex
CREATE INDEX "Remito_acopioId_idx" ON "Remito"("acopioId");

-- CreateIndex
CREATE INDEX "Remito_clienteId_idx" ON "Remito"("clienteId");

-- CreateIndex
CREATE INDEX "Remito_estado_idx" ON "Remito"("estado");

-- CreateIndex
CREATE INDEX "Remito_fecha_idx" ON "Remito"("fecha");

-- CreateIndex
CREATE INDEX "Remito_sucursalId_idx" ON "Remito"("sucursalId");

-- CreateIndex
CREATE INDEX "ItemRemito_remitoId_idx" ON "ItemRemito"("remitoId");

-- CreateIndex
CREATE INDEX "ItemRemito_productoId_idx" ON "ItemRemito"("productoId");

-- CreateIndex
CREATE INDEX "Adjunto_entidadTipo_entidadId_idx" ON "Adjunto"("entidadTipo", "entidadId");

-- CreateIndex
CREATE UNIQUE INDEX "Despacho_numero_key" ON "Despacho"("numero");

-- CreateIndex
CREATE INDEX "Despacho_clienteId_idx" ON "Despacho"("clienteId");

-- CreateIndex
CREATE INDEX "Despacho_notaPedidoId_idx" ON "Despacho"("notaPedidoId");

-- CreateIndex
CREATE INDEX "Despacho_estado_idx" ON "Despacho"("estado");

-- CreateIndex
CREATE INDEX "Despacho_fechaProgramada_idx" ON "Despacho"("fechaProgramada");

-- CreateIndex
CREATE INDEX "Despacho_sucursalId_idx" ON "Despacho"("sucursalId");

-- CreateIndex
CREATE INDEX "ItemDespacho_despachoId_idx" ON "ItemDespacho"("despachoId");

-- CreateIndex
CREATE INDEX "HojaRuta_fecha_idx" ON "HojaRuta"("fecha");

-- CreateIndex
CREATE INDEX "HojaRuta_estado_idx" ON "HojaRuta"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenCompra_numero_key" ON "OrdenCompra"("numero");

-- CreateIndex
CREATE INDEX "OrdenCompra_proveedorId_idx" ON "OrdenCompra"("proveedorId");

-- CreateIndex
CREATE INDEX "OrdenCompra_acopioProveedorId_idx" ON "OrdenCompra"("acopioProveedorId");

-- CreateIndex
CREATE INDEX "OrdenCompra_estado_idx" ON "OrdenCompra"("estado");

-- CreateIndex
CREATE INDEX "OrdenCompra_fechaEmision_idx" ON "OrdenCompra"("fechaEmision");

-- CreateIndex
CREATE INDEX "OrdenCompra_sucursalId_idx" ON "OrdenCompra"("sucursalId");

-- CreateIndex
CREATE INDEX "ItemOC_ordenCompraId_idx" ON "ItemOC"("ordenCompraId");

-- CreateIndex
CREATE INDEX "ItemOC_productoId_idx" ON "ItemOC"("productoId");

-- CreateIndex
CREATE UNIQUE INDEX "RecepcionMercaderia_numero_key" ON "RecepcionMercaderia"("numero");

-- CreateIndex
CREATE INDEX "RecepcionMercaderia_ordenCompraId_idx" ON "RecepcionMercaderia"("ordenCompraId");

-- CreateIndex
CREATE INDEX "RecepcionMercaderia_fecha_idx" ON "RecepcionMercaderia"("fecha");

-- CreateIndex
CREATE INDEX "ItemRecepcion_recepcionId_idx" ON "ItemRecepcion"("recepcionId");

-- CreateIndex
CREATE UNIQUE INDEX "AcopioProveedor_numero_key" ON "AcopioProveedor"("numero");

-- CreateIndex
CREATE INDEX "AcopioProveedor_proveedorId_idx" ON "AcopioProveedor"("proveedorId");

-- CreateIndex
CREATE INDEX "AcopioProveedor_estado_idx" ON "AcopioProveedor"("estado");

-- CreateIndex
CREATE INDEX "AcopioProveedor_sucursalId_idx" ON "AcopioProveedor"("sucursalId");

-- CreateIndex
CREATE INDEX "CostoCongelado_acopioProveedorId_idx" ON "CostoCongelado"("acopioProveedorId");

-- CreateIndex
CREATE INDEX "ItemAcopioProveedor_acopioProveedorId_idx" ON "ItemAcopioProveedor"("acopioProveedorId");

-- CreateIndex
CREATE UNIQUE INDEX "Comprobante_numero_key" ON "Comprobante"("numero");

-- CreateIndex
CREATE INDEX "Comprobante_clienteId_idx" ON "Comprobante"("clienteId");

-- CreateIndex
CREATE INDEX "Comprobante_proveedorId_idx" ON "Comprobante"("proveedorId");

-- CreateIndex
CREATE INDEX "Comprobante_notaPedidoId_idx" ON "Comprobante"("notaPedidoId");

-- CreateIndex
CREATE INDEX "Comprobante_acopioId_idx" ON "Comprobante"("acopioId");

-- CreateIndex
CREATE INDEX "Comprobante_estado_idx" ON "Comprobante"("estado");

-- CreateIndex
CREATE INDEX "Comprobante_fecha_idx" ON "Comprobante"("fecha");

-- CreateIndex
CREATE INDEX "Comprobante_sucursalId_idx" ON "Comprobante"("sucursalId");

-- CreateIndex
CREATE INDEX "ItemComprobante_comprobanteId_idx" ON "ItemComprobante"("comprobanteId");

-- CreateIndex
CREATE INDEX "ImputacionComprobante_origenId_idx" ON "ImputacionComprobante"("origenId");

-- CreateIndex
CREATE INDEX "ImputacionComprobante_comprobanteId_idx" ON "ImputacionComprobante"("comprobanteId");

-- CreateIndex
CREATE UNIQUE INDEX "Recibo_numero_key" ON "Recibo"("numero");

-- CreateIndex
CREATE INDEX "Recibo_clienteId_idx" ON "Recibo"("clienteId");

-- CreateIndex
CREATE INDEX "Recibo_fecha_idx" ON "Recibo"("fecha");

-- CreateIndex
CREATE INDEX "Recibo_sucursalId_idx" ON "Recibo"("sucursalId");

-- CreateIndex
CREATE INDEX "MedioRecibo_reciboId_idx" ON "MedioRecibo"("reciboId");

-- CreateIndex
CREATE INDEX "ImputacionRecibo_reciboId_idx" ON "ImputacionRecibo"("reciboId");

-- CreateIndex
CREATE INDEX "ImputacionRecibo_comprobanteId_idx" ON "ImputacionRecibo"("comprobanteId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenPago_numero_key" ON "OrdenPago"("numero");

-- CreateIndex
CREATE INDEX "OrdenPago_proveedorId_idx" ON "OrdenPago"("proveedorId");

-- CreateIndex
CREATE INDEX "OrdenPago_fecha_idx" ON "OrdenPago"("fecha");

-- CreateIndex
CREATE INDEX "MedioOrdenPago_ordenPagoId_idx" ON "MedioOrdenPago"("ordenPagoId");

-- CreateIndex
CREATE INDEX "ImputacionOrdenPago_ordenPagoId_idx" ON "ImputacionOrdenPago"("ordenPagoId");

-- CreateIndex
CREATE INDEX "ImputacionOrdenPago_comprobanteId_idx" ON "ImputacionOrdenPago"("comprobanteId");

-- CreateIndex
CREATE INDEX "Cheque_clienteId_idx" ON "Cheque"("clienteId");

-- CreateIndex
CREATE INDEX "Cheque_proveedorId_idx" ON "Cheque"("proveedorId");

-- CreateIndex
CREATE INDEX "Cheque_estado_idx" ON "Cheque"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "Contador_tipo_key" ON "Contador"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "CotizacionUSD_fecha_key" ON "CotizacionUSD"("fecha");

-- CreateIndex
CREATE INDEX "Auditoria_fecha_idx" ON "Auditoria"("fecha");

-- CreateIndex
CREATE INDEX "Auditoria_entidadId_idx" ON "Auditoria"("entidadId");

-- CreateIndex
CREATE INDEX "Auditoria_usuarioId_idx" ON "Auditoria"("usuarioId");

-- AddForeignKey
ALTER TABLE "PosicionCarga" ADD CONSTRAINT "PosicionCarga_depositoId_fkey" FOREIGN KEY ("depositoId") REFERENCES "Deposito"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemTransferencia" ADD CONSTRAINT "ItemTransferencia_transferenciaId_fkey" FOREIGN KEY ("transferenciaId") REFERENCES "TransferenciaStock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAjuste" ADD CONSTRAINT "ItemAjuste_ajusteId_fkey" FOREIGN KEY ("ajusteId") REFERENCES "AjusteStock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecioCongelado" ADD CONSTRAINT "PrecioCongelado_acopioId_fkey" FOREIGN KEY ("acopioId") REFERENCES "Acopio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCotizacion" ADD CONSTRAINT "ItemCotizacion_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemNP" ADD CONSTRAINT "ItemNP_notaPedidoId_fkey" FOREIGN KEY ("notaPedidoId") REFERENCES "NotaPedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemDP" ADD CONSTRAINT "ItemDP_devolucionId_fkey" FOREIGN KEY ("devolucionId") REFERENCES "DevolucionNP"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemRemito" ADD CONSTRAINT "ItemRemito_remitoId_fkey" FOREIGN KEY ("remitoId") REFERENCES "Remito"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemDespacho" ADD CONSTRAINT "ItemDespacho_despachoId_fkey" FOREIGN KEY ("despachoId") REFERENCES "Despacho"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemOC" ADD CONSTRAINT "ItemOC_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "OrdenCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemRecepcion" ADD CONSTRAINT "ItemRecepcion_recepcionId_fkey" FOREIGN KEY ("recepcionId") REFERENCES "RecepcionMercaderia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostoCongelado" ADD CONSTRAINT "CostoCongelado_acopioProveedorId_fkey" FOREIGN KEY ("acopioProveedorId") REFERENCES "AcopioProveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAcopioProveedor" ADD CONSTRAINT "ItemAcopioProveedor_acopioProveedorId_fkey" FOREIGN KEY ("acopioProveedorId") REFERENCES "AcopioProveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemComprobante" ADD CONSTRAINT "ItemComprobante_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "Comprobante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImputacionComprobante" ADD CONSTRAINT "ImputacionComprobante_origenId_fkey" FOREIGN KEY ("origenId") REFERENCES "Comprobante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedioRecibo" ADD CONSTRAINT "MedioRecibo_reciboId_fkey" FOREIGN KEY ("reciboId") REFERENCES "Recibo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImputacionRecibo" ADD CONSTRAINT "ImputacionRecibo_reciboId_fkey" FOREIGN KEY ("reciboId") REFERENCES "Recibo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedioOrdenPago" ADD CONSTRAINT "MedioOrdenPago_ordenPagoId_fkey" FOREIGN KEY ("ordenPagoId") REFERENCES "OrdenPago"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImputacionOrdenPago" ADD CONSTRAINT "ImputacionOrdenPago_ordenPagoId_fkey" FOREIGN KEY ("ordenPagoId") REFERENCES "OrdenPago"("id") ON DELETE CASCADE ON UPDATE CASCADE;
