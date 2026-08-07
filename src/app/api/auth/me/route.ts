import { apiError, apiResponse } from '@/lib/api'
import { getUser } from '@/lib/api'
import { getUserById } from '@/lib/queries'

export async function GET(request: Request) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')
  const full = getUserById(user.sub)
  if (!full) return apiError(404, 'User not found')
  return apiResponse(full)
}
