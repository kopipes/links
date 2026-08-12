import { getDb } from '@/lib/db'

export type ReminderType = 'domain' | 'hosting' | 'ssl' | 'subscription' | 'other'
export type ReminderStatus = 'active' | 'done'

export interface Reminder {
  id: number
  name: string
  type: ReminderType
  expires_at: string
  notes: string | null
  status: ReminderStatus
  created_by: number
  creator_name: string
  updated_by: number | null
  done_at: string | null
  created_at: string
  updated_at: string
  days_until: number
}

export const REMINDER_TYPES: { value: ReminderType; label: string; icon: string }[] = [
  { value: 'domain',       label: 'Domain',       icon: '🌐' },
  { value: 'hosting',      label: 'Hosting',      icon: '🖥️' },
  { value: 'ssl',          label: 'SSL',          icon: '🔒' },
  { value: 'subscription', label: 'Subscription', icon: '📋' },
  { value: 'other',        label: 'Other',        icon: '📅' },
]

function calcDaysUntil(expiresAt: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const exp = new Date(expiresAt)
  exp.setHours(0, 0, 0, 0)
  return Math.round((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function getReminders(params: { status?: ReminderStatus; type?: ReminderType } = {}): Reminder[] {
  const db = getDb()
  const conditions: string[] = []
  const args: (string | number)[] = []

  if (params.status) { conditions.push('r.status = ?'); args.push(params.status) }
  if (params.type) { conditions.push('r.type = ?'); args.push(params.type) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = db.prepare(
    `SELECT r.*, u.name as creator_name
     FROM reminders r LEFT JOIN users u ON u.id = r.created_by
     ${where}
     ORDER BY r.expires_at ASC`
  ).all(...args) as any[]

  return rows.map(r => ({ ...r, days_until: calcDaysUntil(r.expires_at) }))
}

export function getExpiringReminders(): Reminder[] {
  const db = getDb()
  // Active reminders expiring within 7 days (including already expired)
  const rows = db.prepare(
    `SELECT r.*, u.name as creator_name
     FROM reminders r LEFT JOIN users u ON u.id = r.created_by
     WHERE r.status = 'active'
       AND date(r.expires_at) <= date('now', '+7 days')
     ORDER BY r.expires_at ASC`
  ).all() as any[]

  return rows.map(r => ({ ...r, days_until: calcDaysUntil(r.expires_at) }))
}

export function getReminderById(id: number): Reminder | null {
  const db = getDb()
  const row = db.prepare(
    `SELECT r.*, u.name as creator_name FROM reminders r LEFT JOIN users u ON u.id = r.created_by WHERE r.id = ?`
  ).get(id) as any
  if (!row) return null
  return { ...row, days_until: calcDaysUntil(row.expires_at) }
}

export function createReminder(data: {
  name: string; type: ReminderType; expires_at: string
  notes?: string | null; created_by: number
}): Reminder {
  const db = getDb()
  const row = db.prepare(
    `INSERT INTO reminders (name, type, expires_at, notes, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
  ).get(data.name, data.type, data.expires_at, data.notes ?? null, data.created_by, data.created_by) as any
  return { ...row, creator_name: '', days_until: calcDaysUntil(row.expires_at) }
}

export function updateReminder(id: number, data: {
  name?: string; type?: ReminderType; expires_at?: string
  notes?: string | null; updated_by: number
}): Reminder | null {
  const db = getDb()
  const fields = ["updated_at = datetime('now')", 'updated_by = ?']
  const vals: (string | number | null)[] = [data.updated_by]

  if (data.name !== undefined) { fields.push('name = ?'); vals.push(data.name) }
  if (data.type !== undefined) { fields.push('type = ?'); vals.push(data.type) }
  if (data.expires_at !== undefined) { fields.push('expires_at = ?'); vals.push(data.expires_at) }
  if (data.notes !== undefined) { fields.push('notes = ?'); vals.push(data.notes) }

  vals.push(id)
  db.prepare(`UPDATE reminders SET ${fields.join(', ')} WHERE id = ?`).run(...vals)
  return getReminderById(id)
}

export function setReminderDone(id: number, updatedBy: number): Reminder | null {
  const db = getDb()
  db.prepare(
    `UPDATE reminders SET status = 'done', done_at = datetime('now'), updated_by = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(updatedBy, id)
  return getReminderById(id)
}

export function setReminderActive(id: number, updatedBy: number): Reminder | null {
  const db = getDb()
  db.prepare(
    `UPDATE reminders SET status = 'active', done_at = NULL, updated_by = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(updatedBy, id)
  return getReminderById(id)
}

export function deleteReminder(id: number) {
  getDb().prepare('DELETE FROM reminders WHERE id = ?').run(id)
}
