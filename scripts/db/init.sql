-- ============================================================
-- Enterprise AI Platform — PostgreSQL + pgvector schema
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ── Tenants ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  plan          TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  settings      JSONB NOT NULL DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Users ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  name          TEXT NOT NULL,
  password_hash TEXT,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user', 'readonly')),
  avatar_url    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);

CREATE INDEX idx_users_tenant_id  ON users(tenant_id);
CREATE INDEX idx_users_email      ON users(email);

-- ── Refresh tokens ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Documents ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  uploaded_by     UUID NOT NULL REFERENCES users(id),
  title           TEXT NOT NULL,
  description     TEXT,
  file_name       TEXT NOT NULL,
  file_size       BIGINT NOT NULL,
  mime_type       TEXT NOT NULL,
  source_type     TEXT NOT NULL CHECK (source_type IN ('pdf', 'docx', 'xlsx', 'txt', 'md', 'csv', 'url')),
  storage_key     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'active', 'failed')),
  chunk_count     INTEGER DEFAULT 0,
  error           TEXT,
  tags            TEXT[] DEFAULT '{}',
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_tenant_id  ON documents(tenant_id);
CREATE INDEX idx_documents_status     ON documents(status);
CREATE INDEX idx_documents_tags       ON documents USING GIN(tags);

-- ── Document chunks (with pgvector embeddings) ─────────────────
CREATE TABLE IF NOT EXISTS document_chunks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  embedding     vector(1024),                          -- BGE-M3 dimension
  page_number   INTEGER NOT NULL DEFAULT 1,
  chunk_index   INTEGER NOT NULL DEFAULT 0,
  fts_vector    tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HNSW index for fast approximate nearest-neighbour search
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
  ON document_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Full-text search index
CREATE INDEX idx_chunks_fts ON document_chunks USING GIN(fts_vector);

CREATE INDEX idx_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_chunks_tenant_id   ON document_chunks(tenant_id);

-- ── Conversations ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'New Conversation',
  model       TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_user_id   ON conversations(user_id);
CREATE INDEX idx_conversations_tenant_id ON conversations(tenant_id);

-- ── Messages ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content         TEXT NOT NULL,
  citations       JSONB DEFAULT '[]',
  agent_path      TEXT[] DEFAULT '{}',
  token_usage     JSONB DEFAULT '{"input": 0, "output": 0}',
  latency_ms      INTEGER,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at      ON messages(created_at DESC);

-- ── Agent execution logs ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_executions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id),
  conversation_id UUID REFERENCES conversations(id),
  thread_id     TEXT NOT NULL,
  intent        TEXT,
  agent_path    TEXT[] DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'awaiting_approval')),
  input         JSONB NOT NULL DEFAULT '{}',
  output        JSONB DEFAULT '{}',
  token_usage   JSONB DEFAULT '{"input": 0, "output": 0}',
  latency_ms    INTEGER,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX idx_agent_executions_tenant_id ON agent_executions(tenant_id);
CREATE INDEX idx_agent_executions_user_id   ON agent_executions(user_id);
CREATE INDEX idx_agent_executions_status    ON agent_executions(status);

-- ── Audit logs ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id),
  action      TEXT NOT NULL,
  resource    TEXT NOT NULL,
  resource_id TEXT,
  ip_address  INET,
  user_agent  TEXT,
  before_data JSONB,
  after_data  JSONB,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_tenant_id  ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user_id    ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action     ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Partition audit_logs by month (production: use pg_partman)
-- CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- ── Prompt templates (MLOps) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS prompt_templates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID REFERENCES tenants(id),
  name        TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  agent_type  TEXT NOT NULL,
  content     TEXT NOT NULL,
  variables   TEXT[] DEFAULT '{}',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  eval_score  FLOAT,
  metadata    JSONB DEFAULT '{}',
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name, version, agent_type)
);

-- ── Analytics summary (materialized) ─────────────────────────
CREATE TABLE IF NOT EXISTS analytics_summary (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  date             DATE NOT NULL,
  total_queries    INTEGER DEFAULT 0,
  total_tokens     INTEGER DEFAULT 0,
  estimated_cost   DECIMAL(10, 4) DEFAULT 0,
  avg_latency_ms   INTEGER DEFAULT 0,
  rag_queries      INTEGER DEFAULT 0,
  sql_queries      INTEGER DEFAULT 0,
  workflow_actions INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, date)
);

-- ── Seed: default tenant + admin ──────────────────────────────
INSERT INTO tenants (id, name, slug, plan) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Demo Corp', 'demo', 'enterprise')
ON CONFLICT DO NOTHING;
