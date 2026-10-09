-- Autenticación real (R2). Los usuarios provisorios sin contraseña (login de prueba de R1 o
-- datos de ejemplo) se eliminan: el primer dueño se registra con email y contraseña.
DELETE FROM "Usuario";

ALTER TABLE "Usuario"
  ADD COLUMN "passwordHash" TEXT NOT NULL,
  ADD COLUMN "debeCambiarPassword" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ultimoAcceso" TIMESTAMP(3),
  ADD COLUMN "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bloqueadoHasta" TIMESTAMP(3),
  ADD COLUMN "sesionVersion" INTEGER NOT NULL DEFAULT 0;

-- Emails en minúscula: el login compara sin distinguir mayúsculas.
CREATE UNIQUE INDEX IF NOT EXISTS "Usuario_email_lower_key" ON "Usuario" (lower("email"));
