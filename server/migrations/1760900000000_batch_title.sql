-- Up Migration
-- Permite mais de um lote por cliente no mesmo mês (ex.: "Outubro — Lote 2", "Campanha Black Friday").
ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_client_id_month_year_key;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS title text;
CREATE INDEX IF NOT EXISTS batches_client_month_idx ON batches (client_id, year, month);

-- Down Migration
DROP INDEX IF EXISTS batches_client_month_idx;
ALTER TABLE batches DROP COLUMN IF EXISTS title;
