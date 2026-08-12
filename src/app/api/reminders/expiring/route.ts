import { apiError, apiResponse, getUser } from '@/lib/api'
import { getExpiringReminders } from '@/lib/reminder-queries'

export async function GET(request: Request) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')
  return apiResponse(getExpiringReminders())
}
