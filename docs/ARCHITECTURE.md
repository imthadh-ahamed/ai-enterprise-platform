# Enterprise AI Knowledge Assistant Platform — Architecture

## Table of Contents
1. [High-Level System Architecture](#1-high-level-system-architecture)
2. [Agentic AI Workflow](#2-agentic-ai-workflow)
3. [RAG Pipeline](#3-rag-pipeline)
4. [MCP Architecture](#4-mcp-architecture)
5. [Database Architecture](#5-database-architecture)
6. [Kubernetes Deployment](#6-kubernetes-deployment)
7. [CI/CD Pipeline](#7-cicd-pipeline)
8. [AWS Infrastructure](#8-aws-infrastructure)
9. [Request Flow](#9-request-flow)
10. [User Query Execution Flow](#10-user-query-execution-flow)
11. [Service Responsibilities](#11-service-responsibilities)
12. [Security Architecture](#12-security-architecture)
13. [MLOps / LLMOps](#13-mlops--llmops)
14. [Development Roadmap](#14-development-roadmap)
15. [Production Considerations](#15-production-considerations)

---

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph Client["Client Layer"]
        Browser["Browser / Mobile"]
        APIClient["API Client"]
    end

    subgraph CDN["AWS CDN Layer"]
        CF["CloudFront CDN"]
        WAF["WAF (Web Application Firewall)"]
        R53["Route 53 DNS"]
    end

    subgraph Frontend["Frontend — Next.js 15"]
        UI["Chat Interface"]
        DocPortal["Document Upload Portal"]
        AdminDash["Admin Dashboard"]
        AgentMon["Agent Monitor"]
    end

    subgraph Gateway["API Gateway Layer"]
        APIGW["API Gateway\n(Express + Rate Limiter)"]
        Auth["JWT Auth Middleware"]
        Proxy["Service Proxy Router"]
        WS["WebSocket (Socket.IO)"]
    end

    subgraph Services["Microservices"]
        AuthSvc["Auth Service\n(Argon2 + JWT)"]
        AgentSvc["Agent Service\n(LangGraph)"]
        RAGSvc["RAG Service\n(Hybrid Search)"]
        DocSvc["Document Service\n(OCR + Parsing)"]
        EmbedSvc["Embedding Service\n(BGE-M3)"]
        MCPGw["MCP Gateway\n(Tool Registry)"]
        NotifSvc["Notification Service"]
        AuditSvc["Audit Service"]
    end

    subgraph AILayer["AI Layer"]
        LangGraph["LangGraph Orchestrator"]
        RouterAgent["Router Agent"]
        RAGAgent["RAG Agent"]
        SQLAgent["SQL Agent"]
        WorkflowAgent["Workflow Agent"]
        ReportAgent["Report Agent"]
        Memory["Redis Memory"]
    end

    subgraph MCPServers["MCP Servers"]
        GitHubMCP["GitHub MCP"]
        JiraMCP["Jira MCP"]
        SlackMCP["Slack MCP"]
        PostgresMCP["PostgreSQL MCP"]
        S3MCP["S3 MCP"]
    end

    subgraph DataLayer["Data Layer"]
        PG["PostgreSQL + pgvector"]
        Redis["Redis Cache"]
        S3["S3 Object Store"]
    end

    subgraph Observability["Observability"]
        OTEL["OpenTelemetry Collector"]
        Prometheus["Prometheus"]
        Grafana["Grafana"]
        Loki["Loki Logs"]
    end

    Browser --> CF --> WAF --> Frontend
    Frontend --> APIGW
    APIGW --> Auth --> Proxy
    Proxy --> AuthSvc & AgentSvc & RAGSvc & DocSvc & MCPGw
    AgentSvc --> LangGraph --> RouterAgent
    RouterAgent --> RAGAgent & SQLAgent & WorkflowAgent & ReportAgent
    RAGAgent --> RAGSvc --> EmbedSvc
    SQLAgent --> MCPGw --> PostgresMCP
    WorkflowAgent --> MCPGw --> GitHubMCP & JiraMCP & SlackMCP & S3MCP
    RAGSvc & DocSvc & EmbedSvc --> PG
    AgentSvc & AuthSvc --> Redis
    DocSvc --> S3
    Services --> OTEL --> Prometheus --> Grafana
    OTEL --> Loki --> Grafana
```

---

## 2. Agentic AI Workflow

```mermaid
graph TD
    Start([User Query]) --> Memory[Memory Manager\nLoad conversation history]
    Memory --> Router{Router Agent\nClassify intent}

    Router -->|rag_query / document_search| RAG[RAG Agent]
    Router -->|sql_query / data_analysis| SQL[SQL Agent]
    Router -->|create_ticket / send_message| Workflow[Workflow Agent]
    Router -->|generate_report| Report[Report Agent]
    Router -->|requires_approval| HIL[Human-in-Loop\nSend notification]

    RAG --> Retrieve[Retrieve chunks\nHybrid Search + Rerank]
    Retrieve --> BuildCtx[Build context\nwith citations]
    BuildCtx --> Generate[Generate answer\nAnthropic Claude]

    SQL --> GenSQL[Generate SQL\nStructured output]
    GenSQL --> SafetyCheck{Is SELECT only?}
    SafetyCheck -->|Yes| ExecSQL[Execute via MCP\nPostgreSQL server]
    SafetyCheck -->|No| Reject[Reject — explain limitation]
    ExecSQL --> FormatResult[Format result\nfor humans]

    Workflow --> SelectTool[Select MCP tool\ncreate_jira_ticket etc.]
    SelectTool --> CallTool[Execute MCP tool\nwith extracted params]
    CallTool --> ConfirmAction[Return confirmation\nwith result]

    Report --> GatherData[Gather data in parallel\nRAG + DB]
    GatherData --> GenReport[Generate executive report\nwith insights]

    HIL -->|Approved| ResumeAgent[Resume agent execution]
    HIL -->|Denied| CancelMsg[Return cancellation message]

    Generate & FormatResult & ConfirmAction & GenReport --> SaveMemory[Update conversation memory]
    SaveMemory --> Response([Stream response to user])
    ResumeAgent --> Router
```

---

## 3. RAG Pipeline

```mermaid
flowchart LR
    subgraph Ingestion["Ingestion Pipeline"]
        Upload["Document Upload\n(PDF/DOCX/XLSX/TXT)"]
        OCR["OCR Pipeline\n(Tesseract / AWS Textract)"]
        Parse["Parser\n(pdf-parse / mammoth)"]
        Chunk["Chunker\nParagraph-aware\n512 tokens + 64 overlap"]
        Enrich["Metadata Enricher\nTitle, author, date, page"]
    end

    subgraph Embedding["Embedding Pipeline"]
        EmbedBatch["Batch Embedder\nBGE-M3 (1024-dim)\n32 per batch"]
        Store["pgvector INSERT\nHNSW index"]
        FTS["Full-text index\ntsvector (PostgreSQL)"]
    end

    subgraph Retrieval["Retrieval Pipeline"]
        QueryEmbed["Query Embedding\nBGE-M3"]
        VectorSearch["Vector Search\nANN cosine similarity\ntop-20"]
        FTSSearch["Full-text Search\nplainto_tsquery\ntop-20"]
        RRF["Reciprocal Rank\nFusion (k=60)"]
        Rerank["Cohere Rerank v3.5\ntop-5"]
        Cache["Redis Cache\n5-min TTL"]
    end

    subgraph Generation["Answer Generation"]
        BuildCtx["Build context\n[Source N] notation"]
        LLM["Anthropic Claude\nAnswer with citations"]
        CitationFmt["Format citations\nfor UI display"]
    end

    Upload --> OCR --> Parse --> Chunk --> Enrich --> EmbedBatch --> Store & FTS
    QueryEmbed --> VectorSearch & FTSSearch
    VectorSearch & FTSSearch --> RRF --> Rerank
    Cache -.->|hit| Rerank
    Rerank -->|miss| Cache
    Rerank --> BuildCtx --> LLM --> CitationFmt
```

---

## 4. MCP Architecture

```mermaid
graph TB
    subgraph Agents["AI Agents"]
        SQLAgt["SQL Agent"]
        WorkflowAgt["Workflow Agent"]
        RAGAgt["RAG Agent"]
    end

    subgraph MCPGateway["MCP Gateway"]
        Router["Tool Router"]
        Registry["Tool Registry\n(name → handler map)"]
        AuthMW["Auth Middleware\nBearer token validation"]
        AuditLog["Audit Logger\nevery tool call"]
        RateLimit["Per-tenant\nRate Limiter"]
    end

    subgraph MCPTools["Registered Tools"]
        direction LR
        subgraph GitHub["GitHub MCP"]
            ReadRepo["read_github_repo()"]
            CreateIssue["create_github_issue()"]
            SearchCode["search_github_code()"]
        end
        subgraph Jira["Jira MCP"]
            CreateTicket["create_jira_ticket()"]
            GetIssue["get_jira_issue()"]
            SearchJQL["search_jira_issues()"]
        end
        subgraph PG["PostgreSQL MCP"]
            QueryDB["query_database()"]
            GetSchema["get_table_schema()"]
        end
        subgraph Slack["Slack MCP"]
            SendMsg["send_slack_message()"]
            ListChannels["list_slack_channels()"]
        end
        subgraph S3["S3 MCP"]
            ListFiles["list_s3_files()"]
            GetURL["get_s3_file_url()"]
        end
    end

    subgraph External["External Systems"]
        GHApi["GitHub API"]
        JiraApi["Jira REST API"]
        PGDb["PostgreSQL DB"]
        SlackApi["Slack API"]
        S3Svc["AWS S3"]
    end

    Agents -->|POST /api/v1/tools/call| AuthMW
    AuthMW --> RateLimit --> Router --> Registry
    Registry --> AuditLog
    Registry --> GitHub & Jira & PG & Slack & S3
    GitHub --> GHApi
    Jira --> JiraApi
    PG --> PGDb
    Slack --> SlackApi
    S3 --> S3Svc
```

---

## 5. Database Architecture

```mermaid
erDiagram
    TENANTS {
        uuid id PK
        text name
        text slug UK
        text plan
        jsonb settings
        bool is_active
        timestamptz created_at
    }

    USERS {
        uuid id PK
        uuid tenant_id FK
        text email
        text name
        text password_hash
        text role
        bool is_active
        timestamptz last_login_at
    }

    DOCUMENTS {
        uuid id PK
        uuid tenant_id FK
        uuid uploaded_by FK
        text title
        text source_type
        text status
        text storage_key
        int chunk_count
        text[] tags
        jsonb metadata
    }

    DOCUMENT_CHUNKS {
        uuid id PK
        uuid document_id FK
        uuid tenant_id FK
        text content
        vector_1024 embedding
        int page_number
        int chunk_index
        tsvector fts_vector
        jsonb metadata
    }

    CONVERSATIONS {
        uuid id PK
        uuid tenant_id FK
        uuid user_id FK
        text title
        text model
        bool is_archived
    }

    MESSAGES {
        uuid id PK
        uuid conversation_id FK
        text role
        text content
        jsonb citations
        text[] agent_path
        jsonb token_usage
        int latency_ms
    }

    AGENT_EXECUTIONS {
        uuid id PK
        uuid tenant_id FK
        uuid user_id FK
        text thread_id
        text intent
        text[] agent_path
        text status
        jsonb token_usage
        int latency_ms
    }

    AUDIT_LOGS {
        bigint id PK
        uuid tenant_id FK
        uuid user_id FK
        text action
        text resource
        inet ip_address
        jsonb before_data
        jsonb after_data
    }

    PROMPT_TEMPLATES {
        uuid id PK
        text name
        int version
        text agent_type
        text content
        bool is_active
        float eval_score
    }

    TENANTS ||--o{ USERS : has
    TENANTS ||--o{ DOCUMENTS : owns
    TENANTS ||--o{ CONVERSATIONS : has
    USERS ||--o{ CONVERSATIONS : creates
    CONVERSATIONS ||--o{ MESSAGES : contains
    DOCUMENTS ||--o{ DOCUMENT_CHUNKS : split_into
    USERS ||--o{ AGENT_EXECUTIONS : triggers
    USERS ||--o{ AUDIT_LOGS : generates
```

---

## 6. Kubernetes Deployment

```mermaid
graph TB
    subgraph AWS_EKS["Amazon EKS — ai-platform cluster"]
        subgraph NS_Platform["Namespace: ai-platform"]
            subgraph Frontend_Deploy["Deployment: frontend (2-6 pods)"]
                FE1["frontend-pod-1"]
                FE2["frontend-pod-2"]
            end
            subgraph GW_Deploy["Deployment: api-gateway (2-10 pods, HPA)"]
                GW1["gateway-pod-1"]
                GW2["gateway-pod-2"]
            end
            subgraph Agent_Deploy["Deployment: agent-service (2-8 pods, HPA)"]
                AG1["agent-pod-1"]
                AG2["agent-pod-2"]
            end
            subgraph RAG_Deploy["Deployment: rag-service (2-6 pods, HPA)"]
                RAG1["rag-pod-1"]
                RAG2["rag-pod-2"]
            end
            subgraph MCP_Deploy["Deployment: mcp-gateway (2-4 pods)"]
                MCP1["mcp-pod-1"]
                MCP2["mcp-pod-2"]
            end
            subgraph Auth_Deploy["Deployment: auth-service (2-4 pods)"]
                Auth1["auth-pod-1"]
                Auth2["auth-pod-2"]
            end
            ConfigMap["ConfigMap: platform-config"]
            Secrets["Secret: platform-secrets\n(from AWS Secrets Manager)"]
        end

        subgraph NS_Monitor["Namespace: ai-platform-monitoring"]
            Prometheus_Pod["Prometheus"]
            Grafana_Pod["Grafana"]
            Loki_Pod["Loki"]
            OTEL_Pod["OTel Collector"]
        end

        subgraph NodeGroups["EKS Node Groups"]
            GeneralNodes["General Nodes\nm6i.xlarge × 2-10\n(auto-scaled)"]
            GPUNodes["GPU Nodes\ng4dn.xlarge × 0-3\n(embedding service)"]
        end
    end

    subgraph AWS_Services["AWS Managed Services"]
        ALB["Application Load Balancer\n(AWS ALB Ingress Controller)"]
        RDS_PG["RDS PostgreSQL 16\n(Multi-AZ)"]
        ElastiCache["ElastiCache Redis 7\n(Cluster mode, 3 nodes)"]
        ECR["ECR — Container Registry"]
    end

    Internet -->|HTTPS| ALB
    ALB -->|/| Frontend_Deploy
    ALB -->|/api| GW_Deploy
    GW_Deploy --> Auth_Deploy & Agent_Deploy & RAG_Deploy & MCP_Deploy
    Agent_Deploy --> RAG_Deploy
    Agent_Deploy & RAG_Deploy & Auth_Deploy --> RDS_PG
    GW_Deploy & Agent_Deploy & Auth_Deploy --> ElastiCache
    Services --> OTEL_Pod --> Prometheus_Pod --> Grafana_Pod
```

---

## 7. CI/CD Pipeline

```mermaid
flowchart LR
    subgraph Dev["Developer"]
        PR["Pull Request"]
        Push["git push main"]
    end

    subgraph CI["CI Pipeline (GitHub Actions)"]
        Lint["Lint &\nType Check"]
        UnitTest["Unit Tests\n+ Coverage"]
        IntTest["Integration Tests\n(real PG + Redis)"]
        SecScan["Security Scan\n(Trivy + SonarQube)"]
        DockerBuild["Docker Build\n(multi-stage)"]
        ImageScan["Image Scan\n(Trivy)"]
        PushECR["Push to ECR\n(SHA + latest tag)"]
    end

    subgraph CD_Dev["CD — Dev"]
        DevDeploy["kubectl apply\n(dev namespace)"]
        DevSmoke["Smoke Tests"]
    end

    subgraph CD_Staging["CD — Staging"]
        StagingDeploy["kubectl set image\n(staging namespace)"]
        E2E["E2E Tests\n(Playwright)"]
        LoadTest["Load Test\n(k6)"]
    end

    subgraph CD_Prod["CD — Production"]
        ProdApproval["Manual Approval\n(GitHub Environment)"]
        BlueGreen["Blue/Green Deploy\nkubectl rollout"]
        Rollout["Wait for rollout\n--timeout=300s"]
        SmokeTest["Smoke Test\n/health endpoint"]
        Rollback["Rollback\nif smoke fails"]
        SlackNotify["Slack Notification\n✅ or 🚨"]
    end

    PR --> Lint --> UnitTest & IntTest
    UnitTest & IntTest --> SecScan
    SecScan --> DockerBuild --> ImageScan --> PushECR
    Push --> CI
    PushECR --> DevDeploy --> DevSmoke
    DevSmoke -->|pass| StagingDeploy --> E2E --> LoadTest
    LoadTest -->|pass| ProdApproval --> BlueGreen --> Rollout
    Rollout --> SmokeTest
    SmokeTest -->|pass| SlackNotify
    SmokeTest -->|fail| Rollback --> SlackNotify
```

---

## 8. AWS Infrastructure

```mermaid
graph TB
    subgraph Internet["Internet"]
        Users["Enterprise Users"]
    end

    subgraph Global["AWS Global Services"]
        R53["Route 53\nDNS + Health Checks"]
        CF["CloudFront CDN\nEdge Caching"]
    end

    subgraph Region["AWS us-east-1"]
        WAF["WAF v2\nOWASP rules + Rate limiting"]
        ALB["Application Load Balancer\nSSL Termination"]

        subgraph VPC["VPC 10.0.0.0/16"]
            subgraph PublicSubnets["Public Subnets (1a/1b/1c)"]
                NAT["NAT Gateways (HA)"]
                ALBSubnet["ALB Subnet"]
            end

            subgraph PrivateSubnets["Private Subnets (1a/1b/1c)"]
                EKS["EKS Cluster\nai-platform-prod"]
                EKSNodes["Node Groups\nGeneral + GPU"]
            end

            subgraph DBSubnets["DB Subnets (1a/1b/1c)"]
                RDS["RDS PostgreSQL 16\nMulti-AZ (primary + standby)"]
                Redis["ElastiCache Redis 7\nCluster (3 nodes)"]
            end
        end

        subgraph Storage["Storage"]
            S3["S3 Bucket\nDocuments (KMS encrypted)"]
            ECR["ECR\nContainer Images"]
        end

        subgraph Security["Security & Identity"]
            SM["Secrets Manager\nAPI keys, DB passwords"]
            IAM["IAM Roles\nIRSA for pod-level access"]
            KMS["KMS\nEncryption keys"]
        end

        subgraph Monitoring["Monitoring"]
            CW["CloudWatch\nLogs + Metrics + Alarms"]
            XRay["X-Ray\nDistributed Tracing"]
        end
    end

    Users --> R53 --> CF --> WAF --> ALB
    ALB --> PrivateSubnets
    EKS --> RDS & Redis
    EKS --> S3
    EKS --> SM & IAM
    EKS --> CW & XRay
    PrivateSubnets --> NAT --> Internet
```

---

## 9. Request Flow

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend (Next.js)
    participant GW as API Gateway
    participant Auth as Auth Service
    participant Agent as Agent Service
    participant RAG as RAG Service
    participant MCP as MCP Gateway
    participant DB as PostgreSQL
    participant Redis as Redis
    participant LLM as Anthropic Claude

    User->>FE: Submit chat message
    FE->>GW: POST /api/chat\n{messages, sessionId}
    GW->>Auth: Verify JWT (middleware)
    Auth-->>GW: {userId, tenantId, role}
    GW->>Agent: Forward with x-user-id, x-tenant-id headers

    Agent->>Redis: Load conversation memory
    Redis-->>Agent: Previous messages (last 20)

    Agent->>LLM: Router Agent: classify intent
    LLM-->>Agent: {intent: "rag_query", confidence: 0.95}

    Agent->>RAG: POST /api/v1/retrieve\n{query, tenantId, topK: 10}
    RAG->>DB: Vector search (HNSW) + FTS in parallel
    DB-->>RAG: 20 candidate chunks each
    RAG->>RAG: Reciprocal Rank Fusion → top 10
    RAG->>RAG: Cohere Rerank → top 5
    RAG-->>Agent: {chunks, citations}

    Agent->>LLM: RAG Agent: generate answer\nwith context + citations
    LLM-->>Agent: Streaming tokens

    loop SSE Stream
        Agent->>GW: event: agent_update\n{node, status}
        GW->>FE: SSE event
        FE->>User: Show agent thinking status
    end

    Agent->>GW: event: text\n{text: "The answer is..."}
    GW->>FE: SSE stream
    FE->>User: Stream rendered markdown

    Agent->>Redis: Save updated memory
    Agent->>DB: Save message + execution log
    Agent->>GW: event: done + citations
    GW->>FE: Citations panel data
    FE->>User: Display source citations
```

---

## 10. User Query Execution Flow

```mermaid
flowchart TD
    A([User types query]) --> B[Frontend validates input\nCheck empty / max length]
    B --> C[POST /api/chat\nJWT in Authorization header]
    C --> D{API Gateway}
    D -->|Invalid JWT| E[401 Unauthorized]
    D -->|Rate limit exceeded| F[429 Too Many Requests]
    D -->|OK| G[Forward to Agent Service\nwith user context headers]

    G --> H[LangGraph Orchestrator START]
    H --> I[Memory Manager\nLoad Redis history]
    I --> J[Router Agent\nClaude structured output]

    J -->|rag_query| K[RAG Agent]
    J -->|sql_query| L[SQL Agent]
    J -->|create_ticket| M[Workflow Agent]
    J -->|generate_report| N[Report Agent]
    J -->|requires_approval| O[Human-in-Loop\nNotify admin]

    K --> K1[Query Embedding\nBGE-M3 API] --> K2[Hybrid Search\nvector + FTS] --> K3[Rerank\nCohere API] --> K4[Generate Answer\nClaude with citations]
    L --> L1[Generate SQL\nStructured output] --> L2{SELECT only?} -->|Yes| L3[Execute via MCP\nPostgreSQL] --> L4[Format results]
    M --> M1[Extract params\nStructured output] --> M2[Call MCP tool\nJira / GitHub / Slack] --> M3[Return confirmation]
    N --> N1[Gather RAG + DB\nin parallel] --> N2[Generate executive report\nwith insights]

    K4 & L4 & M3 & N2 --> P[Save to conversation\nmemory + DB]
    P --> Q[Stream response\nvia SSE to frontend]
    Q --> R([User sees answer\nwith citations])
```

---

## 11. Service Responsibilities

| Service | Port | Responsibility |
|---------|------|----------------|
| **api-gateway** | 3000 | Single entry point: JWT auth, rate limiting, CORS, service proxy, WebSocket relay |
| **auth-service** | 3001 | User registration/login, JWT issue/refresh/revoke, RBAC, password hashing (Argon2) |
| **agent-service** | 3002 | LangGraph orchestration, intent routing, multi-agent execution, streaming, memory |
| **rag-service** | 3003 | Document retrieval: hybrid vector+FTS search, Cohere reranking, citation generation |
| **document-service** | 3004 | File upload, PDF/DOCX/XLSX parsing, OCR, chunking trigger, storage to S3 |
| **embedding-service** | 3005 | BGE-M3 embedding generation, batch processing, embedding versioning |
| **mcp-gateway** | 3006 | MCP tool registry, external API calls (GitHub/Jira/Slack/S3/PG), audit logging |
| **notification-service** | 3007 | Email/Slack notifications, human-in-loop approval requests, async event processing |
| **audit-service** | 3008 | Immutable audit log writes, compliance reporting, user action tracking |

---

## 12. Security Architecture

### Authentication & Authorization
- **JWT** with short expiry (24h access, 7d refresh) — refresh tokens stored hashed in Redis
- **RBAC** — `admin > manager > user > readonly` enforced at API Gateway + service level
- **Multi-tenant isolation** — all DB queries filtered by `tenant_id` from JWT claim
- **Argon2id** password hashing (memory-hard, resistant to GPU attacks)

### Network Security
- **WAF** (AWS WAFv2): OWASP CRS + custom rate-limit rules (2000 req/5min per IP)
- **Network Policies** (Kubernetes): default-deny-all, explicit allow between services only
- **TLS everywhere**: CloudFront → ALB (HTTPS), ALB → services (HTTPS), RDS/Redis (TLS)
- **CORS**: restrictive origin allowlist, credentials=true only for trusted origins

### Secrets Management
- All secrets in **AWS Secrets Manager**, injected as K8s Secrets via External Secrets Operator
- **IRSA** (IAM Roles for Service Accounts) — pod-level AWS permissions, no long-lived credentials
- No secrets in Docker images, git history, or ConfigMaps

### AI-Specific Security
- **Prompt injection protection**: system prompts non-overridable, user input sandboxed
- **SQL injection prevention**: MCP PostgreSQL tool enforces SELECT-only via regex + Zod validation
- **RAG security**: chunks filtered by `tenant_id` — no cross-tenant data leakage
- **Output validation**: Zod schemas on all structured LLM outputs (RouterAgent, SQLAgent, WorkflowAgent)
- **Token limits**: max output tokens enforced per agent to prevent runaway cost

### Compliance
- **Audit logs**: every user action, every MCP tool call, every agent execution logged immutably
- **Data at rest**: RDS encrypted (AES-256 via KMS), S3 SSE-KMS, Redis encryption-at-rest
- **Data in transit**: TLS 1.2+ enforced everywhere

---

## 13. MLOps / LLMOps

### Prompt Versioning
- Prompts stored in `prompt_templates` table with semantic versioning
- A/B testing via feature flags per tenant
- Rollback: flip `is_active` to previous version row

### Evaluation Pipeline
```
User queries → Agent execution → Store (input, output, token_usage, latency)
                                    ↓
                             Offline evaluation
                           ├── RAGAS (faithfulness, answer_relevancy, context_precision)
                           ├── Custom scorers (citation accuracy, SQL correctness)
                           └── Human feedback (thumbs up/down in UI)
```

### Cost Monitoring
- Token usage tracked per message in `messages.token_usage`
- Daily aggregation in `analytics_summary.estimated_cost`
- Grafana dashboard: cost per tenant, per model, per agent type
- Alerts: CloudWatch alarm if daily cost > threshold

### Embedding Versioning
- Embedding dimension stored in `document_chunks` metadata
- On model upgrade: re-embed all documents for tenant (background job)
- Dual-index during migration: old + new embeddings served simultaneously

---

## 14. Development Roadmap

### Phase 1 — Local Development (Week 1–2)
**Learning Objectives**: Monorepo setup, TypeScript, pnpm workspaces, Turborepo  
**Deliverables**: Working frontend + API Gateway + Auth service locally  
**Skills**: Next.js 15, Express, JWT, Docker Compose

### Phase 2 — RAG Implementation (Week 3–4)
**Learning Objectives**: Vector databases, embeddings, chunking strategies  
**Deliverables**: Document upload → embedding → retrieval pipeline  
**Skills**: pgvector, BGE-M3, Cohere Rerank, PostgreSQL full-text search

### Phase 3 — Agentic AI (Week 5–6)
**Learning Objectives**: LangGraph, multi-agent systems, tool calling  
**Deliverables**: Router + RAG + SQL + Workflow agents with streaming  
**Skills**: LangGraph, LangChain, Anthropic SDK, SSE streaming

### Phase 4 — MCP Integration (Week 7–8)
**Learning Objectives**: Model Context Protocol, external API integration  
**Deliverables**: MCP Gateway with GitHub, Jira, Slack, S3 tools  
**Skills**: MCP SDK, Octokit, Jira REST API, Slack API, AWS SDK

### Phase 5 — Dockerization (Week 9)
**Learning Objectives**: Multi-stage builds, container security, image optimization  
**Deliverables**: Production-ready Dockerfiles for all services  
**Skills**: Docker BuildKit, non-root containers, layer caching

### Phase 6 — Kubernetes (Week 10–11)
**Learning Objectives**: K8s primitives, HPA, PDB, Network Policies  
**Deliverables**: Full K8s manifests with Kustomize overlays  
**Skills**: kubectl, Kustomize, Helm basics, resource limits, health probes

### Phase 7 — CI/CD (Week 12)
**Learning Objectives**: GitHub Actions, ECR, automated testing  
**Deliverables**: Full CI pipeline + blue/green CD to EKS  
**Skills**: GitHub Actions, Docker BuildKit cache, Trivy, SonarQube

### Phase 8 — AWS Deployment (Week 13–14)
**Learning Objectives**: EKS, RDS, ElastiCache, WAF, Terraform  
**Deliverables**: Production AWS infrastructure via Terraform  
**Skills**: Terraform, EKS, RDS, Route53, CloudFront, IAM/IRSA

### Phase 9 — Production Hardening (Week 15)
**Learning Objectives**: Security best practices, rate limiting, secrets management  
**Deliverables**: External Secrets Operator, Network Policies, WAF rules  
**Skills**: AWS Secrets Manager, cert-manager, Istio basics

### Phase 10 — Monitoring & Optimization (Week 16)
**Learning Objectives**: Observability, alerting, cost optimization  
**Deliverables**: Grafana dashboards, Prometheus alerts, LLM cost tracking  
**Skills**: OpenTelemetry, Prometheus, Grafana, Loki, RAGAS evaluation

---

## 15. Production Considerations

### Scalability
- All services stateless → horizontal scaling via HPA (CPU + memory triggers)
- Agent service scales independently from RAG service
- pgvector HNSW index supports millions of vectors with sub-100ms ANN search
- Redis Cluster for session memory and query caching

### High Availability
- EKS node groups across 3 AZs
- RDS Multi-AZ with automatic failover (~30s)
- ElastiCache Cluster mode with 3 primary nodes
- PodDisruptionBudget: `minAvailable: 1` for all critical services

### Fault Tolerance
- Circuit breakers at API Gateway level (timeout + retry with backoff)
- Graceful degradation: RAG falls back to keyword-only if vector service unavailable
- Agent timeout: 60s hard limit with meaningful error message

### Disaster Recovery
- RDS automated backups (30-day retention) + point-in-time recovery
- S3 versioning enabled for document recovery
- Terraform state in S3 with DynamoDB lock for infra recovery
- RPO: 1 hour, RTO: 30 minutes

### Cost Optimization
- Spot instances for non-critical agent service workers (60-70% savings)
- GPU nodes scale to 0 when no embedding jobs (Cluster Autoscaler)
- CloudFront caching for static Next.js assets
- LLM cost: prefer Claude Haiku for routing, Claude Sonnet for complex tasks

### Multi-Tenancy
- Row-level tenant isolation via `tenant_id` FK + enforced DB filters
- Per-tenant rate limits in Redis
- Tenant-scoped pgvector search (no cross-tenant data)
- Tenant-specific prompt templates and model configuration

### Data Governance
- PII detection before embedding (presidio or AWS Comprehend)
- Document retention policies per tenant (TTL on S3 objects)
- GDPR: data deletion cascade (user → conversations → messages → chunks)
- SOC2 audit trail via immutable `audit_logs` table
