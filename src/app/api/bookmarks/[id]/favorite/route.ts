import { apiError, apiResponse, requireUser, ApiError } from '@/lib/api'
import { toggleBookmarkFavorite } from '@/lib/bookmark-queries'

export async function POST(request: Request, ctx: RouteContext<'/api/bookmarks/[id]/favorite'>) {
  try {
    const user = requireUser(request)
    const { id } = await ctx.params
    const favorited = toggleBookmarkFavorite(user.sub, Number(id))
    return apiResponse({ favorited })
  } catch (err) {
    if (err instanceof ApiError) return apiError(err.status, err.message)
    return apiError(500, 'Internal server error')
  }
}
