-- Up Migration
-- Arquivar lote: some do Kanban e das listas, mas fica no banco (artes, respostas, feedback, histórico).
ALTER TABLE batches ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS batches_archived_idx ON batches (archived_at) WHERE archived_at IS NOT NULL;

-- Down Migration
DROP INDEX IF EXISTS batches_archived_idx;
ALTER TABLE batches DROP COLUMN IF EXISTS archived_at;
