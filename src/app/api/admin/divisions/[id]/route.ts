import { apiError, apiResponse, getUser } from '@/lib/api'
import { updateDivision, deleteDivision } from '@/lib/queries'

export async function PATCH(
  request: Request,
  ctx: RouteContext<'/api/admin/divisions/[id]'>
) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')
  if (user.role !== 'admin') return apiError(403, 'Forbidden')

  const { id } = await ctx.params
  const { name, description } = await request.json()
  if (!name?.trim()) return apiError(400, 'name is required')

  const updated = updateDivision(Number(id), name.trim(), description?.trim())
  if (!updated) return apiError(404, 'Division not found')
  return apiResponse(updated)
}

export async function DELETE(
  request: Request,
  ctx: RouteContext<'/api/admin/divisions/[id]'>
) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')
  if (user.role !== 'admin') return apiError(403, 'Forbidden')

  const { id } = await ctx.params
  deleteDivision(Number(id))
  return apiResponse({ ok: true })
}
