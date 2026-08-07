import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import type { JwtPayload, Role } from '@/types'

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production'
const JWT_EXPIRES_IN = '7d'
const BCRYPT_ROUNDS = 12

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS)
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash)
}

export function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as unknown as JwtPayload
  } catch {
    return null
  }
}

export function extractToken(request: Request): string | null {
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7)
  }
  // Also check cookie
  const cookie = request.headers.get('cookie')
  if (cookie) {
    const match = cookie.match(/(?:^|;\s*)token=([^;]+)/)
    if (match) return match[1]
  }
  return null
}

export function getRequestUser(request: Request): JwtPayload | null {
  const token = extractToken(request)
  if (!token) return null
  return verifyToken(token)
}

export function requireRole(user: JwtPayload | null, ...roles: Role[]): boolean {
  if (!user) return false
  return roles.includes(user.role)
}

/** Returns true if user can edit/delete the given entry */
export function canManageEntry(
  user: JwtPayload,
  entryCreatedBy: number
): boolean {
  if (user.role === 'admin' || user.role === 'curator') return true
  return user.sub === entryCreatedBy
}
