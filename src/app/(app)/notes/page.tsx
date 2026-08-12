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

// ─── Lightbox ────────────────────────────────────────────────────────────────
function Lightbox({
  img,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  img: NoteImage
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
}) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && hasPrev) onPrev()
      if (e.key === 'ArrowRight' && hasNext) onNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [hasPrev, hasNext, onClose, onPrev, onNext])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-xl"
        aria-label="Close"
      >✕</button>

      {/* Prev */}
      {hasPrev && (
        <button
          onClick={e => { e.stopPropagation(); onPrev() }}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Previous image"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      )}

      {/* Image */}
      <div className="max-w-4xl max-h-[85vh] flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
        <img
          src={`/api/notes/image/${img.filename}`}
          alt={img.original}
          className="max-w-full max-h-[78vh] object-contain rounded-xl shadow-2xl"
        />
        <p className="text-white/60 text-sm">{img.original}</p>
      </div>

      {/* Next */}
      {hasNext && (
        <button
          onClick={e => { e.stopPropagation(); onNext() }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Next image"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M7 4l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
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

  // Lightbox state
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  const selectedNote = notes.find(n => n.id === selectedId) ?? null
  const images = selectedNote?.images ?? []

  // Permission helpers
  const isAdmin = user?.role === 'admin'
  const isCurator = user?.role === 'curator'
  const canEdit = selectedNote
    ? (selectedNote.created_by === user?.id || isAdmin || isCurator)
    : false
  const canDelete = isAdmin

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
      if (selectedId && !data.find(n => n.id === selectedId)) setSelectedId(null)
    }
  }, [q])

  useEffect(() => {
    setLoading(true)
    fetchNotes().finally(() => setLoading(false))
  }, [fetchNotes])

  useEffect(() => {
    if (selectedNote) {
      setEditTitle(selectedNote.title)
      setEditBody(selectedNote.body)
    }
  }, [selectedId])

  function scheduleAutoSave(title: string, body: string) {
    if (!canEdit) return
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
    if (!canEdit) return
    setEditTitle(val)
    scheduleAutoSave(val, editBody)
  }

  function handleBodyChange(val: string) {
    if (!canEdit) return
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
      setTimeout(() => document.getElementById('note-title')?.focus(), 50)
    }
  }

  async function handleDelete(id: number) {
    if (!isAdmin) return
    if (!confirm('Delete this note permanently?')) return
    await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    setNotes(prev => prev.filter(n => n.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedId || !canEdit) return
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
    if (!selectedId || !canEdit) return
    if (!confirm('Remove this image?')) return
    await fetch(`/api/notes/${selectedId}/images/${imgId}`, { method: 'DELETE' })
    setNotes(prev => prev.map(n =>
      n.id === selectedId ? { ...n, images: n.images.filter(i => i.id !== imgId) } : n
    ))
    setLightboxIdx(null)
  }

  return (
    <>
      {/* Lightbox */}
      {lightboxIdx !== null && images[lightboxIdx] && (
        <Lightbox
          img={images[lightboxIdx]}
          onClose={() => setLightboxIdx(null)}
          onPrev={() => setLightboxIdx(i => (i ?? 0) - 1)}
          onNext={() => setLightboxIdx(i => (i ?? 0) + 1)}
          hasPrev={lightboxIdx > 0}
          hasNext={lightboxIdx < images.length - 1}
        />
      )}

      <div className="flex gap-4 h-full p-4 max-w-6xl mx-auto w-full">
        {/* Note list sidebar */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-3 h-full min-h-0">
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
                  {isAdmin && (
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(note.id) }}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all text-xs"
                      aria-label="Delete note"
                    >✕</button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Editor pane */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          {!selectedNote ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 p-8">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center text-3xl">📝</div>
              <div>
                <p className="text-gray-600 font-medium">Select a note to view</p>
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
                  {canEdit && (
                    <>
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
                    </>
                  )}
                  {!canEdit && (
                    <span className="text-xs text-gray-400 italic">View only</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {saving && <span className="text-xs text-gray-400 animate-pulse">Saving…</span>}
                  <span className="text-xs text-gray-400">{selectedNote.creator_name}</span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-300">{timeAgo(selectedNote.updated_at)}</span>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(selectedNote.id)}
                      className="text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {/* Title — fixed, no scroll */}
              <div className="flex-shrink-0 px-5 pt-4 pb-2 border-b border-gray-100">
                <input
                  id="note-title"
                  type="text"
                  value={editTitle}
                  onChange={e => handleTitleChange(e.target.value)}
                  placeholder="Title"
                  readOnly={!canEdit}
                  className={`w-full text-xl font-bold text-gray-900 placeholder-gray-300 focus:outline-none bg-transparent ${!canEdit ? 'cursor-default select-text' : ''}`}
                />
              </div>

              {/* Body — scrollable */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <textarea
                  value={editBody}
                  onChange={e => handleBodyChange(e.target.value)}
                  placeholder={canEdit ? 'Write your note here…' : ''}
                  readOnly={!canEdit}
                  className={`w-full min-h-full text-sm text-gray-700 placeholder-gray-300 focus:outline-none bg-transparent leading-relaxed resize-none overflow-hidden ${!canEdit ? 'cursor-default select-text' : ''}`}
                />
              </div>

              {/* Images — fixed at bottom, own scroll */}
              {images.length > 0 && (
                <div className="flex-shrink-0 px-5 pb-4 border-t border-gray-100 pt-3">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                    Images ({images.length})
                  </p>
                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2 overflow-y-auto max-h-32">
                    {images.map((img, idx) => (
                      <div
                        key={img.id}
                        className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50 cursor-zoom-in"
                        onClick={() => setLightboxIdx(idx)}
                      >
                        <img
                          src={`/api/notes/image/${img.filename}`}
                          alt={img.original}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                          {canEdit && (
                            <button
                              onClick={e => { e.stopPropagation(); handleDeleteImage(img.id) }}
                              className="opacity-0 group-hover:opacity-100 bg-white/90 hover:bg-red-50 text-red-500 rounded-full w-5 h-5 flex items-center justify-center text-xs transition-all shadow"
                              aria-label="Remove image"
                            >✕</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
