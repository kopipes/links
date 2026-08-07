import { apiError, apiResponse } from '@/lib/api'
import { getUserByEmail, createUser } from '@/lib/queries'
import { hashPassword, verifyPassword, signToken } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, name } = body

    if (!email || !password || !name) {
      return apiError(400, 'name, email and password are required')
    }
    if (password.length < 8) {
      return apiError(400, 'Password must be at least 8 characters')
    }

    const existing = getUserByEmail(email)
    if (existing) {
      return apiError(409, 'Email already registered')
    }

    const user = createUser({
      name,
      email,
      password_hash: hashPassword(password),
    })

    const token = signToken({ sub: user.id, email: user.email, role: user.role, name: user.name })

    const response = apiResponse({ user, token })
    response.headers.set(
      'Set-Cookie',
      `token=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
    )
    return response
  } catch (err) {
    console.error('[register]', err)
    return apiError(500, 'Internal server error')
  }
}
