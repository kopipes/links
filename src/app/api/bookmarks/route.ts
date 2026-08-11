import { apiError, apiResponse, getUser, requireUser, ApiError } from '@/lib/api'
import { getBookmarks, createBookmark } from '@/lib/bookmark-queries'

export async function GET(request: Request) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')

  const { searchParams } = new URL(request.url)
  const result = getBookmarks({
    userId: user.sub,
    q: searchParams.get('q') ?? undefined,
    category_id: searchParams.get('category_id') ? Number(searchParams.get('category_id')) : undefined,
    favorites_only: searchParams.get('favorites_only') === 'true',
    cursor: searchParams.get('cursor') ? Number(searchParams.get('cursor')) : undefined,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 30,
  })
  return apiResponse(result)
}

export async function POST(request: Request) {
  try {
    const user = requireUser(request)
    const body = await request.json()
    const { title, url, description, category_id } = body
    if (!title?.trim()) return apiError(400, 'title is required')
    if (!url?.trim()) return apiError(400, 'url is required')
    const bookmark = createBookmark({
      title: title.trim(),
      url: url.trim(),
      description: description?.trim() ?? undefined,
      category_id: category_id ?? null,
      created_by: user.sub,
    })
    return apiResponse(bookmark, 201)
  } catch (err) {
    if (err instanceof ApiError) return apiError(err.status, err.message)
    return apiError(500, 'Internal server error')
  }
}
