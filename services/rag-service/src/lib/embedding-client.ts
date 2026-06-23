import OpenAI from 'openai'
import { logger } from './logger'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

class EmbeddingClient {
  private readonly model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'

  async embed(text: string): Promise<number[]> {
    const res = await openai.embeddings.create({ model: this.model, input: text })
    return res.data[0].embedding
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []
    logger.debug({ count: texts.length }, 'Embedding batch')
    const res = await openai.embeddings.create({ model: this.model, input: texts })
    return res.data.map(d => d.embedding)
  }
}

export const embeddingClient = new EmbeddingClient()
