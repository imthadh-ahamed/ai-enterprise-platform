import { z } from 'zod'
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { MCPTool } from '../registry/tool-registry'

const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' })

export const s3Tools: MCPTool[] = [
  {
    name: 'list_s3_files',
    description: 'List files in an S3 bucket with an optional prefix',
    inputSchema: z.object({
      bucket: z.string().default(process.env.S3_BUCKET_NAME || ''),
      prefix: z.string().optional().default(''),
      maxKeys: z.number().int().min(1).max(1000).default(100),
    }),
    handler: async (params) => {
      const p = params as { bucket: string; prefix: string; maxKeys: number }
      const result = await s3.send(new ListObjectsV2Command({ Bucket: p.bucket, Prefix: p.prefix, MaxKeys: p.maxKeys }))
      return {
        files: result.Contents?.map(o => ({ key: o.Key, size: o.Size, lastModified: o.LastModified })),
        count: result.KeyCount,
        truncated: result.IsTruncated,
      }
    },
  },
  {
    name: 'get_s3_file_url',
    description: 'Get a presigned download URL for an S3 file',
    inputSchema: z.object({
      bucket: z.string().default(process.env.S3_BUCKET_NAME || ''),
      key: z.string(),
      expiresIn: z.number().int().min(60).max(3600).default(900),
    }),
    handler: async (params) => {
      const p = params as { bucket: string; key: string; expiresIn: number }
      const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: p.bucket, Key: p.key }), { expiresIn: p.expiresIn })
      return { url, expiresIn: p.expiresIn }
    },
  },
]
