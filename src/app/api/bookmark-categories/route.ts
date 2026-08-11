import { apiError, apiResponse, getUser } from '@/lib/api'
import { getBookmarkCategories, createBookmarkCategory, updateBookmarkCategory, deleteBookmarkCategory } from '@/lib/bookmark-queries'

export async function GET(request: Request) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')
  return apiResponse(getBookmarkCategories())
}

export async function POST(request: Request) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')

  const { name, color } = await request.json()
  if (!name?.trim()) return apiError(400, 'name is required')

  try {
    const cat = createBookmarkCategory(name.trim(), color ?? '#6366f1', user.sub)
    return apiResponse(cat, 201)
  } catch (err: any) {
    if (err?.message?.includes('UNIQUE')) return apiError(409, 'Category already exists')
    return apiError(500, 'Internal server error')
  }
}
