'use client'

import { useState, useEffect, useCallback, useRef, memo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import type { Bookmark, BookmarkCategory } from '@/types'

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#64748b',
]

function getFaviconUrl(url: string): string {
  try {
    const { hostname } = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
  } catch {
    return ''
  }
}

const BookmarkCard = memo(function BookmarkCard({
  bookmark,
  onFavorite,
  onDelete,
  canManage,
}: {
  bookmark: Bookmark
  onFavorite: (id: number) => void
  onDelete: (id: number) => void
  canManage: boolean
}) {
  const [imgError, setImgError] = useState(false)
  const favicon = getFaviconUrl(bookmark.url)

  return (
    <div className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-200 hover:shadow-sm transition-all duration-150 flex flex-col gap-2.5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
          {favicon && !imgError ? (
            <img src={favicon} alt="" width={16} height={16} onError={() => setImgError(true)} />
          ) : (
            <span className="text-gray-400 text-xs">🔗</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <a
            href={bookmark.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-gray-900 hover:text-indigo-700 line-clamp-1 transition-colors block"
          >
            {bookmark.title}
          </a>
          <p className="text-xs text-gray-400 truncate mt-0.5">{bookmark.url}</p>
        </div>
        <button
          onClick={() => onFavorite(bookmark.id)}
          aria-label={bookmark.is_favorited ? 'Remove from favorites' : 'Add to favorites'}
          className={`flex-shrink-0 text-base transition-all hover:scale-110 ${bookmark.is_favorited ? 'text-amber-400' : 'text-gray-200 hover:text-amber-300'}`}
        >
          ★
        </button>
      </div>

      {/* Description */}
      {bookmark.description && (
        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{bookmark.description}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-1 border-t border-gray-100">
        <span className="text-xs text-gray-400">{bookmark.creator_name}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-300">{bookmark.view_count}v</span>
          {canManage && (
            <button
              onClick={() => onDelete(bookmark.id)}
              className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-600 transition-all"
              aria-label="Delete bookmark"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  )
})

export default function BookmarksPage() {
  const { user } = useAuth()
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [categories, setCategories] = useState<BookmarkCategory[]>([])
  const [total, setTotal] = useState(0)
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [selectedCat, setSelectedCat] = useState<number | null>(null)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [q, setQ] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Add bookmark form
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newCat, setNewCat] = useState<number | ''>('')
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)

  // Category management
  const [showCatForm, setShowCatForm] = useState(false)
  const [catName, setCatName] = useState('')
  const [catColor, setCatColor] = useState(COLORS[0])

  function handleSearchInput(value: string) {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value) { setQ(''); return }
    if (value.length < 2) return
    debounceRef.current = setTimeout(() => setQ(value), 400)
  }

  const fetchBookmarks = useCallback(async (cursor?: number) => {
    if (!cursor) {
      abortRef.current?.abort()
      abortRef.current = new AbortController()
    }
    const signal = abortRef.current?.signal
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (selectedCat) params.set('category_id', String(selectedCat))
    if (favoritesOnly) params.set('favorites_only', 'true')
    if (cursor) params.set('cursor', String(cursor))
    params.set('limit', '30')

    try {
      const res = await fetch(`/api/bookmarks?${params}`, { signal })
      if (!res.ok) return
      const data = await res.json()
      if (cursor) setBookmarks((prev) => [...prev, ...data.items])
      else setBookmarks(data.items)
      setNextCursor(data.nextCursor)
      setTotal(data.total)
    } catch (err: any) {
      if (err.name === 'AbortError') return
    }
  }, [q, selectedCat, favoritesOnly])

  useEffect(() => {
    setLoading(true)
    fetchBookmarks().finally(() => setLoading(false))
  }, [fetchBookmarks])

  useEffect(() => {
    fetch('/api/bookmark-categories').then(r => r.json()).then(setCategories).catch(() => {})
  }, [])

  const handleFavorite = useCallback(async (id: number) => {
    const res = await fetch(`/api/bookmarks/${id}/favorite`, { method: 'POST' })
    const { favorited } = await res.json()
    setBookmarks(prev => prev.map(b => b.id === id ? { ...b, is_favorited: favorited } : b))
  }, [])

  async function handleDelete(id: number) {
    if (!confirm('Delete this bookmark?')) return
    await fetch(`/api/bookmarks/${id}`, { method: 'DELETE' })
    setBookmarks(prev => prev.filter(b => b.id !== id))
    setTotal(t => t - 1)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAddError('')
    if (!newTitle.trim() || !newUrl.trim()) { setAddError('Title and URL are required.'); return }
    setAdding(true)
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), url: newUrl.trim(), description: newDesc.trim() || null, category_id: newCat || null }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      const bm = await res.json()
      setBookmarks(prev => [bm, ...prev])
      setTotal(t => t + 1)
      setShowAdd(false); setNewTitle(''); setNewUrl(''); setNewDesc(''); setNewCat('')
    } catch (err: any) {
      setAddError(err.message)
    } finally {
      setAdding(false)
    }
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!catName.trim()) return
    const res = await fetch('/api/bookmark-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: catName.trim(), color: catColor }),
    })
    if (res.ok) {
      const cat = await res.json()
      setCategories(prev => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))
      setCatName(''); setShowCatForm(false)
    }
  }

  async function handleDeleteCategory(id: number) {
    if (!confirm('Delete this category? Bookmarks will become uncategorised.')) return
    await fetch(`/api/bookmark-categories/${id}`, { method: 'DELETE' })
    setCategories(prev => prev.filter(c => c.id !== id))
    if (selectedCat === id) setSelectedCat(null)
  }

  const canManage = user?.role === 'admin' || user?.role === 'curator'

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <aside className="w-52 flex-shrink-0 space-y-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 mb-2">Categories</p>

        <button
          onClick={() => { setSelectedCat(null); setFavoritesOnly(false) }}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${!selectedCat && !favoritesOnly ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          All bookmarks
        </button>
        <button
          onClick={() => { setFavoritesOnly(true); setSelectedCat(null) }}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${favoritesOnly ? 'bg-amber-50 text-amber-700' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          ★ Favorites
        </button>

        <div className="border-t border-gray-100 pt-2 mt-2 space-y-0.5">
          {categories.map((cat) => (
            <div key={cat.id} className="group flex items-center gap-1">
              <button
                onClick={() => { setSelectedCat(cat.id); setFavoritesOnly(false) }}
                className={`flex-1 text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${selectedCat === cat.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                <span className="truncate">{cat.name}</span>
              </button>
              <button
                onClick={() => handleDeleteCategory(cat.id)}
                className="opacity-0 group-hover:opacity-100 text-xs text-gray-300 hover:text-red-500 px-1 transition-all"
                aria-label="Delete category"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Add category */}
        {showCatForm ? (
          <form onSubmit={handleAddCategory} className="mt-2 space-y-2 px-1">
            <input
              autoFocus
              value={catName}
              onChange={e => setCatName(e.target.value)}
              placeholder="Category name"
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex flex-wrap gap-1">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCatColor(c)}
                  className={`w-5 h-5 rounded-full transition-transform ${catColor === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="flex gap-1">
              <button type="submit" className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-md">Add</button>
              <button type="button" onClick={() => setShowCatForm(false)} className="text-xs border border-gray-300 px-2.5 py-1 rounded-md">Cancel</button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowCatForm(true)}
            className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:text-indigo-600 hover:bg-gray-50 rounded-lg transition-colors"
          >
            + Add category
          </button>
        )}
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Toolbar */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10.5 10.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              type="search"
              placeholder="Search bookmarks…"
              value={searchInput}
              onChange={e => handleSearchInput(e.target.value)}
              className="w-full border border-gray-200 bg-white rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm placeholder-gray-400"
            />
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-xl shadow-sm transition-colors"
          >
            + Add
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <form onSubmit={handleAdd} className="bg-white border border-indigo-200 rounded-xl p-4 space-y-3 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700">New bookmark</h3>
            {addError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{addError}</p>}
            <div className="grid grid-cols-2 gap-2">
              <input required placeholder="Title" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input required type="url" placeholder="https://…" value={newUrl} onChange={e => setNewUrl(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <select value={newCat} onChange={e => setNewCat(e.target.value ? Number(e.target.value) : '')}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">No category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={adding} className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg disabled:opacity-50 transition-colors">
                {adding ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => { setShowAdd(false); setAddError('') }}
                className="text-sm border border-gray-300 px-4 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Count */}
        <p className="text-sm text-gray-400">
          {loading ? 'Loading…' : `${total} ${total === 1 ? 'bookmark' : 'bookmarks'}`}
          {selectedCat && categories.find(c => c.id === selectedCat) && (
            <span className="ml-1">in <strong className="text-gray-600">{categories.find(c => c.id === selectedCat)?.name}</strong></span>
          )}
        </p>

        {/* Bookmark grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse h-28" />
            ))}
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">🔖</div>
            <p className="text-gray-500 font-medium">{q ? 'No bookmarks match your search.' : 'No bookmarks yet.'}</p>
            <button onClick={() => setShowAdd(true)} className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium hover:underline">
              Add the first bookmark →
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {bookmarks.map(b => (
                <BookmarkCard
                  key={b.id}
                  bookmark={b}
                  onFavorite={handleFavorite}
                  onDelete={handleDelete}
                  canManage={canManage || b.created_by === user?.id}
                />
              ))}
            </div>
            {nextCursor && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={async () => { setLoadingMore(true); await fetchBookmarks(nextCursor); setLoadingMore(false) }}
                  disabled={loadingMore}
                  className="text-sm text-indigo-600 font-medium border border-indigo-200 bg-white px-5 py-2 rounded-xl shadow-sm hover:shadow disabled:opacity-50 transition-all"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
