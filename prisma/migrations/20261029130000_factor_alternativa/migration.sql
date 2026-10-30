-- Más decimales para el factor (ej. hierro con stock en toneladas: 1 barra = 0,00266667 TN).
ALTER TABLE "Producto" ALTER COLUMN "factorAlternativa" TYPE DECIMAL(16,8);
