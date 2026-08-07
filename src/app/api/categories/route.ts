import { apiError, apiResponse, getUser } from '@/lib/api'
import { getAllCategories, createCategory, updateCategory, deleteCategory } from '@/lib/queries'

export async function GET(request: Request) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')
  return apiResponse(getAllCategories())
}

export async function POST(request: Request) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')
  if (user.role !== 'admin') return apiError(403, 'Forbidden')

  const { name } = await request.json()
  if (!name?.trim()) return apiError(400, 'name is required')

  try {
    const category = createCategory(name.trim())
    return apiResponse(category, 201)
  } catch (err: any) {
    if (err?.message?.includes('UNIQUE')) return apiError(409, 'Category already exists')
    return apiError(500, 'Internal server error')
  }
}
