import { apiError, apiResponse, getUser, requireUser, ApiError } from '@/lib/api'
import { getEntryById, updateEntry, setEntryStatus, hardDeleteEntry } from '@/lib/queries'
import { canManageEntry } from '@/lib/auth'

export async function GET(
  request: Request,
  ctx: RouteContext<'/api/entries/[id]'>
) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')

  const { id } = await ctx.params
  const entryId = Number(id)
  if (isNaN(entryId)) return apiError(400, 'Invalid entry id')

  const isPrivileged = user.role === 'admin' || user.role === 'curator'
  const entry = getEntryById(entryId, user.sub, isPrivileged)
  if (!entry) return apiError(404, 'Entry not found')

  return apiResponse(entry)
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<'/api/entries/[id]'>
) {
  try {
    const user = requireUser(request)
    const { id } = await ctx.params
    const entryId = Number(id)
    if (isNaN(entryId)) return apiError(400, 'Invalid entry id')

    const isPrivileged = user.role === 'admin' || user.role === 'curator'
    const existing = getEntryById(entryId, user.sub, true)
    if (!existing) return apiError(404, 'Entry not found')
    if (!canManageEntry(user, existing.created_by)) return apiError(403, 'Forbidden')

    const body = await request.json()
    const updated = updateEntry(entryId, { ...body, updated_by: user.sub }, isPrivileged)
    if (!updated) return apiError(404, 'Entry not found')

    return apiResponse(updated)
  } catch (err) {
    if (err instanceof ApiError) return apiError(err.status, err.message)
    console.error('[PATCH /api/entries/[id]]', err)
    return apiError(500, 'Internal server error')
  }
}

export async function DELETE(
  request: Request,
  ctx: RouteContext<'/api/entries/[id]'>
) {
  try {
    const user = requireUser(request)
    const { id } = await ctx.params
    const entryId = Number(id)
    if (isNaN(entryId)) return apiError(400, 'Invalid entry id')

    const { searchParams } = new URL(request.url)
    const hard = searchParams.get('hard') === 'true'

    if (hard && user.role !== 'admin') return apiError(403, 'Only admins can hard-delete entries')

    const existing = getEntryById(entryId, user.sub, true)
    if (!existing) return apiError(404, 'Entry not found')
    if (!canManageEntry(user, existing.created_by)) return apiError(403, 'Forbidden')

    if (hard) {
      hardDeleteEntry(entryId)
    } else {
      setEntryStatus(entryId, 'archived', user.sub)
    }

    return apiResponse({ ok: true })
  } catch (err) {
    if (err instanceof ApiError) return apiError(err.status, err.message)
    console.error('[DELETE /api/entries/[id]]', err)
    return apiError(500, 'Internal server error')
  }
}
