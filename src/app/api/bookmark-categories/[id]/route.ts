import { apiError, apiResponse, getUser } from '@/lib/api'
import { updateBookmarkCategory, deleteBookmarkCategory } from '@/lib/bookmark-queries'

export async function PATCH(request: Request, ctx: RouteContext<'/api/bookmark-categories/[id]'>) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')
  const { id } = await ctx.params
  const { name, color } = await request.json()
  if (!name?.trim()) return apiError(400, 'name is required')
  const updated = updateBookmarkCategory(Number(id), name.trim(), color ?? '#6366f1')
  if (!updated) return apiError(404, 'Category not found')
  return apiResponse(updated)
}

export async function DELETE(request: Request, ctx: RouteContext<'/api/bookmark-categories/[id]'>) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')
  const { id } = await ctx.params
  deleteBookmarkCategory(Number(id))
  return apiResponse({ ok: true })
}
