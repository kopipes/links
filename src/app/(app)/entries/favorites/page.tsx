'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { EntryWithDetails } from '@/types'

export default function FavoritesPage() {
  const [entries, setEntries] = useState<EntryWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/entries?favorites_only=true&limit=100')
      .then((r) => r.json())
      .then((data) => setEntries(data.items ?? []))
      .finally(() => setLoading(false))
  }, [])

  async function handleUnfavorite(id: number) {
    await fetch(`/api/entries/${id}/favorite`, { method: 'POST' })
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Favorites</h1>
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">☆</p>
          <p className="text-sm">No favorites yet. Star entries to save them here.</p>
        </div>
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
                {entry.category_name && (
                  <span className="text-xs text-indigo-600">{entry.category_name}</span>
                )}
              </div>
              <button
                onClick={() => handleUnfavorite(entry.id)}
                aria-label="Remove from favorites"
                className="text-yellow-400 hover:text-gray-300 text-xl transition-colors flex-shrink-0"
              >
                ★
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
