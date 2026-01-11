-- Migración para simplificar estados de oportunidades y tipos de actividades
-- Ejecutar en Supabase SQL Editor

-- 1. Migrar estados de oportunidades existentes a los nuevos estados simplificados
UPDATE opportunities 
SET status = CASE 
  WHEN status = 'QUALIFYING' THEN 'IN_PROGRESS'
  WHEN status = 'PROPOSAL' THEN 'IN_PROGRESS'
  WHEN status = 'ON_HOLD' THEN 'IN_PROGRESS'
  ELSE status
END
WHERE status IN ('QUALIFYING', 'PROPOSAL', 'ON_HOLD');

-- 2. Migrar tipos de actividades existentes
UPDATE activities 
SET type = CASE 
  WHEN type = 'AGREEMENT' THEN 'NOTE'
  ELSE type
END
WHERE type = 'AGREEMENT';

-- 3. Nota: Los enums en PostgreSQL no se pueden modificar directamente
-- Necesitamos recrear las tablas o usar ALTER TYPE (más complejo)
-- Por ahora, los datos están migrados y el código usará los nuevos valores


