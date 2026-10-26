-- Up Migration
-- Marca quando a equipe viu o feedback do cliente (badge de "novo" no painel).
ALTER TABLE batches ADD COLUMN IF NOT EXISTS feedback_read_at timestamptz;

-- Down Migration
ALTER TABLE batches DROP COLUMN IF EXISTS feedback_read_at;
