import { z } from 'zod'

export const UserRole = z.enum(['admin', 'manager', 'user', 'readonly'])
export type UserRole = z.infer<typeof UserRole>

export const UserSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: UserRole,
  avatarUrl: z.string().url().nullable(),
  isActive: z.boolean(),
  lastLoginAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type User = z.infer<typeof UserSchema>

export const TenantPlan = z.enum(['free', 'pro', 'enterprise'])
export type TenantPlan = z.infer<typeof TenantPlan>

export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  plan: TenantPlan,
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
})
export type Tenant = z.infer<typeof TenantSchema>
