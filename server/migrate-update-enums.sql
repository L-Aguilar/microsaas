-- Migración para actualizar los enums en PostgreSQL
-- Esto agrega los nuevos valores y mantiene compatibilidad con los antiguos

-- 1. Agregar IN_PROGRESS al enum opportunity_status (si no existe)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'IN_PROGRESS' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'opportunity_status')
  ) THEN
    ALTER TYPE opportunity_status ADD VALUE 'IN_PROGRESS';
  END IF;
END $$;

-- 2. Los valores antiguos (QUALIFYING, PROPOSAL, ON_HOLD) se mantienen en el enum
-- pero ya no se usarán en el código. Los datos ya fueron migrados a IN_PROGRESS.

-- 3. El enum activity_type ya tiene los valores correctos (CALL, MEETING, NOTE)
-- AGREEMENT se mantiene en el enum pero ya no se usa. Los datos ya fueron migrados a NOTE.

-- Nota: No podemos eliminar valores de un enum en PostgreSQL sin recrear el tipo,
-- pero esto no es un problema ya que los datos ya fueron migrados y el código
-- solo usará los nuevos valores.


