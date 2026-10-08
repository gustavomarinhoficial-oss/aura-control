'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Status { configured: boolean; valid?: boolean; daysLeft?: number | null }

const WARN_DAYS = 10

// Faixa vermelha quando o token da Meta está perto de vencer (ou já venceu).
export function TokenWarning() {
  const [s, setS] = useState<Status | null>(null)

  useEffect(() => {
    fetch('/api/traffic/token-status').then(r => r.json()).then(setS).catch(() => {})
  }, [])

  if (!s?.configured) return null
  const expired = s.valid === false || (s.daysLeft != null && s.daysLeft <= 0)
  const soon = s.daysLeft != null && s.daysLeft <= WARN_DAYS
  if (!expired && !soon) return null

  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#ef4444]/40 bg-[#ef4444]/10 px-4 py-3 text-sm text-[#fca5a5]">
      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
      <p>
        {expired
          ? 'O token da Meta venceu: o tráfego não atualiza mais. Gere um novo e troque o META_ADS_TOKEN na Vercel.'
          : `O token da Meta vence em ${s.daysLeft} dia${s.daysLeft === 1 ? '' : 's'}. Gere um novo e troque o META_ADS_TOKEN na Vercel antes disso.`}
      </p>
    </div>
  )
}
