'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import type { Reminder, ReminderType } from '@/lib/reminder-queries'

const TYPE_META: Record<ReminderType, { label: string; icon: string; color: string }> = {
  domain:       { label: 'Domain',       icon: '🌐', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  hosting:      { label: 'Hosting',      icon: '🖥️', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  ssl:          { label: 'SSL',          icon: '🔒', color: 'bg-green-50 text-green-700 border-green-200' },
  subscription: { label: 'Subscription', icon: '📋', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  other:        { label: 'Other',        icon: '📅', color: 'bg-gray-50 text-gray-600 border-gray-200' },
}

function urgencyClass(days: number): string {
  if (days < 0)  return 'text-red-600 font-semibold'
  if (days === 0) return 'text-red-600 font-semibold'
  if (days <= 7)  return 'text-amber-600 font-semibold'
  if (days <= 30) return 'text-yellow-600'
  return 'text-gray-400'
}

function formatDays(days: number): string {
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `${days} days`
}

function ReminderRow({
  reminder,
  canManage,
  isAdmin,
  onUpdate,
  onDelete,
}: {
  reminder: Reminder
  canManage: boolean
  isAdmin: boolean
  onUpdate: (r: Reminder) => void
  onDelete: (id: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: reminder.name,
    type: reminder.type,
    expires_at: reminder.expires_at,
    notes: reminder.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const meta = TYPE_META[reminder.type]

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.expires_at) return
    setSaving(true)
    const res = await fetch(`/api/reminders/${reminder.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name.trim(), type: form.type, expires_at: form.expires_at, notes: form.notes.trim() || null }),
    })
    if (res.ok) { onUpdate(await res.json()); setEditing(false) }
    setSaving(false)
  }

  async function handleDone() {
    const res = await fetch(`/api/reminders/${reminder.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'done' }),
    })
    if (res.ok) onUpdate(await res.json())
  }

  async function handleReopen() {
    const res = await fetch(`/api/reminders/${reminder.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reopen' }),
    })
    if (res.ok) onUpdate(await res.json())
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="bg-white border border-indigo-200 rounded-xl p-4 space-y-3 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Name</label>
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Type</label>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as ReminderType })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {Object.entries(TYPE_META).map(([val, m]) => (
                <option key={val} value={val}>{m.icon} {m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Expiry date</label>
            <input required type="date" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Notes (optional)</label>
            <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Auto-renews, contact person…" />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-sm border border-gray-300 px-4 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className={`group bg-white border rounded-xl px-4 py-3 flex items-center gap-4 transition-all ${
      reminder.status === 'done' ? 'border-gray-200 opacity-60' :
      reminder.days_until < 0 ? 'border-red-300 bg-red-50/30' :
      reminder.days_until <= 7 ? 'border-amber-300 bg-amber-50/20' :
      'border-gray-200 hover:border-indigo-200 hover:shadow-sm'
    }`}>
      {/* Type badge */}
      <span className={`flex-shrink-0 text-xs font-medium border rounded-full px-2.5 py-0.5 ${meta.color}`}>
        {meta.icon} {meta.label}
      </span>

      {/* Name + notes */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${reminder.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {reminder.name}
        </p>
        {reminder.notes && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{reminder.notes}</p>
        )}
      </div>

      {/* Expiry */}
      <div className="flex-shrink-0 text-right">
        <p className="text-xs text-gray-400">{new Date(reminder.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
        {reminder.status === 'active' && (
          <p className={`text-xs mt-0.5 ${urgencyClass(reminder.days_until)}`}>
            {formatDays(reminder.days_until)}
          </p>
        )}
        {reminder.status === 'done' && (
          <p className="text-xs text-green-600 mt-0.5">✓ Done</p>
        )}
      </div>

      {/* Actions */}
      {canManage && (
        <div className="flex-shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(true)}
            className="text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 hover:border-indigo-300 px-2 py-1 rounded-md transition-colors">
            Edit
          </button>
          {reminder.status === 'active' ? (
            <button onClick={handleDone}
              className="text-xs text-green-600 hover:text-green-800 border border-green-200 hover:border-green-400 px-2 py-1 rounded-md transition-colors">
              Mark done
            </button>
          ) : (
            <button onClick={handleReopen}
              className="text-xs text-amber-600 hover:text-amber-800 border border-amber-200 hover:border-amber-400 px-2 py-1 rounded-md transition-colors">
              Reopen
            </button>
          )}
          {isAdmin && (
            <button onClick={() => onDelete(reminder.id)}
              className="text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 px-2 py-1 rounded-md transition-colors">
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const FILTER_TABS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'done', label: 'Done' },
]

export default function DatesPage() {
  const { user } = useAuth()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('active')
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({
    name: '', type: 'domain' as ReminderType, expires_at: '', notes: '',
  })
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)

  const isPrivileged = user?.role === 'admin' || user?.role === 'curator'
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    fetch(`/api/reminders?${params}`)
      .then(r => r.json())
      .then(setReminders)
      .finally(() => setLoading(false))
  }, [statusFilter])

  function handleUpdate(updated: Reminder) {
    setReminders(prev => prev.map(r => r.id === updated.id ? updated : r))
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this reminder permanently?')) return
    await fetch(`/api/reminders/${id}`, { method: 'DELETE' })
    setReminders(prev => prev.filter(r => r.id !== id))
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAddError('')
    if (!addForm.name.trim() || !addForm.expires_at) { setAddError('Name and expiry date are required.'); return }
    setAdding(true)
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addForm, name: addForm.name.trim(), notes: addForm.notes.trim() || null }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      const reminder: Reminder = await res.json()
      setReminders(prev => [reminder, ...prev])
      setShowAdd(false)
      setAddForm({ name: '', type: 'domain', expires_at: '', notes: '' })
    } catch (err: any) {
      setAddError(err.message)
    } finally {
      setAdding(false)
    }
  }

  // Stats
  const expiring = reminders.filter(r => r.status === 'active' && r.days_until <= 7)
  const overdue = reminders.filter(r => r.status === 'active' && r.days_until < 0)

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Dates & Reminders</h1>
          <p className="text-sm text-gray-400 mt-0.5">Track domain, hosting, SSL and subscription expiry dates</p>
        </div>
        {isPrivileged && (
          <button onClick={() => setShowAdd(!showAdd)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-xl shadow-sm transition-colors">
            + Add
          </button>
        )}
      </div>

      {/* Alert summary */}
      {(overdue.length > 0 || expiring.length > 0) && statusFilter !== 'done' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {overdue.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-2xl">🔴</span>
              <div>
                <p className="text-sm font-semibold text-red-700">{overdue.length} overdue</p>
                <p className="text-xs text-red-500">Immediate action needed</p>
              </div>
            </div>
          )}
          {expiring.filter(r => r.days_until >= 0).length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-amber-700">{expiring.filter(r => r.days_until >= 0).length} expiring soon</p>
                <p className="text-xs text-amber-500">Within the next 7 days</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white border border-indigo-200 rounded-xl p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700">New reminder</h3>
          {addError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{addError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Name <span className="text-red-400">*</span></label>
              <input required value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                placeholder="e.g. provaliantgroup.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Type</label>
              <select value={addForm.type} onChange={e => setAddForm({ ...addForm, type: e.target.value as ReminderType })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {Object.entries(TYPE_META).map(([val, m]) => (
                  <option key={val} value={val}>{m.icon} {m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Expiry date <span className="text-red-400">*</span></label>
              <input required type="date" value={addForm.expires_at} onChange={e => setAddForm({ ...addForm, expires_at: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Notes (optional)</label>
              <input value={addForm.notes} onChange={e => setAddForm({ ...addForm, notes: e.target.value })}
                placeholder="e.g. Namecheap, auto-renew on"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={adding}
              className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg disabled:opacity-50 transition-colors shadow-sm">
              {adding ? 'Saving…' : 'Add reminder'}
            </button>
            <button type="button" onClick={() => { setShowAdd(false); setAddError('') }}
              className="text-sm border border-gray-300 px-5 py-2 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {FILTER_TABS.map(tab => (
          <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              statusFilter === tab.value
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="bg-white border border-gray-200 rounded-xl h-14 animate-pulse" />)}
        </div>
      ) : reminders.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">📅</div>
          <p className="text-gray-500 font-medium">No reminders yet.</p>
          {isPrivileged && (
            <button onClick={() => setShowAdd(true)} className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium hover:underline">
              Add the first one →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {reminders.map(r => (
            <ReminderRow
              key={r.id}
              reminder={r}
              canManage={isPrivileged}
              isAdmin={!!isAdmin}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
