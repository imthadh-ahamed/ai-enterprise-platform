import { logger } from './logger'

interface Chunk {
  id: string
  content: string
  documentTitle: string
  documentId: string
  pageNumber: number
  score: number
}

interface Citation {
  documentId: string
  documentTitle: string
  pageNumber: number
  excerpt: string
  score: number
}

interface RetrievalResult {
  chunks: Chunk[]
  citations: Citation[]
}

class RAGServiceClient {
  private readonly baseUrl: string

  constructor() {
    this.baseUrl = process.env.RAG_SERVICE_URL || 'http://rag-service:3003'
  }

  async retrieve(params: {
    query: string
    tenantId: string
    topK?: number
    rerankTopK?: number
  }): Promise<RetrievalResult> {
    const res = await fetch(`${this.baseUrl}/api/v1/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })

    if (!res.ok) {
      logger.error({ status: res.status }, 'RAG retrieval failed')
      return { chunks: [], citations: [] }
    }

    return res.json()
  }
}

export const ragServiceClient = new RAGServiceClient()
