'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth, useIsPrivileged } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import type { EntryWithDetails } from '@/types'

export default function ArchivedPage() {
  const isPrivileged = useIsPrivileged()
  const router = useRouter()
  const [entries, setEntries] = useState<EntryWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isPrivileged) { router.push('/entries'); return }
    fetch('/api/entries?status=archived&limit=100')
      .then((r) => r.json())
      .then((data) => setEntries(data.items ?? []))
      .finally(() => setLoading(false))
  }, [isPrivileged])

  async function handleRestore(id: number) {
    await fetch(`/api/entries/${id}/restore`, { method: 'POST' })
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Archived entries</h1>
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />)}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-400">No archived entries.</p>
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl bg-white overflow-hidden">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="flex-1 min-w-0">
                <Link
                  href={`/entries/${entry.id}`}
                  className="text-sm font-medium text-gray-900 hover:text-indigo-600 truncate block"
                >
                  {entry.title}
                </Link>
                <p className="text-xs text-gray-400">Archived · {new Date(entry.updated_at).toLocaleDateString()}</p>
              </div>
              <button
                onClick={() => handleRestore(entry.id)}
                className="text-xs text-green-600 hover:text-green-800 border border-green-200 hover:border-green-400 px-2.5 py-1 rounded-md transition-colors flex-shrink-0"
              >
                Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
