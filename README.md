# Enterprise AI Knowledge Assistant Platform

A production-ready, enterprise-grade AI platform that lets employees chat with company documents, query databases in natural language, create Jira tickets, search GitHub repos, send Slack messages, and generate business reports — all through a unified AI interface.

> **Comparable to**: OpenAI ChatGPT Enterprise · Microsoft Copilot for Business · Glean · Notion AI · Slack AI

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15, TypeScript, Tailwind CSS, ShadCN UI, Zustand |
| **API Gateway** | Express, JWT, Rate Limiting, WebSocket (Socket.IO) |
| **AI / Agents** | LangGraph, LangChain, Anthropic Claude, OpenAI GPT |
| **RAG** | BGE-M3, pgvector (HNSW), Cohere Rerank, Hybrid Search |
| **MCP** | GitHub, Jira, Slack, PostgreSQL, S3 tool servers |
| **Database** | PostgreSQL 16 + pgvector, Redis 7 |
| **Infrastructure** | Amazon EKS, RDS, ElastiCache, S3, CloudFront, WAF |
| **IaC** | Terraform, Kubernetes, Kustomize |
| **CI/CD** | GitHub Actions, Docker, ECR, Blue/Green deployment |
| **Observability** | OpenTelemetry, Prometheus, Grafana, Loki |
| **Package Manager** | pnpm (workspaces) + Turborepo |

---

## Repository Structure

```
ai-enterprise-platform/
├── apps/
│   ├── frontend/               # Next.js 15 + Tailwind + ShadCN UI
│   │   ├── src/
│   │   │   ├── app/           # App Router pages (chat, admin, docs)
│   │   │   ├── components/    # UI components (ChatMessage, ChatInput, etc.)
│   │   │   └── lib/           # Utilities, API clients
│   │   ├── Dockerfile
│   │   └── package.json
│   └── api-gateway/            # Express reverse proxy, JWT auth, rate limiting
│       ├── src/
│       │   ├── middleware/    # auth, rate-limiter, logger, tenant
│       │   ├── routes/        # health
│       │   └── lib/           # logger, redis
│       ├── Dockerfile
│       └── package.json
│
├── services/
│   ├── auth-service/           # JWT issue/refresh, Argon2 password hashing, RBAC
│   ├── agent-service/          # LangGraph orchestrator, all AI agents, SSE streaming
│   │   └── src/graphs/
│   │       ├── orchestrator.ts # StateGraph definition
│   │       └── nodes/         # router, rag-agent, sql-agent, workflow-agent, etc.
│   ├── rag-service/            # Hybrid search (vector + FTS), Cohere reranking
│   │   └── src/pipeline/      # ingestion, retrieval, chunker, reranker
│   ├── document-service/       # File upload, PDF/DOCX/XLSX parsing, OCR, S3
│   ├── embedding-service/      # BGE-M3 inference, batch embedding, versioning
│   ├── mcp-gateway/            # MCP tool registry + GitHub/Jira/Slack/S3/PG tools
│   │   └── src/tools/         # github.ts, jira.ts, postgres.ts, slack.ts, s3.ts
│   ├── notification-service/   # Email + Slack notifications, human-in-loop alerts
│   └── audit-service/          # Immutable audit log, compliance reporting
│
├── packages/
│   ├── shared-types/           # Zod schemas + TypeScript types (User, Doc, Agent, MCP)
│   ├── shared-ui/              # Shared React components
│   └── shared-utils/           # Shared utilities
│
├── infrastructure/
│   ├── terraform/              # AWS EKS, RDS, ElastiCache, S3, WAF, Secrets Manager
│   ├── kubernetes/
│   │   ├── base/              # Namespace, Deployments, Services, Ingress, NetworkPolicy
│   │   └── overlays/          # dev / staging / production Kustomize overlays
│   └── observability/         # prometheus.yml, otel-collector.yml, Grafana dashboards
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml             # Lint → Test → Security → Docker Build → ECR Push
│   │   └── cd-production.yml  # Blue/Green deploy → Rollback strategy → Slack notify
│   └── dependabot.yml
│
├── scripts/
│   └── db/init.sql            # PostgreSQL schema (tenants, users, docs, chunks, agents)
│
├── docs/
│   └── ARCHITECTURE.md        # Full architecture + 10 Mermaid diagrams
│
├── docker-compose.yml          # Local dev: all services + Postgres + Redis + Grafana
├── .env.example               # All environment variables documented
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 22+
- pnpm 9+
- Docker Desktop
- Git

### 1. Clone & install

```bash
git clone <repo>
cd ai-enterprise-platform
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — add your API keys (Anthropic, OpenAI, Cohere)
```

### 3. Start infrastructure

```bash
docker compose up postgres redis minio -d
```

### 4. Initialize database

```bash
psql $DATABASE_URL -f scripts/db/init.sql
```

### 5. Start all services

```bash
pnpm dev
```

This starts via Turborepo in parallel:
- Frontend at `http://localhost:3100`
- API Gateway at `http://localhost:3000`
- Agent Service at `http://localhost:3002`
- RAG Service at `http://localhost:3003`
- MCP Gateway at `http://localhost:3006`
- + All other services

### 6. Full Docker stack

```bash
pnpm docker:up
# Includes all services + Prometheus + Grafana + Loki
```

---

## Key Features

### Multi-Agent AI (LangGraph)
- **Router Agent** classifies intent with structured output
- **RAG Agent** retrieves and answers from company documents
- **SQL Agent** converts natural language to safe SELECT queries
- **Workflow Agent** creates Jira tickets, sends Slack messages, reads GitHub
- **Report Agent** synthesizes multi-source executive reports
- **Human-in-Loop** for sensitive actions requiring approval

### Enterprise RAG Pipeline
- Upload PDF, DOCX, XLSX, TXT, Markdown, CSV
- Paragraph-aware chunking (512 tokens, 64 overlap)
- BGE-M3 embeddings (1024-dim) via HNSW pgvector index
- Hybrid search: dense vector + PostgreSQL full-text
- Reciprocal Rank Fusion + Cohere Rerank for precision
- Citation generation with document + page references

### MCP Tool Integration
| Tool | Action |
|------|--------|
| `create_jira_ticket()` | Create Jira issues with all metadata |
| `read_github_repo()` | Browse files and directories |
| `search_github_code()` | Code search across repos |
| `query_database()` | Read-only SQL via natural language |
| `send_slack_message()` | Post to channels or threads |
| `list_s3_files()` | Browse document storage |

### Security
- Multi-tenant row-level isolation
- JWT + Argon2id + refresh token rotation
- RBAC (admin / manager / user / readonly)
- WAF + Rate limiting + Network Policies
- Prompt injection protection
- SQL injection prevention (SELECT-only enforcement)
- All secrets in AWS Secrets Manager

---

## CI/CD Flow

```
PR opened → Lint → Unit Tests → Integration Tests (real DB) → Security Scan (Trivy + SonarQube)
                                                                      ↓
                                                          Docker Build → Image Scan → Push ECR
                                                                      ↓
push main → Deploy Dev → Deploy Staging → Manual Approval → Blue/Green Production
                                                                      ↓
                                                         Smoke Test → ✅ or Rollback + Slack
```

---

## Architecture Diagrams

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for all 10 Mermaid diagrams:

1. High-Level System Architecture
2. Agentic AI Workflow
3. RAG Pipeline (Ingestion + Retrieval + Generation)
4. MCP Architecture (tool registry + external APIs)
5. Database ERD (PostgreSQL schema)
6. Kubernetes Deployment (EKS node groups + namespaces)
7. CI/CD Pipeline (GitHub Actions)
8. AWS Infrastructure (VPC, EKS, RDS, CloudFront, WAF)
9. Request Flow (sequence diagram)
10. User Query Execution Flow

---

## Development Roadmap

| Phase | Focus | Timeline |
|-------|-------|----------|
| 1 | Local dev, monorepo, auth | Week 1–2 |
| 2 | RAG pipeline, pgvector, embeddings | Week 3–4 |
| 3 | LangGraph multi-agent system | Week 5–6 |
| 4 | MCP integration (GitHub/Jira/Slack) | Week 7–8 |
| 5 | Dockerization, multi-stage builds | Week 9 |
| 6 | Kubernetes, HPA, Network Policies | Week 10–11 |
| 7 | CI/CD, Trivy, SonarQube, ECR | Week 12 |
| 8 | AWS: EKS, RDS, Terraform | Week 13–14 |
| 9 | Production hardening, WAF, IRSA | Week 15 |
| 10 | Observability, alerting, LLM cost tracking | Week 16 |

---

## License

MIT — see [LICENSE](./LICENSE)