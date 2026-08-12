import { apiError, apiResponse, getUser, requireUser, ApiError } from '@/lib/api'
import { getNotes, createNote } from '@/lib/note-queries'

export async function GET(request: Request) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') ?? undefined
  return apiResponse(getNotes(user.sub, q))
}

export async function POST(request: Request) {
  try {
    const user = requireUser(request)
    const { title, body } = await request.json()
    const note = createNote({
      title: title?.trim() || 'Untitled',
      body: body ?? '',
      created_by: user.sub,
    })
    return apiResponse(note, 201)
  } catch (err) {
    if (err instanceof ApiError) return apiError(err.status, err.message)
    return apiError(500, 'Internal server error')
  }
}
