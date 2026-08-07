import { apiError, apiResponse, getUser } from '@/lib/api'
import { updateCategory, deleteCategory } from '@/lib/queries'

export async function PATCH(
  request: Request,
  ctx: RouteContext<'/api/categories/[id]'>
) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')
  if (user.role !== 'admin') return apiError(403, 'Forbidden')

  const { id } = await ctx.params
  const { name } = await request.json()
  if (!name?.trim()) return apiError(400, 'name is required')

  const updated = updateCategory(Number(id), name.trim())
  if (!updated) return apiError(404, 'Category not found')
  return apiResponse(updated)
}

export async function DELETE(
  request: Request,
  ctx: RouteContext<'/api/categories/[id]'>
) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')
  if (user.role !== 'admin') return apiError(403, 'Forbidden')

  const { id } = await ctx.params
  deleteCategory(Number(id))
  return apiResponse({ ok: true })
}
