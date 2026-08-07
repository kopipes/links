import { apiError, apiResponse, requireUser, ApiError } from '@/lib/api'
import { getEntryById, setEntryStatus } from '@/lib/queries'
import { canManageEntry } from '@/lib/auth'

export async function POST(
  request: Request,
  ctx: RouteContext<'/api/entries/[id]/restore'>
) {
  try {
    const user = requireUser(request)
    if (user.role === 'user') return apiError(403, 'Forbidden')

    const { id } = await ctx.params
    const entryId = Number(id)
    if (isNaN(entryId)) return apiError(400, 'Invalid entry id')

    const existing = getEntryById(entryId, user.sub, true)
    if (!existing) return apiError(404, 'Entry not found')
    if (existing.status !== 'archived') return apiError(400, 'Entry is not archived')

    setEntryStatus(entryId, 'active', user.sub)
    return apiResponse({ ok: true })
  } catch (err) {
    if (err instanceof ApiError) return apiError(err.status, err.message)
    return apiError(500, 'Internal server error')
  }
}
