-- Up Migration
-- Alertas do painel (cliente aprovou / recusou): "dispensar" é separado do "visto" da fila de Recusas.
ALTER TABLE events ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;
CREATE INDEX IF NOT EXISTS events_alert_idx ON events (kind) WHERE dismissed_at IS NULL;
-- O que já existia não vira alerta retroativo: só recusas ainda não vistas em Recusas ficam ativas.
UPDATE events SET dismissed_at = now()
 WHERE kind IN ('batch_submitted', 'creative_rejected') AND dismissed_at IS NULL
   AND (kind = 'batch_submitted' OR read_at IS NOT NULL);

-- Down Migration
DROP INDEX IF EXISTS events_alert_idx;
ALTER TABLE events DROP COLUMN IF EXISTS dismissed_at;
