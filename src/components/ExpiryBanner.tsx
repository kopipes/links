'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import type { Reminder } from '@/lib/reminder-queries'

export default function ExpiryBanner() {
  const { user } = useAuth()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!user) return
    fetch('/api/reminders/expiring')
      .then(r => r.ok ? r.json() : [])
      .then(setReminders)
      .catch(() => {})
  }, [user])

  if (!user || dismissed || reminders.length === 0) return null

  const isPrivileged = user.role === 'admin' || user.role === 'curator'

  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3">
        <span className="text-amber-500 flex-shrink-0 text-base">⚠️</span>
        <div className="flex-1 min-w-0">
          <span className="text-sm text-amber-800 font-medium">
            {reminders.length === 1
              ? `"${reminders[0].name}" expires ${reminders[0].days_until <= 0 ? 'today or is overdue' : `in ${reminders[0].days_until} day${reminders[0].days_until === 1 ? '' : 's'}`}`
              : `${reminders.length} items expiring within 7 days`
            }
          </span>
          {isPrivileged && (
            <Link href="/dates" className="ml-2 text-xs text-amber-700 underline hover:text-amber-900">
              View all →
            </Link>
          )}
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 text-amber-400 hover:text-amber-700 text-lg leading-none"
          aria-label="Dismiss"
        >×</button>
      </div>
    </div>
  )
}
