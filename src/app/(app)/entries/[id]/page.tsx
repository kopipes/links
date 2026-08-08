'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth, useIsPrivileged } from '@/lib/auth-context'
import { canManageEntry } from '@/lib/auth'
import type { EntryWithDetails, EntryLink } from '@/types'

const SOURCE_ICONS: Record<string, string> = { canva: '🎨', gdrive: '📁', gsheets: '📊', gdocs: '📄', other: '🔗' }

function LinkStatusBadge({
  link,
  entryId,
  isPrivileged,
  onStatusChange,
}: {
  link: EntryLink
  entryId: number
  isPrivileged: boolean
  onStatusChange: (linkId: number, status: 'ok' | 'broken' | 'unchecked') => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  async function setStatus(status: 'ok' | 'broken' | 'unchecked') {
    setSaving(true)
    setOpen(false)
    await fetch(`/api/entries/${entryId}/links/${link.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    onStatusChange(link.id, status)
    setSaving(false)
  }

  const badgeClass =
    link.link_status === 'ok'
      ? 'bg-green-50 text-green-600 border-green-200'
      : link.link_status === 'broken'
      ? 'bg-red-50 text-red-600 border-red-200'
      : 'bg-gray-50 text-gray-400 border-gray-200'

  if (!isPrivileged) {
    return (
      <span className={`text-xs rounded-full border px-2 py-0.5 ${badgeClass}`}>
        {link.link_status}
      </span>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={saving}
        aria-label="Change link status"
        className={`text-xs rounded-full border px-2 py-0.5 cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50 ${badgeClass}`}
      >
        {saving ? '…' : link.link_status}
        <span className="ml-1 opacity-50">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20">
          <p className="text-xs text-gray-400 px-3 py-1.5 border-b border-gray-100">Set status</p>
          {(['ok', 'broken', 'unchecked'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 ${
                link.link_status === s ? 'font-semibold text-indigo-600' : 'text-gray-700'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                s === 'ok' ? 'bg-green-500' : s === 'broken' ? 'bg-red-500' : 'bg-gray-300'
              }`} />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function EntryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const isPrivileged = useIsPrivileged()
  const [entry, setEntry] = useState<EntryWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [archiving, setArchiving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch(`/api/entries/${id}`)
      .then((r) => { if (!r.ok) throw new Error('Not found'); return r.json() })
      .then(setEntry)
      .catch(() => setError('Entry not found.'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleFavorite() {
    if (!entry) return
    const res = await fetch(`/api/entries/${entry.id}/favorite`, { method: 'POST' })
    const { favorited } = await res.json()
    setEntry((e) => e ? { ...e, is_favorited: favorited } : e)
  }

  async function handleArchive() {
    if (!entry || !confirm('Archive this entry?')) return
    setArchiving(true)
    await fetch(`/api/entries/${entry.id}`, { method: 'DELETE' })
    router.push('/entries')
  }

  async function handleHardDelete() {
    if (!entry || !confirm('Permanently delete this entry? This cannot be undone.')) return
    setDeleting(true)
    await fetch(`/api/entries/${entry.id}?hard=true`, { method: 'DELETE' })
    router.push('/entries')
  }

  async function handleRestore() {
    if (!entry) return
    await fetch(`/api/entries/${entry.id}/restore`, { method: 'POST' })
    const res = await fetch(`/api/entries/${entry.id}`)
    setEntry(await res.json())
  }

  function handleLinkStatusChange(linkId: number, status: 'ok' | 'broken' | 'unchecked') {
    setEntry((e) => e ? {
      ...e,
      links: e.links.map((l) => l.id === linkId ? { ...l, link_status: status } : l)
    } : e)
  }

  if (loading) return (
    <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-2/3" />
      <div className="h-4 bg-gray-100 rounded w-1/3" />
      <div className="h-24 bg-gray-100 rounded" />
    </div>
  )

  if (error || !entry) return (
    <div className="text-center py-16 text-gray-400">
      <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">🔍</div>
      <p className="text-sm font-medium">{error || 'Entry not found.'}</p>
      <Link href="/entries" className="mt-3 inline-block text-sm text-indigo-600 hover:underline">Back to browse</Link>
    </div>
  )

  const canManage = user && canManageEntry(
    { sub: user.id, role: user.role, email: user.email, name: user.name },
    entry.created_by
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Link href="/entries" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Browse</Link>
            {entry.status === 'archived' && (
              <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5">Archived</span>
            )}
          </div>
          {entry.category_name && (
            <span className="inline-block text-xs font-medium text-indigo-600 bg-indigo-50 rounded-full px-2.5 py-0.5 mb-2">
              {entry.category_name}
            </span>
          )}
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">{entry.title}</h1>
        </div>
        <button
          onClick={handleFavorite}
          aria-label={entry.is_favorited ? 'Remove from favorites' : 'Add to favorites'}
          className={`text-2xl flex-shrink-0 transition-all hover:scale-110 ${entry.is_favorited ? 'text-amber-400' : 'text-gray-200 hover:text-amber-300'}`}
        >
          ★
        </button>
      </div>

      {entry.description && (
        <p className="text-gray-600 leading-relaxed">{entry.description}</p>
      )}

      {/* Links */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Links</h2>
          {isPrivileged && (
            <p className="text-xs text-gray-400">Click status badge to change</p>
          )}
        </div>
        {entry.links.map((link) => (
          <div
            key={link.id}
            className={`flex items-center gap-3 bg-white border rounded-xl px-4 py-3 transition-colors ${
              link.link_status === 'broken'
                ? 'border-red-200 bg-red-50/30'
                : 'border-gray-200 hover:border-indigo-200'
            }`}
          >
            <span className="text-xl flex-shrink-0">{SOURCE_ICONS[link.source_type] ?? '🔗'}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline truncate"
                >
                  {link.label}
                </a>
                {isPrivileged && link.visibility === 'protected' && (
                  <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-1.5 py-0.5">🔒 Protected</span>
                )}
              </div>
              <p className="text-xs text-gray-400 truncate mt-0.5">{link.url}</p>
            </div>
            <LinkStatusBadge
              link={link}
              entryId={entry.id}
              isPrivileged={isPrivileged}
              onStatusChange={handleLinkStatusChange}
            />
          </div>
        ))}
      </div>

      {/* Tags */}
      {entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {entry.tags.map((tag) => (
            <span key={tag.id} className="text-sm bg-gray-100 text-gray-500 rounded-full px-3 py-1">
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Metadata */}
      <div className="text-xs text-gray-400 space-y-0.5 border-t border-gray-100 pt-4">
        <p>Added by <span className="text-gray-600 font-medium">{entry.creator_name}</span> · {new Date(entry.created_at).toLocaleDateString()}</p>
        <p>{entry.view_count} views</p>
      </div>

      {/* Actions */}
      {canManage && (
        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          <Link
            href={`/entries/${entry.id}/edit`}
            className="text-sm border border-gray-200 hover:border-indigo-300 bg-white hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 px-3.5 py-1.5 rounded-lg transition-colors shadow-sm"
          >
            Edit
          </Link>
          {entry.status === 'active' && (
            <button
              onClick={handleArchive}
              disabled={archiving}
              className="text-sm border border-gray-200 hover:border-amber-300 bg-white hover:bg-amber-50 text-gray-700 hover:text-amber-700 px-3.5 py-1.5 rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              {archiving ? 'Archiving…' : 'Archive'}
            </button>
          )}
          {entry.status === 'archived' && isPrivileged && (
            <button
              onClick={handleRestore}
              className="text-sm border border-gray-200 hover:border-green-300 bg-white hover:bg-green-50 text-gray-700 hover:text-green-700 px-3.5 py-1.5 rounded-lg transition-colors shadow-sm"
            >
              Restore
            </button>
          )}
          {user?.role === 'admin' && (
            <button
              onClick={handleHardDelete}
              disabled={deleting}
              className="text-sm border border-red-200 hover:border-red-300 bg-white hover:bg-red-50 text-red-500 hover:text-red-700 px-3.5 py-1.5 rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete permanently'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
