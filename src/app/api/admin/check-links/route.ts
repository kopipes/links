import { apiError, apiResponse, getUser } from '@/lib/api'
import { getDb, indexEntry } from '@/lib/db'
import { updateLinkStatus } from '@/lib/queries'

const CHECK_TIMEOUT_MS = 8000

export async function POST(request: Request) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')
  if (user.role !== 'admin') return apiError(403, 'Forbidden')

  const db = getDb()

  // Get all active links not checked in the last 24 hours (or unchecked)
  const links = db
    .prepare(
      `SELECT el.id, el.url, el.entry_id
       FROM entry_links el
       JOIN entries e ON e.id = el.entry_id
       WHERE e.status = 'active'
         AND (el.last_checked_at IS NULL
              OR el.last_checked_at < datetime('now', '-1 day'))
       LIMIT 100`
    )
    .all() as { id: number; url: string; entry_id: number }[]

  let checked = 0
  let broken = 0

  for (const link of links) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS)
      const res = await fetch(link.url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
      }).catch(() => null)
      clearTimeout(timeout)

      const status = res && res.status < 400 ? 'ok' : 'broken'
      updateLinkStatus(link.id, status)
      if (status === 'broken') broken++
      checked++
    } catch {
      updateLinkStatus(link.id, 'broken')
      broken++
      checked++
    }
  }

  return apiResponse({ checked, broken })
}
