'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import EntryForm from '@/components/EntryForm'
import type { EntryWithDetails } from '@/types'

export default function EditEntryPage() {
  const { id } = useParams<{ id: string }>()
  const [entry, setEntry] = useState<EntryWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/entries/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found')
        return r.json()
      })
      .then(setEntry)
      .catch(() => setError('Entry not found.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="max-w-2xl space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/3" />
      <div className="h-64 bg-gray-100 rounded" />
    </div>
  )

  if (error || !entry) return (
    <p className="text-sm text-red-600">{error || 'Entry not found.'}</p>
  )

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Edit entry</h1>
      <EntryForm initial={entry} />
    </div>
  )
}
