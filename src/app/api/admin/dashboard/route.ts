import { apiError, apiResponse, getUser } from '@/lib/api'
import { getAdminStats, getBrokenLinks } from '@/lib/queries'

export async function GET(request: Request) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')
  if (user.role !== 'admin') return apiError(403, 'Forbidden')

  const stats = getAdminStats()
  const brokenLinks = getBrokenLinks()
  return apiResponse({ stats, brokenLinks })
}
