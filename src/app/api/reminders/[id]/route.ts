import { apiError, apiResponse, getUser, requireUser, ApiError } from '@/lib/api'
import { getReminderById, updateReminder, setReminderDone, setReminderActive, deleteReminder } from '@/lib/reminder-queries'

export async function GET(request: Request, ctx: RouteContext<'/api/reminders/[id]'>) {
  const user = getUser(request)
  if (!user) return apiError(401, 'Unauthorized')
  const { id } = await ctx.params
  const reminder = getReminderById(Number(id))
  if (!reminder) return apiError(404, 'Reminder not found')
  return apiResponse(reminder)
}

export async function PATCH(request: Request, ctx: RouteContext<'/api/reminders/[id]'>) {
  try {
    const user = requireUser(request)
    if (user.role !== 'admin' && user.role !== 'curator') return apiError(403, 'Forbidden')

    const { id } = await ctx.params
    const body = await request.json()
    const { action, ...data } = body

    if (action === 'done') {
      const updated = setReminderDone(Number(id), user.sub)
      if (!updated) return apiError(404, 'Reminder not found')
      return apiResponse(updated)
    }

    if (action === 'reopen') {
      const updated = setReminderActive(Number(id), user.sub)
      if (!updated) return apiError(404, 'Reminder not found')
      return apiResponse(updated)
    }

    const updated = updateReminder(Number(id), { ...data, updated_by: user.sub })
    if (!updated) return apiError(404, 'Reminder not found')
    return apiResponse(updated)
  } catch (err) {
    if (err instanceof ApiError) return apiError(err.status, err.message)
    return apiError(500, 'Internal server error')
  }
}

export async function DELETE(request: Request, ctx: RouteContext<'/api/reminders/[id]'>) {
  try {
    const user = requireUser(request)
    if (user.role !== 'admin') return apiError(403, 'Only admins can delete reminders')
    const { id } = await ctx.params
    deleteReminder(Number(id))
    return apiResponse({ ok: true })
  } catch (err) {
    if (err instanceof ApiError) return apiError(err.status, err.message)
    return apiError(500, 'Internal server error')
  }
}
