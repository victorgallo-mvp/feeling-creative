-- Up Migration
-- Feedback obrigatório do cliente ao enviar a aprovação: nota de 1 a 5 e uma frase.
ALTER TABLE batches ADD COLUMN IF NOT EXISTS feedback_rating smallint CHECK (feedback_rating BETWEEN 1 AND 5);
ALTER TABLE batches ADD COLUMN IF NOT EXISTS feedback_comment text;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS feedback_at timestamptz;

-- Down Migration
ALTER TABLE batches DROP COLUMN IF EXISTS feedback_at;
ALTER TABLE batches DROP COLUMN IF EXISTS feedback_comment;
ALTER TABLE batches DROP COLUMN IF EXISTS feedback_rating;
