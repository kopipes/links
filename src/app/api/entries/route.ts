import { apiError, apiResponse, getUser, requireUser, ApiError } from '@/lib/api'
import { getEntries, createEntry, checkDuplicateUrl } from '@/lib/queries'
import type { SearchParams } from '@/types'

export async function GET(request: Request) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')

  const isPrivileged = user.role === 'admin' || user.role === 'curator'
  const { searchParams } = new URL(request.url)

  const params: SearchParams = {
    q: searchParams.get('q') ?? undefined,
    category_id: searchParams.get('category_id') ? Number(searchParams.get('category_id')) : undefined,
    tag: searchParams.get('tag') ?? undefined,
    sort: (searchParams.get('sort') as SearchParams['sort']) ?? 'recent',
    cursor: searchParams.get('cursor') ? Number(searchParams.get('cursor')) : undefined,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 20,
    status: (searchParams.get('status') as SearchParams['status']) ?? undefined,
    favorites_only: searchParams.get('favorites_only') === 'true',
  }

  const result = getEntries(params, user.sub, isPrivileged)
  return apiResponse(result)
}

export async function POST(request: Request) {
  try {
    const user = requireUser(request)
    const isPrivileged = user.role === 'admin' || user.role === 'curator'
    const body = await request.json()

    const { title, description, category_ids, links, tags } = body

    if (!title?.trim()) return apiError(400, 'title is required')
    if (!Array.isArray(links) || links.length === 0) return apiError(400, 'at least one link is required')

    for (const link of links) {
      if (!link.url?.trim()) return apiError(400, 'each link must have a url')
      if (!link.label?.trim()) return apiError(400, 'each link must have a label')
    }

    const entry = createEntry(
      {
        title: title.trim(),
        description: description?.trim() ?? undefined,
        category_ids: Array.isArray(category_ids) ? category_ids : [],
        created_by: user.sub,
        links,
        tags: Array.isArray(tags) ? tags : [],
      },
      isPrivileged
    )

    return apiResponse(entry, 201)
  } catch (err) {
    if (err instanceof ApiError) return apiError(err.status, err.message)
    console.error('[POST /api/entries]', err)
    return apiError(500, 'Internal server error')
  }
}
