import { apiError, apiResponse, requireUser, ApiError } from '@/lib/api'
import { toggleFavorite } from '@/lib/queries'

export async function POST(
  request: Request,
  ctx: RouteContext<'/api/entries/[id]/favorite'>
) {
  try {
    const user = requireUser(request)
    const { id } = await ctx.params
    const entryId = Number(id)
    if (isNaN(entryId)) return apiError(400, 'Invalid entry id')

    const favorited = toggleFavorite(user.sub, entryId)
    return apiResponse({ favorited })
  } catch (err) {
    if (err instanceof ApiError) return apiError(err.status, err.message)
    return apiError(500, 'Internal server error')
  }
}
