import { apiError, apiResponse } from '@/lib/api'
import { getUserByEmail } from '@/lib/queries'
import { verifyPassword, signToken } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return apiError(400, 'email and password are required')
    }

    const user = getUserByEmail(email)
    if (!user || !verifyPassword(password, user.password_hash)) {
      return apiError(401, 'Invalid email or password')
    }

    if (user.status === 'deactivated') {
      return apiError(403, 'Account deactivated')
    }

    const token = signToken({ sub: user.id, email: user.email, role: user.role, name: user.name })

    const { password_hash: _, ...safeUser } = user
    const response = apiResponse({ user: safeUser, token })
    response.headers.set(
      'Set-Cookie',
      `token=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
    )
    return response
  } catch (err) {
    console.error('[login]', err)
    return apiError(500, 'Internal server error')
  }
}
