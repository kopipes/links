import { apiError, apiResponse, getUser } from '@/lib/api'
import { updateLinkStatus } from '@/lib/queries'
import { getDb } from '@/lib/db'

export async function PATCH(
  request: Request,
  ctx: RouteContext<'/api/entries/[id]/links/[linkId]/status'>
) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')
  if (user.role === 'user') return apiError(403, 'Forbidden')

  const { id, linkId } = await ctx.params
  const entryId = Number(id)
  const linkIdNum = Number(linkId)
  if (isNaN(entryId) || isNaN(linkIdNum)) return apiError(400, 'Invalid id')

  const body = await request.json()
  const { status } = body
  if (status !== 'ok' && status !== 'broken' && status !== 'unchecked') {
    return apiError(400, 'status must be ok, broken, or unchecked')
  }

  // Verify the link belongs to this entry
  const db = getDb()
  const link = db
    .prepare('SELECT id FROM entry_links WHERE id = ? AND entry_id = ?')
    .get(linkIdNum, entryId)
  if (!link) return apiError(404, 'Link not found')

  updateLinkStatus(linkIdNum, status)
  return apiResponse({ ok: true })
}
