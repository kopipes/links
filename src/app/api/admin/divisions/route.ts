import { apiError, apiResponse, getUser } from '@/lib/api'
import { getAllDivisions, createDivision, updateDivision, deleteDivision } from '@/lib/queries'

export async function GET(request: Request) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')
  return apiResponse(getAllDivisions())
}

export async function POST(request: Request) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')
  if (user.role !== 'admin') return apiError(403, 'Forbidden')

  const { name, description } = await request.json()
  if (!name?.trim()) return apiError(400, 'name is required')

  try {
    const division = createDivision(name.trim(), description?.trim())
    return apiResponse(division, 201)
  } catch (err: any) {
    if (err?.message?.includes('UNIQUE')) return apiError(409, 'Division already exists')
    return apiError(500, 'Internal server error')
  }
}
