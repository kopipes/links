import { apiResponse } from '@/lib/api'

export async function POST() {
  const response = apiResponse({ ok: true })
  response.headers.set(
    'Set-Cookie',
    'token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0'
  )
  return response
}
