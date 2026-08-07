import { apiError, apiResponse, getUser } from '@/lib/api'
import { getUserById } from '@/lib/queries'
import { verifyPassword, hashPassword } from '@/lib/auth'
import { getDb } from '@/lib/db'

export async function POST(request: Request) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')

  const body = await request.json()
  const { current_password, new_password } = body

  if (!current_password || !new_password) {
    return apiError(400, 'current_password and new_password are required')
  }
  if (new_password.length < 8) {
    return apiError(400, 'New password must be at least 8 characters')
  }

  const db = getDb()
  const row = db
    .prepare('SELECT password_hash FROM users WHERE id = ?')
    .get(user.sub) as { password_hash: string } | undefined

  if (!row) return apiError(404, 'User not found')
  if (!verifyPassword(current_password, row.password_hash)) {
    return apiError(400, 'Current password is incorrect')
  }

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
    hashPassword(new_password),
    user.sub
  )

  return apiResponse({ ok: true })
}
