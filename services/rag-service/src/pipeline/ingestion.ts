import { db } from '../lib/db'
import { embeddingClient } from '../lib/embedding-client'
import { chunkDocument } from './chunker'
import { enrichMetadata } from './metadata-enricher'
import { logger } from '../lib/logger'
import { v4 as uuidv4 } from 'uuid'

interface IngestionJob {
  documentId: string
  tenantId: string
  content: string
  title: string
  sourceType: 'pdf' | 'docx' | 'xlsx' | 'txt' | 'md' | 'csv'
  metadata?: Record<string, unknown>
}

export async function ingestDocument(job: IngestionJob): Promise<void> {
  logger.info({ documentId: job.documentId }, 'Starting document ingestion')

  await db.query(
    `UPDATE documents SET status = 'processing' WHERE id = $1`,
    [job.documentId],
  )

  try {
    // 1. Chunk the document
    const chunks = chunkDocument(job.content, {
      chunkSize: Number(process.env.RAG_CHUNK_SIZE) || 512,
      chunkOverlap: Number(process.env.RAG_CHUNK_OVERLAP) || 64,
      sourceType: job.sourceType,
    })

    logger.info({ documentId: job.documentId, chunkCount: chunks.length }, 'Document chunked')

    // 2. Enrich metadata per chunk
    const enrichedChunks = await enrichMetadata(chunks, job)

    // 3. Generate embeddings in batches
    const batchSize = Number(process.env.EMBEDDING_BATCH_SIZE) || 32
    for (let i = 0; i < enrichedChunks.length; i += batchSize) {
      const batch = enrichedChunks.slice(i, i + batchSize)
      const embeddings = await embeddingClient.embedBatch(batch.map(c => c.content))

      // 4. Upsert chunks + embeddings
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j]
        const embedding = embeddings[j]

        await db.query(
          `INSERT INTO document_chunks
             (id, document_id, tenant_id, content, embedding, page_number, chunk_index, metadata, fts_vector)
           VALUES
             ($1, $2, $3, $4, $5::vector, $6, $7, $8, to_tsvector('english', $4))
           ON CONFLICT (id) DO UPDATE SET
             content = EXCLUDED.content,
             embedding = EXCLUDED.embedding,
             updated_at = NOW()`,
          [
            uuidv4(),
            job.documentId,
            job.tenantId,
            chunk.content,
            `[${embedding.join(',')}]`,
            chunk.pageNumber,
            chunk.chunkIndex,
            JSON.stringify({ ...job.metadata, ...chunk.metadata }),
          ],
        )
      }

      logger.info({ documentId: job.documentId, batch: i / batchSize + 1 }, 'Batch embedded')
    }

    await db.query(
      `UPDATE documents SET status = 'active', chunk_count = $2 WHERE id = $1`,
      [job.documentId, enrichedChunks.length],
    )

    logger.info({ documentId: job.documentId }, 'Document ingestion complete')
  } catch (err) {
    logger.error({ err, documentId: job.documentId }, 'Ingestion failed')
    await db.query(
      `UPDATE documents SET status = 'failed', error = $2 WHERE id = $1`,
      [job.documentId, (err as Error).message],
    )
    throw err
  }
}
