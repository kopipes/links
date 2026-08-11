import { apiError, apiResponse, getUser, requireUser, ApiError } from '@/lib/api'
import { getBookmarkById, updateBookmark, setBookmarkStatus, deleteBookmark } from '@/lib/bookmark-queries'

export async function GET(request: Request, ctx: RouteContext<'/api/bookmarks/[id]'>) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')
  const { id } = await ctx.params
  const bookmark = getBookmarkById(Number(id), user.sub)
  if (!bookmark) return apiError(404, 'Bookmark not found')
  return apiResponse(bookmark)
}

export async function PATCH(request: Request, ctx: RouteContext<'/api/bookmarks/[id]'>) {
  try {
    const user = requireUser(request)
    const { id } = await ctx.params
    const body = await request.json()
    const updated = updateBookmark(Number(id), body)
    if (!updated) return apiError(404, 'Bookmark not found')
    return apiResponse(updated)
  } catch (err) {
    if (err instanceof ApiError) return apiError(err.status, err.message)
    return apiError(500, 'Internal server error')
  }
}

export async function DELETE(request: Request, ctx: RouteContext<'/api/bookmarks/[id]'>) {
  try {
    const user = requireUser(request)
    const { id } = await ctx.params
    const hard = new URL(request.url).searchParams.get('hard') === 'true'
    if (hard && user.role !== 'admin') return apiError(403, 'Forbidden')
    if (hard) deleteBookmark(Number(id))
    else setBookmarkStatus(Number(id), 'archived')
    return apiResponse({ ok: true })
  } catch (err) {
    if (err instanceof ApiError) return apiError(err.status, err.message)
    return apiError(500, 'Internal server error')
  }
}
