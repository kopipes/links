import { apiError, apiResponse, getUser, requireUser, ApiError } from '@/lib/api'
import { getReminders, createReminder } from '@/lib/reminder-queries'
import type { ReminderType, ReminderStatus } from '@/lib/reminder-queries'

export async function GET(request: Request) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')

  const { searchParams } = new URL(request.url)
  const reminders = getReminders({
    status: searchParams.get('status') as ReminderStatus ?? undefined,
    type: searchParams.get('type') as ReminderType ?? undefined,
  })
  return apiResponse(reminders)
}

export async function POST(request: Request) {
  try {
    const user = requireUser(request)
    if (user.role !== 'admin' && user.role !== 'curator') return apiError(403, 'Forbidden')

    const { name, type, expires_at, notes } = await request.json()
    if (!name?.trim()) return apiError(400, 'name is required')
    if (!expires_at) return apiError(400, 'expires_at is required')

    const reminder = createReminder({
      name: name.trim(),
      type: type ?? 'other',
      expires_at,
      notes: notes?.trim() || null,
      created_by: user.sub,
    })
    return apiResponse(reminder, 201)
  } catch (err) {
    if (err instanceof ApiError) return apiError(err.status, err.message)
    return apiError(500, 'Internal server error')
  }
}
