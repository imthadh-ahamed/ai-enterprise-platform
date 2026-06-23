import { z } from 'zod'

export const DocumentSourceType = z.enum(['pdf', 'docx', 'xlsx', 'txt', 'md', 'csv', 'url'])
export type DocumentSourceType = z.infer<typeof DocumentSourceType>

export const DocumentStatus = z.enum(['pending', 'processing', 'active', 'failed'])
export type DocumentStatus = z.infer<typeof DocumentStatus>

export const DocumentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  uploadedBy: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  fileName: z.string(),
  fileSize: z.number().int().positive(),
  mimeType: z.string(),
  sourceType: DocumentSourceType,
  storageKey: z.string(),
  status: DocumentStatus,
  chunkCount: z.number().int(),
  tags: z.array(z.string()),
  metadata: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type Document = z.infer<typeof DocumentSchema>

export const CitationSchema = z.object({
  documentId: z.string().uuid(),
  documentTitle: z.string(),
  pageNumber: z.number().int(),
  excerpt: z.string(),
  score: z.number(),
})
export type Citation = z.infer<typeof CitationSchema>
