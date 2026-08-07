import { apiError, apiResponse, getUser } from '@/lib/api'
import { listUsers, createUser, updateUser } from '@/lib/queries'
import { hashPassword } from '@/lib/auth'
import type { Role } from '@/types'

export async function GET(request: Request) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')
  if (user.role !== 'admin') return apiError(403, 'Forbidden')

  const { searchParams } = new URL(request.url)
  const params = {
    division_id: searchParams.get('division_id') ? Number(searchParams.get('division_id')) : undefined,
    status: searchParams.get('status') ?? undefined,
    role: (searchParams.get('role') as Role) ?? undefined,
  }

  return apiResponse(listUsers(params))
}

export async function POST(request: Request) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')
  if (user.role !== 'admin') return apiError(403, 'Forbidden')

  const body = await request.json()
  const { name, email, password, role, division_id } = body

  if (!name?.trim() || !email?.trim() || !password) {
    return apiError(400, 'name, email and password are required')
  }
  if (password.length < 8) return apiError(400, 'Password must be at least 8 characters')

  try {
    const newUser = createUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password_hash: hashPassword(password),
      role: role ?? 'user',
      division_id: division_id ?? null,
    })
    return apiResponse(newUser, 201)
  } catch (err: any) {
    if (err?.message?.includes('UNIQUE')) return apiError(409, 'Email already registered')
    return apiError(500, 'Internal server error')
  }
}
