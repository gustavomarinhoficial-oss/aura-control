'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarClock, MapPin } from 'lucide-react'
import { useRole } from '@/lib/hooks/useRole'
import { ROLE_NAME } from '@/lib/roles'
import type { Meeting } from '@/lib/supabase/types'

export function TodayMeetingsCard() {
  const role = useRole()
  const name = ROLE_NAME[role] || ''
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/meetings?today=true')
      .then(r => r.json())
      .then(d => setMeetings(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }, [])

  const isOwner = role === 'gustavo' || role === 'admin'
  const mine = (isOwner ? meetings : meetings.filter(m => m.attendees?.some(a => a.name === name)))
    .filter(m => m.status !== 'cancelada')

  if (loading || mine.length === 0) return null

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
      <Link href="/reunioes" className="flex items-center gap-2 mb-3 hover:opacity-80 transition-opacity">
        <CalendarClock size={14} className="text-[#a78bfa]" />
        <h2 className="text-sm font-medium">Reunião hoje</h2>
      </Link>
      <div className="space-y-2.5">
        {mine.map(m => (
          <Link key={m.id} href="/reunioes" className="flex items-center justify-between gap-3 text-sm hover:opacity-80 transition-opacity">
            <div className="min-w-0">
              <p className="font-medium truncate">{m.title}</p>
              {(m.location || m.clients?.name) && (
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                  <MapPin size={10} />{[m.clients?.name, m.location].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            {m.start_time && <span className="text-xs text-[#a78bfa] font-medium shrink-0">{m.start_time.slice(0, 5)}</span>}
          </Link>
        ))}
      </div>
    </div>
  )
}
