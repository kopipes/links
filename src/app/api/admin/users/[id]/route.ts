import { apiError, apiResponse, getUser } from '@/lib/api'
import { getUserById, updateUser } from '@/lib/queries'
import { hashPassword } from '@/lib/auth'
import type { Role } from '@/types'

export async function GET(
  request: Request,
  ctx: RouteContext<'/api/admin/users/[id]'>
) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')
  if (user.role !== 'admin') return apiError(403, 'Forbidden')

  const { id } = await ctx.params
  const target = getUserById(Number(id))
  if (!target) return apiError(404, 'User not found')
  return apiResponse(target)
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<'/api/admin/users/[id]'>
) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')
  if (user.role !== 'admin') return apiError(403, 'Forbidden')

  const { id } = await ctx.params
  const body = await request.json()
  const { name, email, password, role, division_id, status } = body

  const updateData: Parameters<typeof updateUser>[1] = {}
  if (name !== undefined) updateData.name = name
  if (email !== undefined) updateData.email = email.toLowerCase()
  if (password) updateData.password_hash = hashPassword(password)
  if (role !== undefined) updateData.role = role as Role
  if (division_id !== undefined) updateData.division_id = division_id
  if (status !== undefined) updateData.status = status

  const updated = updateUser(Number(id), updateData)
  if (!updated) return apiError(404, 'User not found')
  return apiResponse(updated)
}
