interface RawChunk {
  content: string
  pageNumber: number
  chunkIndex: number
  metadata: Record<string, unknown>
}

interface EnrichedChunk extends RawChunk {
  wordCount: number
  charCount: number
}

interface IngestionJob {
  documentId: string
  tenantId: string
  title: string
  sourceType: string
  metadata?: Record<string, unknown>
}

export function enrichMetadata(chunks: RawChunk[], job: IngestionJob): EnrichedChunk[] {
  return chunks.map(chunk => ({
    ...chunk,
    wordCount: chunk.content.split(/\s+/).length,
    charCount: chunk.content.length,
    metadata: {
      ...chunk.metadata,
      documentId: job.documentId,
      tenantId: job.tenantId,
      sourceType: job.sourceType,
      documentTitle: job.title,
      ...job.metadata,
    },
  }))
}
