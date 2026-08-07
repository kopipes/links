import { NextResponse } from 'next/server'
import type { JwtPayload, Role } from '@/types'

/** Read injected user from request headers (set by middleware) */
export function getUser(request: Request): JwtPayload | null {
  const id = request.headers.get('x-user-id')
  const role = request.headers.get('x-user-role') as Role | null
  const email = request.headers.get('x-user-email')
  const name = request.headers.get('x-user-name')
  if (!id || !role || !email || !name) return null
  return { sub: Number(id), role, email, name }
}

export function requireUser(request: Request): JwtPayload {
  const user = getUser(request)
  if (!user) throw new ApiError(401, 'Unauthorized')
  return user
}

export function requireMinRole(request: Request, minRole: Role): JwtPayload {
  const user = requireUser(request)
  const rank: Record<Role, number> = { user: 0, curator: 1, admin: 2 }
  if (rank[user.role] < rank[minRole]) {
    throw new ApiError(403, 'Forbidden')
  }
  return user
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export function apiResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status })
}

export function apiError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status })
}


