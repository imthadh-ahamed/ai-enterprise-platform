import { CohereClient } from 'cohere-ai'
import { logger } from './logger'

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY })

interface Chunk {
  id: string
  content: string
  [key: string]: unknown
}

export async function rerankWithCohere<T extends Chunk>(
  query: string,
  chunks: T[],
  topN: number,
): Promise<T[]> {
  if (!process.env.COHERE_API_KEY || chunks.length === 0) {
    return chunks.slice(0, topN)
  }

  try {
    const response = await cohere.v2.rerank({
      model: 'rerank-v3.5',
      query,
      documents: chunks.map(c => c.content),
      topN,
    })

    return response.results
      .sort((a, b) => a.index - b.index)
      .map(result => ({
        ...chunks[result.index],
        score: result.relevanceScore,
      }))
  } catch (err) {
    logger.warn({ err }, 'Cohere rerank failed, using original ranking')
    return chunks.slice(0, topN)
  }
}
