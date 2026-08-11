'use client'

import { useState, useEffect, useCallback, useRef, memo } from 'react'
import Link from 'next/link'
import { useIsPrivileged } from '@/lib/auth-context'
import type { EntryWithDetails, Category } from '@/types'

interface EntriesResult {
  items: EntryWithDetails[]
  nextCursor: number | null
  total: number
}

const SOURCE_ICONS: Record<string, string> = { canva: '🎨', gdrive: '📁', gsheets: '📊', gdocs: '📄', other: '🔗' }

const EntryCard = memo(function EntryCard({
  entry,
  onFavoriteToggle,
}: {
  entry: EntryWithDetails
  onFavoriteToggle: (id: number) => void
}) {
  const isPrivileged = useIsPrivileged()

  return (
    <div className="group bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-indigo-200 hover:shadow-sm transition-all duration-150 flex items-center gap-3">

      {/* Favorite */}
      <button
        onClick={() => onFavoriteToggle(entry.id)}
        aria-label={entry.is_favorited ? 'Remove from favorites' : 'Add to favorites'}
        className={`flex-shrink-0 text-base transition-all duration-150 hover:scale-110 ${
          entry.is_favorited ? 'text-amber-400' : 'text-gray-200 hover:text-amber-300'
        }`}
      >
        ★
      </button>

      {/* Title + category */}
      <div className="flex-shrink-0 w-56 min-w-0">
        <Link
          href={`/entries/${entry.id}`}
          className="text-sm font-semibold text-gray-900 hover:text-indigo-700 truncate block transition-colors"
        >
          {entry.title}
        </Link>
        {entry.category_name && (
          <span className="text-xs text-indigo-500 font-medium truncate block">{entry.category_name}</span>
        )}
      </div>

      {/* Links */}
      <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
        {entry.links.map((link) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium bg-gray-50 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200 text-gray-600 hover:text-indigo-700 rounded-md px-2 py-1 transition-all duration-150"
          >
            <span className="leading-none">{SOURCE_ICONS[link.source_type] ?? '🔗'}</span>
            <span className="truncate max-w-[120px]">{link.label}</span>
            {isPrivileged && link.visibility === 'protected' && (
              <span className="text-amber-500" title="Protected">🔒</span>
            )}
          </a>
        ))}
      </div>

      {/* Tags */}
      <div className="hidden lg:flex flex-wrap gap-1 flex-shrink-0 max-w-[180px]">
        {entry.tags.slice(0, 3).map((tag) => (
          <span key={tag.id} className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
            {tag.name}
          </span>
        ))}
        {entry.tags.length > 3 && (
          <span className="text-xs text-gray-300">+{entry.tags.length - 3}</span>
        )}
      </div>

      {/* Meta */}
      <div className="hidden sm:flex flex-shrink-0 text-xs text-gray-300 gap-2 items-center">
        <span>{entry.creator_name}</span>
        <span>·</span>
        <span>{entry.view_count}v</span>
      </div>
    </div>
  )
})

export default function EntriesPage() {
  const [entries, setEntries] = useState<EntryWithDetails[]>([])
  const [total, setTotal] = useState(0)
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const [q, setQ] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [sort, setSort] = useState<'recent' | 'popular' | 'title'>('recent')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce search input → update q after 400ms, min 2 chars
  function handleSearchInput(value: string) {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.length === 0) {
      setQ('')
      return
    }
    if (value.length < 2) return
    debounceRef.current = setTimeout(() => setQ(value), 400)
  }

  useEffect(() => {
    fetch('/api/categories').then((r) => r.json()).then(setCategories).catch(() => {})
  }, [])

  const abortRef = useRef<AbortController | null>(null)

  const fetchEntries = useCallback(async (cursor?: number) => {
    // Cancel any in-flight request
    if (!cursor) {
      abortRef.current?.abort()
      abortRef.current = new AbortController()
    }
    const signal = abortRef.current?.signal

    const params = new URLSearchParams()
    if (q) params.set('q', q)
    params.set('sort', sort)
    if (categoryId) params.set('category_id', String(categoryId))
    if (favoritesOnly) params.set('favorites_only', 'true')
    if (cursor) params.set('cursor', String(cursor))

    try {
      const res = await fetch(`/api/entries?${params}`, { signal })
      if (!res.ok) return
      const data: EntriesResult = await res.json()
      if (cursor) setEntries((prev) => [...prev, ...data.items])
      else setEntries(data.items)
      setNextCursor(data.nextCursor)
      setTotal(data.total)
    } catch (err: any) {
      if (err.name === 'AbortError') return // stale request, ignore
    }
  }, [q, sort, categoryId, favoritesOnly])

  useEffect(() => {
    setLoading(true)
    fetchEntries().finally(() => setLoading(false))
  }, [fetchEntries])

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    await fetchEntries(nextCursor)
    setLoadingMore(false)
  }

  const handleFavoriteToggle = useCallback(async (entryId: number) => {
    const res = await fetch(`/api/entries/${entryId}/favorite`, { method: 'POST' })
    const { favorited } = await res.json()
    setEntries((prev) => prev.map((e) => e.id === entryId ? { ...e, is_favorited: favorited } : e))
  }, [])

  return (
    <div className="space-y-5">
      {/* Search bar - auto search on type */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M10.5 10.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          type="search"
          placeholder="Search titles, descriptions, tags, links…"
          value={searchInput}
          onChange={(e) => handleSearchInput(e.target.value)}
          className="w-full border border-gray-200 bg-white rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 shadow-sm placeholder-gray-400"
          aria-label="Search entries"
        />
        {searchInput && searchInput.length < 2 && (
          <p className="text-xs text-gray-400 mt-1 ml-1">Type at least 2 characters to search</p>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
          className="border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm text-gray-700"
          aria-label="Sort by"
        >
          <option value="recent">Most recent</option>
          <option value="popular">Most popular</option>
          <option value="title">Title A–Z</option>
        </select>

        {categories.length > 0 && (
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
            className="border border-gray-200 bg-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm text-gray-700"
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}

        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={favoritesOnly}
            onChange={(e) => setFavoritesOnly(e.target.checked)}
            className="rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
          />
          Favorites only
        </label>

        <div className="ml-auto">
          <Link
            href="/entries/new"
            className="sm:hidden inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3.5 py-2 rounded-xl transition-colors shadow-sm"
          >
            + New
          </Link>
        </div>
      </div>

      {/* Result count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {loading ? 'Loading…' : (
            <>{total} {total === 1 ? 'entry' : 'entries'}{q && <span className="text-gray-500"> for <strong className="text-gray-700">"{q}"</strong></span>}</>
          )}
        </p>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 animate-pulse h-12" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">📭</div>
          <p className="text-gray-500 font-medium">{q ? 'No entries match your search.' : 'No entries yet.'}</p>
          <Link href="/entries/new" className="mt-3 inline-block text-sm text-indigo-600 hover:text-indigo-700 font-medium hover:underline">
            Add the first entry →
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {entries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} onFavoriteToggle={handleFavoriteToggle} />
            ))}
          </div>
          {nextCursor && (
            <div className="flex justify-center pt-2">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium border border-indigo-200 hover:border-indigo-300 bg-white px-5 py-2.5 rounded-xl transition-all shadow-sm hover:shadow disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
