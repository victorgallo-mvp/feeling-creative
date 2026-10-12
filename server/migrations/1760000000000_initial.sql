-- Up Migration
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE user_role       AS ENUM ('designer','gestor');
CREATE TYPE kanban_status   AS ENUM ('briefing','em_producao','enviado_aprovacao','aprovado','programado');
CREATE TYPE creative_type   AS ENUM ('estatica','carrossel','story','video');
CREATE TYPE creative_status AS ENUM ('pending','approved','rejected','auto_approved');
CREATE TYPE decision_action AS ENUM ('approved','rejected');
CREATE TYPE decision_source AS ENUM ('client','auto');
CREATE TYPE reject_reason   AS ENUM ('texto_legenda','identidade_visual','imagem','outro');

CREATE TABLE users (
  id            serial PRIMARY KEY,
  name          text NOT NULL,
  email         citext UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role          user_role NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE clients (
  id                   serial PRIMARY KEY,
  name                 text NOT NULL,
  logo_key             text,
  instagram_handle     text,
  whatsapp             text,
  designer_id          int REFERENCES users(id),
  manager_id           int REFERENCES users(id),
  auto_approve_enabled boolean NOT NULL DEFAULT false,
  auto_approve_days    int NOT NULL DEFAULT 7,
  created_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);

CREATE TABLE batches (
  id                serial PRIMARY KEY,
  client_id         int NOT NULL REFERENCES clients(id),
  month             int NOT NULL CHECK (month BETWEEN 1 AND 12),
  year              int NOT NULL,
  kanban_status     kanban_status NOT NULL DEFAULT 'briefing',
  status_changed_at timestamptz NOT NULL DEFAULT now(),
  link_token        text UNIQUE,
  link_sent_at      timestamptz,
  viewed_at         timestamptz,
  submitted_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, month, year)
);

CREATE TABLE creatives (
  id              serial PRIMARY KEY,
  batch_id        int NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  type            creative_type NOT NULL,
  caption         text NOT NULL DEFAULT '',
  scheduled_date  date,
  status          creative_status NOT NULL DEFAULT 'pending',
  current_version int NOT NULL DEFAULT 1,
  sort_order      int NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON creatives (batch_id);

CREATE TABLE creative_versions (
  id          serial PRIMARY KEY,
  creative_id int NOT NULL REFERENCES creatives(id) ON DELETE CASCADE,
  version     int NOT NULL,
  note        text,
  created_by  int REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (creative_id, version)
);

CREATE TABLE creative_assets (
  id          serial PRIMARY KEY,
  version_id  int NOT NULL REFERENCES creative_versions(id) ON DELETE CASCADE,
  file_key    text NOT NULL,
  thumb_key   text,
  mime        text NOT NULL,
  width       int,
  height      int,
  size_bytes  bigint,
  sort_order  int NOT NULL DEFAULT 0
);
CREATE INDEX ON creative_assets (version_id);

CREATE TABLE decisions (
  id              serial PRIMARY KEY,
  creative_id     int NOT NULL REFERENCES creatives(id) ON DELETE CASCADE,
  version         int NOT NULL,
  action          decision_action NOT NULL,
  reason_category reject_reason,
  comment         text,
  source          decision_source NOT NULL DEFAULT 'client',
  decided_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (creative_id, version)
);

CREATE TABLE events (
  id          serial PRIMARY KEY,
  batch_id    int NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  creative_id int REFERENCES creatives(id) ON DELETE CASCADE,
  kind        text NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}',
  actor_id    int REFERENCES users(id),
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON events (creative_id, created_at);
CREATE INDEX ON events (batch_id, created_at);
CREATE INDEX ON events (kind) WHERE read_at IS NULL;

CREATE TABLE settings (
  key   text PRIMARY KEY,
  value text NOT NULL
);

INSERT INTO settings (key, value) VALUES
  ('whatsapp_template', 'Oi, {cliente}! Tudo bem? As {qtd_artes} artes do mês já estão prontas para sua aprovação. É só abrir o link, deslizar para aprovar ou recusar cada uma: {link}');

-- Down Migration
DROP TABLE IF EXISTS settings, events, decisions, creative_assets, creative_versions, creatives, batches, clients, users;
DROP TYPE IF EXISTS reject_reason, decision_source, decision_action, creative_status, creative_type, kanban_status, user_role;
