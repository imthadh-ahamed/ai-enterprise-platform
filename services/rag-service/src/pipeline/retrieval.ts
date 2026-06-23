import { db } from '../lib/db'
import { embeddingClient } from '../lib/embedding-client'
import { rerankWithCohere } from '../lib/reranker'
import { redis } from '../lib/redis'
import { logger } from '../lib/logger'
import crypto from 'crypto'

interface RetrievalParams {
  query: string
  tenantId: string
  topK: number
  rerankTopK: number
  filters?: Record<string, unknown>
}

interface Chunk {
  id: string
  content: string
  documentTitle: string
  documentId: string
  pageNumber: number
  score: number
  metadata: Record<string, unknown>
}

// Hybrid search: dense (vector) + sparse (full-text) with Reciprocal Rank Fusion
export async function retrieveChunks(params: RetrievalParams): Promise<Chunk[]> {
  const cacheKey = `rag:${params.tenantId}:${crypto.createHash('md5').update(params.query).digest('hex')}`
  const cached = await redis.get(cacheKey)
  if (cached) {
    logger.debug({ cacheKey }, 'RAG cache hit')
    return JSON.parse(cached)
  }

  const queryEmbedding = await embeddingClient.embed(params.query)

  // Parallel: vector search + full-text search
  const [vectorResults, ftsResults] = await Promise.all([
    vectorSearch(queryEmbedding, params),
    fullTextSearch(params),
  ])

  // Reciprocal Rank Fusion
  const fused = reciprocalRankFusion([vectorResults, ftsResults], params.topK)

  // Rerank with Cohere for higher precision
  const reranked = await rerankWithCohere(params.query, fused, params.rerankTopK)

  await redis.setex(cacheKey, 300, JSON.stringify(reranked)) // cache 5 min
  return reranked
}

async function vectorSearch(embedding: number[], params: RetrievalParams): Promise<Chunk[]> {
  const result = await db.query<Chunk & { distance: number }>(
    `SELECT
       c.id, c.content, c.page_number as "pageNumber", c.metadata,
       d.id as "documentId", d.title as "documentTitle",
       1 - (c.embedding <=> $1::vector) as score
     FROM document_chunks c
     JOIN documents d ON d.id = c.document_id
     WHERE d.tenant_id = $2
       AND d.status = 'active'
     ORDER BY c.embedding <=> $1::vector
     LIMIT $3`,
    [`[${embedding.join(',')}]`, params.tenantId, params.topK * 2],
  )
  return result.rows
}

async function fullTextSearch(params: RetrievalParams): Promise<Chunk[]> {
  const result = await db.query<Chunk & { rank: number }>(
    `SELECT
       c.id, c.content, c.page_number as "pageNumber", c.metadata,
       d.id as "documentId", d.title as "documentTitle",
       ts_rank(c.fts_vector, plainto_tsquery('english', $1)) as score
     FROM document_chunks c
     JOIN documents d ON d.id = c.document_id
     WHERE d.tenant_id = $2
       AND d.status = 'active'
       AND c.fts_vector @@ plainto_tsquery('english', $1)
     ORDER BY score DESC
     LIMIT $3`,
    [params.query, params.tenantId, params.topK * 2],
  )
  return result.rows
}

function reciprocalRankFusion(resultSets: Chunk[][], topK: number): Chunk[] {
  const k = 60
  const scores = new Map<string, { chunk: Chunk; score: number }>()

  for (const results of resultSets) {
    results.forEach((chunk, rank) => {
      const existing = scores.get(chunk.id)
      const rrfScore = 1 / (k + rank + 1)
      if (existing) {
        existing.score += rrfScore
      } else {
        scores.set(chunk.id, { chunk, score: rrfScore })
      }
    })
  }

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ chunk, score }) => ({ ...chunk, score }))
}
