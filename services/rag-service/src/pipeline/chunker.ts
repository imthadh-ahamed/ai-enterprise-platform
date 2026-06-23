interface ChunkOptions {
  chunkSize: number
  chunkOverlap: number
  sourceType: string
}

interface TextChunk {
  content: string
  pageNumber: number
  chunkIndex: number
  metadata: Record<string, unknown>
}

export function chunkDocument(content: string, options: ChunkOptions): TextChunk[] {
  const { chunkSize, chunkOverlap } = options
  const chunks: TextChunk[] = []

  // Split by paragraphs first, then by sentences, fall back to character window
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0)
  let currentChunk = ''
  let chunkIndex = 0
  let estimatedPage = 1
  let charCount = 0

  for (const paragraph of paragraphs) {
    // Estimate page number (~3000 chars per page)
    estimatedPage = Math.floor(charCount / 3000) + 1

    if ((currentChunk + paragraph).length > chunkSize && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        pageNumber: estimatedPage,
        chunkIndex: chunkIndex++,
        metadata: { charCount: currentChunk.length },
      })

      // Overlap: keep last N chars of previous chunk
      const words = currentChunk.split(' ')
      const overlapWords = words.slice(-Math.floor(chunkOverlap / 5))
      currentChunk = overlapWords.join(' ') + ' ' + paragraph
    } else {
      currentChunk = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph
    }

    charCount += paragraph.length
  }

  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      pageNumber: estimatedPage,
      chunkIndex: chunkIndex++,
      metadata: { charCount: currentChunk.length },
    })
  }

  return chunks
}
