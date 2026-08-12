import { apiError, apiResponse, getUser, requireUser, ApiError } from '@/lib/api'
import { getNoteById, updateNote, deleteNote } from '@/lib/note-queries'

export async function GET(request: Request, ctx: RouteContext<'/api/notes/[id]'>) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')
  const { id } = await ctx.params
  const note = getNoteById(Number(id))
  if (!note) return apiError(404, 'Note not found')
  return apiResponse(note)
}

export async function PATCH(request: Request, ctx: RouteContext<'/api/notes/[id]'>) {
  try {
    const user = requireUser(request)
    const { id } = await ctx.params
    const { title, body } = await request.json()
    const updated = updateNote(Number(id), { title, body, updated_by: user.sub })
    if (!updated) return apiError(404, 'Note not found')
    return apiResponse(updated)
  } catch (err) {
    if (err instanceof ApiError) return apiError(err.status, err.message)
    return apiError(500, 'Internal server error')
  }
}

export async function DELETE(request: Request, ctx: RouteContext<'/api/notes/[id]'>) {
  try {
    const user = requireUser(request)
    const { id } = await ctx.params
    deleteNote(Number(id))
    return apiResponse({ ok: true })
  } catch (err) {
    if (err instanceof ApiError) return apiError(err.status, err.message)
    return apiError(500, 'Internal server error')
  }
}
