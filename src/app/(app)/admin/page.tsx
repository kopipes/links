'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'

interface Stats {
  totalEntries: number
  archivedEntries: number
  totalUsers: number
  brokenLinks: number
  uncheckedLinks: number
}

interface BrokenLink {
  id: number
  entry_id: number
  entry_title: string
  url: string
  label: string
  creator_name: string
  last_checked_at: string | null
}

interface DashboardData {
  stats: Stats
  brokenLinks: BrokenLink[]
}

export default function AdminPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'categories' | 'divisions'>('overview')

  useEffect(() => {
    if (user && user.role !== 'admin') { router.push('/entries'); return }
  }, [user, router])

  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/4" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Admin Dashboard</h1>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['overview', 'users', 'categories', 'divisions'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors -mb-px ${
              activeTab === tab
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && data && <OverviewTab data={data} onRefresh={() => {
        setLoading(true)
        fetch('/api/admin/dashboard').then(r => r.json()).then(setData).finally(() => setLoading(false))
      }} />}
      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'categories' && <CategoriesTab />}
      {activeTab === 'divisions' && <DivisionsTab />}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`bg-white border rounded-xl p-4 ${color}`}>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}

function OverviewTab({ data, onRefresh }: { data: DashboardData; onRefresh: () => void }) {
  const [checking, setChecking] = useState(false)

  async function runLinkCheck() {
    setChecking(true)
    try {
      await fetch('/api/admin/check-links', { method: 'POST' })
      onRefresh()
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Active entries" value={data.stats.totalEntries} color="border-gray-200" />
        <StatCard label="Archived entries" value={data.stats.archivedEntries} color="border-gray-200" />
        <StatCard label="Active users" value={data.stats.totalUsers} color="border-gray-200" />
        <StatCard label="Broken links" value={data.stats.brokenLinks} color={data.stats.brokenLinks > 0 ? 'border-red-200' : 'border-gray-200'} />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-700">Broken links</h2>
        <button
          onClick={runLinkCheck}
          disabled={checking}
          className="text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-400 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
        >
          {checking ? 'Checking…' : 'Run link check'}
        </button>
      </div>

      {data.brokenLinks.length === 0 ? (
        <p className="text-sm text-gray-400">No broken links detected.</p>
      ) : (
        <div className="divide-y divide-gray-100 border border-red-100 rounded-xl bg-white overflow-hidden">
          {data.brokenLinks.map((link) => (
            <div key={link.id} className="px-4 py-3 flex items-start gap-3">
              <span className="text-red-500 text-sm mt-0.5">✕</span>
              <div className="flex-1 min-w-0">
                <Link href={`/entries/${link.entry_id}`} className="text-sm font-medium text-gray-900 hover:text-indigo-600 truncate block">
                  {link.entry_title}
                </Link>
                <p className="text-xs text-gray-500 truncate">{link.label} — <span className="text-gray-400">{link.url}</span></p>
                <p className="text-xs text-gray-400">by {link.creator_name}{link.last_checked_at ? ` · checked ${new Date(link.last_checked_at).toLocaleDateString()}` : ''}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function UsersTab() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', email: '', role: 'user', status: 'active', division_id: '' })
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', email: '', password: '', role: 'user' })
  const [error, setError] = useState('')
  const [changingPwFor, setChangingPwFor] = useState<number | null>(null)
  const [newPw, setNewPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  function load() {
    fetch('/api/admin/users').then(r => r.json()).then(setUsers).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  function startEdit(u: any) {
    setEditing(u.id)
    setChangingPwFor(null)
    setNewPw('')
    setPwError('')
    setForm({ name: u.name, email: u.email, role: u.role, status: u.status, division_id: u.division_id ?? '' })
  }

  async function saveEdit(id: number) {
    setSaving(true)
    await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, division_id: form.division_id || null }),
    })
    setEditing(null)
    setSaving(false)
    load()
  }

  async function handleSetPassword(id: number) {
    setPwError('')
    if (newPw.length < 8) { setPwError('Password must be at least 8 characters.'); return }
    setPwSaving(true)
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPw }),
    })
    setPwSaving(false)
    if (!res.ok) { setPwError('Failed to update password.'); return }
    setChangingPwFor(null)
    setNewPw('')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newForm),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setCreating(false)
      setNewForm({ name: '', email: '', password: '', role: 'user' })
      load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="h-32 bg-gray-100 rounded animate-pulse" />

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{users.length} users</p>
        <button
          onClick={() => setCreating(true)}
          className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md transition-colors"
        >
          + Add user
        </button>
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="bg-white border border-indigo-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-medium">New user</h3>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <input required placeholder="Name" value={newForm.name} onChange={e => setNewForm({...newForm, name: e.target.value})} className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <input required type="email" placeholder="Email" value={newForm.email} onChange={e => setNewForm({...newForm, email: e.target.value})} className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <input required type="password" placeholder="Password (min 8 chars)" minLength={8} value={newForm.password} onChange={e => setNewForm({...newForm, password: e.target.value})} className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <select value={newForm.role} onChange={e => setNewForm({...newForm, role: e.target.value})} className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="user">User</option>
              <option value="curator">Curator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md disabled:opacity-50">
              {saving ? 'Creating…' : 'Create'}
            </button>
            <button type="button" onClick={() => { setCreating(false); setError('') }} className="text-sm border border-gray-300 px-3 py-1.5 rounded-md">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl bg-white overflow-hidden">
        {users.map((u) => (
          <div key={u.id} className="px-4 py-3">
            {editing === u.id ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="user">User</option>
                    <option value="curator">Curator</option>
                    <option value="admin">Admin</option>
                  </select>
                  <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="active">Active</option>
                    <option value="deactivated">Deactivated</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(u.id)} disabled={saving} className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-md disabled:opacity-50">Save</button>
                  <button onClick={() => { setChangingPwFor(changingPwFor === u.id ? null : u.id); setNewPw(''); setPwError('') }} className="text-xs border border-gray-300 hover:border-indigo-300 text-gray-600 hover:text-indigo-600 px-2.5 py-1 rounded-md transition-colors">
                    {changingPwFor === u.id ? 'Cancel password' : 'Set password'}
                  </button>
                  <button onClick={() => { setEditing(null); setChangingPwFor(null) }} className="text-xs border border-gray-300 px-2.5 py-1 rounded-md">Cancel</button>
                </div>
                {changingPwFor === u.id && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-medium text-gray-600">Set new password for {u.name}</p>
                    {pwError && <p className="text-xs text-red-600">{pwError}</p>}
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="New password (min 8 chars)"
                        minLength={8}
                        value={newPw}
                        onChange={e => setNewPw(e.target.value)}
                        className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        onClick={() => handleSetPassword(u.id)}
                        disabled={pwSaving || !newPw}
                        className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md disabled:opacity-50 transition-colors"
                      >
                        {pwSaving ? 'Saving…' : 'Set'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{u.name}</p>
                  <p className="text-xs text-gray-400">{u.email} · {u.division_name ?? 'No division'}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs rounded-full px-2 py-0.5 ${
                    u.role === 'admin' ? 'bg-red-50 text-red-600' :
                    u.role === 'curator' ? 'bg-indigo-50 text-indigo-600' :
                    'bg-gray-100 text-gray-500'
                  }`}>{u.role}</span>
                  {u.status === 'deactivated' && (
                    <span className="text-xs bg-gray-100 text-gray-400 rounded-full px-2 py-0.5">deactivated</span>
                  )}
                  <button onClick={() => startEdit(u)} className="text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 hover:border-indigo-300 px-2 py-0.5 rounded-md transition-colors">
                    Edit
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function CategoriesTab() {
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  function load() {
    fetch('/api/categories').then(r => r.json()).then(setCategories).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    setNewName('')
    setSaving(false)
    load()
  }

  async function handleUpdate(id: number) {
    if (!editName.trim()) return
    await fetch(`/api/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim() }),
    })
    setEditId(null)
    load()
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this category? Entries will become uncategorised.')) return
    await fetch(`/api/categories/${id}`, { method: 'DELETE' })
    load()
  }

  if (loading) return <div className="h-32 bg-gray-100 rounded animate-pulse" />

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="New category name…"
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button type="submit" disabled={saving || !newName.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-md disabled:opacity-50 transition-colors">
          Add
        </button>
      </form>

      <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl bg-white overflow-hidden">
        {categories.length === 0 && <p className="text-sm text-gray-400 px-4 py-3">No categories yet.</p>}
        {categories.map((c) => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-3">
            {editId === c.id ? (
              <>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
                <button onClick={() => handleUpdate(c.id)} className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-md">Save</button>
                <button onClick={() => setEditId(null)} className="text-xs border border-gray-300 px-2.5 py-1 rounded-md">Cancel</button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-gray-900">{c.name}</span>
                <button onClick={() => { setEditId(c.id); setEditName(c.name) }} className="text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 hover:border-indigo-300 px-2 py-0.5 rounded-md transition-colors">Edit</button>
                <button onClick={() => handleDelete(c.id)} className="text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 px-2 py-0.5 rounded-md transition-colors">Delete</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function DivisionsTab() {
  const [divisions, setDivisions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [saving, setSaving] = useState(false)

  function load() {
    fetch('/api/admin/divisions').then(r => r.json()).then(setDivisions).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    await fetch('/api/admin/divisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() }),
    })
    setNewName('')
    setNewDesc('')
    setSaving(false)
    load()
  }

  async function handleUpdate(id: number) {
    await fetch(`/api/admin/divisions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() }),
    })
    setEditId(null)
    load()
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this division? Users will be unassigned.')) return
    await fetch(`/api/admin/divisions/${id}`, { method: 'DELETE' })
    load()
  }

  if (loading) return <div className="h-32 bg-gray-100 rounded animate-pulse" />

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Division name…"
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          value={newDesc}
          onChange={e => setNewDesc(e.target.value)}
          placeholder="Description (optional)"
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button type="submit" disabled={saving || !newName.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-md disabled:opacity-50 transition-colors">
          Add
        </button>
      </form>

      <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl bg-white overflow-hidden">
        {divisions.length === 0 && <p className="text-sm text-gray-400 px-4 py-3">No divisions yet.</p>}
        {divisions.map((d) => (
          <div key={d.id} className="px-4 py-3">
            {editId === d.id ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input value={editDesc} onChange={e => setEditDesc(e.target.value)} className="flex-1 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Description" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleUpdate(d.id)} className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-md">Save</button>
                  <button onClick={() => setEditId(null)} className="text-xs border border-gray-300 px-2.5 py-1 rounded-md">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{d.name}</p>
                  {d.description && <p className="text-xs text-gray-400">{d.description}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditId(d.id); setEditName(d.name); setEditDesc(d.description ?? '') }} className="text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 hover:border-indigo-300 px-2 py-0.5 rounded-md transition-colors">Edit</button>
                  <button onClick={() => handleDelete(d.id)} className="text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 px-2 py-0.5 rounded-md transition-colors">Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
