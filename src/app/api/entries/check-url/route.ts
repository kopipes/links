import { apiError, apiResponse, getUser } from '@/lib/api'
import { checkDuplicateUrl } from '@/lib/queries'

export async function GET(request: Request) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')

  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  if (!url) return apiError(400, 'url query param is required')

  const duplicate = checkDuplicateUrl(url)
  return apiResponse({ duplicate })
}
