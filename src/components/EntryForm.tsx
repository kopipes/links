'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useIsPrivileged } from '@/lib/auth-context'
import type { Category, Tag, EntryWithDetails } from '@/types'

const SOURCE_TYPES = [
  { value: 'other', label: '🔗 Link' },
  { value: 'canva', label: '🎨 Canva' },
  { value: 'gdrive', label: '📁 Google Drive' },
  { value: 'gsheets', label: '📊 Google Sheets' },
  { value: 'gdocs', label: '📄 Google Docs' },
]

interface LinkField {
  id?: number
  url: string
  label: string
  source_type: string
  visibility: string
  sort_order: number
  _key: string
}

interface Props {
  initial?: EntryWithDetails
}

export default function EntryForm({ initial }: Props) {
  const router = useRouter()
  const isPrivileged = useIsPrivileged()

  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [categoryIds, setCategoryIds] = useState<number[]>(
    initial?.categories?.map((c) => c.id) ?? (initial?.category_id ? [initial.category_id] : [])
  )
  const [tags, setTags] = useState<string[]>(initial?.tags.map((t) => t.name) ?? [])
  const [tagInput, setTagInput] = useState('')
  const [tagSuggestions, setTagSuggestions] = useState<Tag[]>([])
  const [links, setLinks] = useState<LinkField[]>(
    initial?.links.map((l, i) => ({
      id: l.id,
      url: l.url,
      label: l.label,
      source_type: l.source_type,
      visibility: l.visibility,
      sort_order: l.sort_order,
      _key: String(l.id ?? i),
    })) ?? [{ url: '', label: '', source_type: 'other', visibility: 'public', sort_order: 0, _key: 'new-0' }]
  )
  const [categories, setCategories] = useState<Category[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [urlWarnings, setUrlWarnings] = useState<Record<string, string>>({})
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const tagInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/categories').then((r) => r.json()).then(setCategories).catch(() => {})
  }, [])

  // Tag autocomplete
  useEffect(() => {
    if (!tagInput.trim()) { setTagSuggestions([]); return }
    const timeout = setTimeout(() => {
      fetch(`/api/tags?q=${encodeURIComponent(tagInput.trim())}`)
        .then((r) => r.json())
        .then((data: Tag[]) => setTagSuggestions(data.filter((t) => !tags.includes(t.name))))
        .catch(() => {})
    }, 200)
    return () => clearTimeout(timeout)
  }, [tagInput, tags])

  async function checkUrl(key: string, url: string) {
    if (!url.trim()) return
    try {
      const res = await fetch(`/api/entries/check-url?url=${encodeURIComponent(url)}`)
      const { duplicate } = await res.json()
      if (duplicate && duplicate.id !== initial?.id) {
        setUrlWarnings((prev) => ({
          ...prev,
          [key]: `URL already used in entry: "${duplicate.title}"`,
        }))
      } else {
        setUrlWarnings((prev) => { const n = { ...prev }; delete n[key]; return n })
      }
    } catch {}
  }

  function addTag(name: string) {
    const trimmed = name.trim().toLowerCase()
    if (!trimmed || tags.includes(trimmed)) return
    setTags([...tags, trimmed])
    setTagInput('')
    setTagSuggestions([])
  }

  function removeTag(name: string) {
    setTags(tags.filter((t) => t !== name))
  }

  function addLink() {
    setLinks([
      ...links,
      {
        url: '', label: '', source_type: 'other', visibility: 'public',
        sort_order: links.length, _key: `new-${Date.now()}`
      }
    ])
  }

  function removeLink(key: string) {
    setLinks(links.filter((l) => l._key !== key))
    setUrlWarnings((prev) => { const n = { ...prev }; delete n[key]; return n })
  }

  function updateLink(key: string, field: Partial<LinkField>) {
    setLinks(links.map((l) => l._key === key ? { ...l, ...field } : l))
  }

  // Drag-to-reorder
  function handleDragStart(idx: number) { setDragIdx(idx) }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    const reordered = [...links]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(idx, 0, moved)
    setLinks(reordered.map((l, i) => ({ ...l, sort_order: i })))
    setDragIdx(idx)
  }
  function handleDragEnd() { setDragIdx(null) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!title.trim()) { setError('Title is required.'); return }
    if (links.length === 0) { setError('At least one link is required.'); return }
    for (const l of links) {
      if (!l.url.trim()) { setError('All links must have a URL.'); return }
      if (!l.label.trim()) { setError('All links must have a label.'); return }
    }

    setSubmitting(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        category_ids: categoryIds,
        tags,
        links: links.map(({ _key, ...l }) => l),
      }

      const url = initial ? `/api/entries/${initial.id}` : '/api/entries'
      const method = initial ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to save entry')
      }

      const entry: EntryWithDetails = await res.json()
      router.push(`/entries/${entry.id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2" role="alert">
          {error}
        </p>
      )}

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="e.g. Q3 Campaign Design Assets"
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          id="description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          placeholder="Optional description…"
        />
      </div>

      {/* Categories — multi-select */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Categories</label>
        {categories.length === 0 ? (
          <p className="text-xs text-gray-400">No categories yet. Ask an admin to add some.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const checked = categoryIds.includes(c.id)
              return (
                <label
                  key={c.id}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm cursor-pointer border transition-colors ${
                    checked
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => {
                      setCategoryIds(prev =>
                        checked ? prev.filter(id => id !== c.id) : [...prev, c.id]
                      )
                    }}
                  />
                  {c.name}
                </label>
              )
            })}
          </div>
        )}
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2.5 py-0.5 text-xs">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Remove tag ${tag}`}
                className="hover:text-red-500 leading-none"
              >×</button>
            </span>
          ))}
        </div>
        <div className="relative">
          <input
            ref={tagInputRef}
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput) }
              if (e.key === ',') { e.preventDefault(); addTag(tagInput) }
            }}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Type tag and press Enter…"
          />
          {tagSuggestions.length > 0 && (
            <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-auto">
              {tagSuggestions.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); addTag(t.name) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-700"
                  >
                    {t.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Links */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Links <span className="text-red-500">*</span>
          </label>
          <span className="text-xs text-gray-400">Drag to reorder</span>
        </div>
        <div className="space-y-3">
          {links.map((link, idx) => (
            <div
              key={link._key}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              className={`border rounded-lg p-3 bg-white space-y-2 cursor-grab active:cursor-grabbing transition-shadow ${
                dragIdx === idx ? 'shadow-md border-indigo-300' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-300 text-sm select-none">⠿</span>
                <span className="text-xs text-gray-400 font-medium">Link {idx + 1}</span>
                {links.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLink(link._key)}
                    className="ml-auto text-xs text-gray-400 hover:text-red-500 transition-colors"
                    aria-label="Remove link"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">URL</label>
                  <input
                    type="url"
                    required
                    value={link.url}
                    onChange={(e) => updateLink(link._key, { url: e.target.value })}
                    onBlur={(e) => checkUrl(link._key, e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="https://…"
                  />
                  {urlWarnings[link._key] && (
                    <p className="text-xs text-amber-600 mt-0.5">{urlWarnings[link._key]}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">Label</label>
                  <input
                    type="text"
                    required
                    value={link.label}
                    onChange={(e) => updateLink(link._key, { label: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. Main design file"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-0.5 block">Source type</label>
                  <select
                    value={link.source_type}
                    onChange={(e) => updateLink(link._key, { source_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {SOURCE_TYPES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                {isPrivileged && (
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-0.5 block">Visibility</label>
                    <select
                      value={link.visibility}
                      onChange={(e) => updateLink(link._key, { visibility: e.target.value })}
                      className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="public">Public</option>
                      <option value="protected">Protected 🔒</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addLink}
          className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 border border-dashed border-indigo-300 hover:border-indigo-500 w-full py-2 rounded-md transition-colors"
        >
          + Add another link
        </button>
      </div>

      {/* Submit */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium px-5 py-2 rounded-md text-sm transition-colors"
        >
          {submitting ? 'Saving…' : initial ? 'Save changes' : 'Create entry'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 hover:border-gray-400 px-4 py-2 rounded-md transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
