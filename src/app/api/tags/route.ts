import { apiError, apiResponse, getUser } from '@/lib/api'
import { getAllTags, searchTags } from '@/lib/queries'

export async function GET(request: Request) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')

  if (q) return apiResponse(searchTags(q))
  return apiResponse(getAllTags())
}
