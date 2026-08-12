'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import type { Note, NoteImage } from '@/lib/note-queries'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export default function NotesPage() {
  const { user } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [q, setQ] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Editor state
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveTimeout, setSaveTimeoutRef] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedNote = notes.find(n => n.id === selectedId) ?? null

  function handleSearchInput(val: string) {
    setSearchInput(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val) { setQ(''); return }
    debounceRef.current = setTimeout(() => setQ(val), 400)
  }

  const fetchNotes = useCallback(async () => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    const res = await fetch(`/api/notes?${params}`)
    if (res.ok) {
      const data: Note[] = await res.json()
      setNotes(data)
      // If current selection got filtered out, clear it
      if (selectedId && !data.find(n => n.id === selectedId)) setSelectedId(null)
    }
  }, [q])

  useEffect(() => {
    setLoading(true)
    fetchNotes().finally(() => setLoading(false))
  }, [fetchNotes])

  // Load note into editor when selected
  useEffect(() => {
    if (selectedNote) {
      setEditTitle(selectedNote.title)
      setEditBody(selectedNote.body)
    }
  }, [selectedId])

  // Auto-save with 800ms debounce
  function scheduleAutoSave(title: string, body: string) {
    if (saveTimeout) clearTimeout(saveTimeout)
    const t = setTimeout(async () => {
      if (!selectedId) return
      setSaving(true)
      await fetch(`/api/notes/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body }),
      })
      setSaving(false)
      setNotes(prev => prev.map(n => n.id === selectedId ? { ...n, title, body, updated_at: new Date().toISOString() } : n))
    }, 800)
    setSaveTimeoutRef(t)
  }

  function handleTitleChange(val: string) {
    setEditTitle(val)
    scheduleAutoSave(val, editBody)
  }

  function handleBodyChange(val: string) {
    setEditBody(val)
    scheduleAutoSave(editTitle, val)
  }

  async function handleNewNote() {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled', body: '' }),
    })
    if (res.ok) {
      const note: Note = await res.json()
      setNotes(prev => [note, ...prev])
      setSelectedId(note.id)
      setEditTitle(note.title)
      setEditBody(note.body)
      // Focus title after render
      setTimeout(() => document.getElementById('note-title')?.focus(), 50)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this note?')) return
    await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    setNotes(prev => prev.filter(n => n.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedId) return
    e.target.value = ''

    setUploading(true)
    try {
      const form = new FormData()
      form.append('image', file)
      const res = await fetch(`/api/notes/${selectedId}/images`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const d = await res.json()
        alert(d.error ?? 'Upload failed')
        return
      }
      const img: NoteImage = await res.json()
      setNotes(prev => prev.map(n =>
        n.id === selectedId ? { ...n, images: [...n.images, img] } : n
      ))
    } finally {
      setUploading(false)
    }
  }

  async function handleDeleteImage(imgId: number) {
    if (!selectedId || !confirm('Remove this image?')) return
    await fetch(`/api/notes/${selectedId}/images/${imgId}`, { method: 'DELETE' })
    setNotes(prev => prev.map(n =>
      n.id === selectedId ? { ...n, images: n.images.filter(i => i.id !== imgId) } : n
    ))
  }

  const images = selectedNote?.images ?? []

  return (
    <div className="flex gap-4 h-[calc(100vh-7rem)]">
      {/* Note list sidebar */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-3 h-full">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10.5 10.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              type="search"
              placeholder="Search notes…"
              value={searchInput}
              onChange={e => handleSearchInput(e.target.value)}
              className="w-full border border-gray-200 bg-white rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            />
          </div>
          <button
            onClick={handleNewNote}
            className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white w-8 h-8 rounded-lg flex items-center justify-center shadow-sm transition-colors"
            aria-label="New note"
            title="New note"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Note list */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-white rounded-xl border border-gray-200 animate-pulse" />
            ))
          ) : notes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-2xl mb-2">📝</p>
              <p className="text-xs text-gray-400">{q ? 'No notes found.' : 'No notes yet.'}</p>
              <button onClick={handleNewNote} className="mt-2 text-xs text-indigo-600 hover:underline">Create one →</button>
            </div>
          ) : (
            notes.map(note => (
              <div
                key={note.id}
                onClick={() => setSelectedId(note.id)}
                className={`group relative cursor-pointer rounded-xl p-3 border transition-all duration-150 ${
                  selectedId === note.id
                    ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                    : 'bg-white border-gray-200 hover:border-indigo-200 hover:shadow-sm'
                }`}
              >
                <p className="text-sm font-medium text-gray-900 truncate pr-5">
                  {note.title || 'Untitled'}
                </p>
                <p className="text-xs text-gray-400 truncate mt-0.5">
                  {note.body ? note.body.slice(0, 60) : (note.images.length ? `${note.images.length} image${note.images.length > 1 ? 's' : ''}` : 'Empty note')}
                </p>
                <p className="text-xs text-gray-300 mt-1">{timeAgo(note.updated_at)}</p>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(note.id) }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all text-xs"
                  aria-label="Delete note"
                >✕</button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor pane */}
      <div className="flex-1 min-w-0 flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {!selectedNote ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 p-8">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center text-3xl">📝</div>
            <div>
              <p className="text-gray-600 font-medium">Select a note to edit</p>
              <p className="text-sm text-gray-400 mt-1">or create a new one</p>
            </div>
            <button
              onClick={handleNewNote}
              className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors"
            >
              + New note
            </button>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 hover:border-indigo-300 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <span className="w-3 h-3 border border-gray-400 border-t-indigo-600 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
                      <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                      <circle cx="5.5" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M1 11l4-3 3 2.5 3-4 4 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {uploading ? 'Uploading…' : 'Add image'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>
              <div className="flex items-center gap-2">
                {saving && <span className="text-xs text-gray-400 animate-pulse">Saving…</span>}
                <span className="text-xs text-gray-300">{timeAgo(selectedNote.updated_at)}</span>
                <button
                  onClick={() => handleDelete(selectedNote.id)}
                  className="text-xs text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-200 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Title */}
            <div className="px-5 pt-4 pb-2">
              <input
                id="note-title"
                type="text"
                value={editTitle}
                onChange={e => handleTitleChange(e.target.value)}
                placeholder="Title"
                className="w-full text-xl font-bold text-gray-900 placeholder-gray-300 focus:outline-none bg-transparent"
              />
            </div>

            {/* Body */}
            <div className="flex-1 px-5 pb-4 overflow-y-auto">
              <textarea
                value={editBody}
                onChange={e => handleBodyChange(e.target.value)}
                placeholder="Write your note here…"
                className="w-full h-full min-h-[200px] text-sm text-gray-700 placeholder-gray-300 focus:outline-none bg-transparent resize-none leading-relaxed"
              />
            </div>

            {/* Images */}
            {images.length > 0 && (
              <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
                  Images ({images.length})
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {images.map(img => (
                    <div key={img.id} className="group relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                      <img
                        src={`/api/notes/image/${img.filename}`}
                        alt={img.original}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                        <button
                          onClick={() => handleDeleteImage(img.id)}
                          className="opacity-0 group-hover:opacity-100 bg-white/90 hover:bg-red-50 text-red-500 rounded-full w-8 h-8 flex items-center justify-center text-sm transition-all shadow"
                          aria-label="Remove image"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="absolute bottom-0 left-0 right-0 text-xs text-white bg-black/40 px-2 py-1 truncate opacity-0 group-hover:opacity-100 transition-all">
                        {img.original}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
