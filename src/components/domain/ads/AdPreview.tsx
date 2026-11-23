'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { CTAS, PLACEMENTS, isVideoUrl, destinationLabel, type AdCreative } from '@/lib/ads/constants'

// Prévia do anúncio como aparece no Instagram: perfil + "Patrocinado", texto principal,
// a mídia (vídeo tocando ou imagem, com setas quando tem mais de uma) e a barra com título e botão.
// Usada no Hub e no link público do cliente.

type Creative = Pick<AdCreative, 'media_urls' | 'cover_url' | 'placement' | 'primary_text' | 'headline' | 'cta' | 'destination_type' | 'destination'>

export function AdPreview({ creative, clientName, logoUrl }: { creative: Creative; clientName: string; logoUrl?: string | null }) {
  const [index, setIndex] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const media = creative.media_urls ?? []
  const current = media[Math.min(index, media.length - 1)]
  const vertical = creative.placement === 'stories_reels'
  const text = creative.primary_text ?? ''
  const longText = text.length > 125 || text.split('\n').length > 3
  const dest = destinationLabel(creative.destination_type, creative.destination)

  return (
    <div className="bg-black text-white rounded-xl overflow-hidden border border-[#262626]">
      {/* perfil */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="w-8 h-8 rounded-full p-[1.5px] bg-gradient-to-tr from-[#f59e0b] via-[#ef4444] to-[#a855f7] shrink-0">
          <div className={`w-full h-full rounded-full ${logoUrl ? 'bg-white' : 'bg-black'} flex items-center justify-center overflow-hidden text-[11px] font-bold`}>
            {logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logoUrl} alt="" className="w-full h-full object-cover" />
              : clientName.slice(0, 1).toUpperCase()}
          </div>
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[13px] font-semibold truncate">{clientName}</p>
          <p className="text-[11px] text-[#a8a8a8]">Patrocinado</p>
        </div>
        <MoreHorizontal size={16} className="text-[#a8a8a8]" />
      </div>

      {/* texto principal */}
      {text && (
        <div className="px-3 pb-2.5 text-[13px] leading-snug whitespace-pre-wrap break-words">
          {longText && !expanded ? (
            <>
              {text.slice(0, 125).split('\n').slice(0, 3).join('\n')}…{' '}
              <button onClick={() => setExpanded(true)} className="text-[#a8a8a8]">mais</button>
            </>
          ) : text}
        </div>
      )}

      {/* mídia */}
      <div className={`relative bg-[#111] ${vertical ? 'aspect-[9/16]' : 'aspect-[4/5]'}`}>
        {!current ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-[#6b6b6b]">Sem mídia</div>
        ) : isVideoUrl(current) ? (
          <video
            key={current}
            src={current}
            poster={creative.cover_url ?? undefined}
            className="absolute inset-0 w-full h-full object-contain"
            autoPlay muted loop playsInline controls preload="metadata"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={current} src={current} alt="" className="absolute inset-0 w-full h-full object-contain" />
        )}
        {media.length > 1 && (
          <>
            <span className="absolute top-2 right-2 text-[11px] bg-black/70 px-2 py-0.5 rounded-full">{index + 1}/{media.length}</span>
            {index > 0 && (
              <button onClick={() => setIndex(i => i - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/85 text-black flex items-center justify-center" aria-label="Anterior"><ChevronLeft size={16} /></button>
            )}
            {index < media.length - 1 && (
              <button onClick={() => setIndex(i => i + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/85 text-black flex items-center justify-center" aria-label="Próxima"><ChevronRight size={16} /></button>
            )}
          </>
        )}
      </div>

      {/* título + botão */}
      <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-[#121212] border-t border-[#262626]">
        <div className="min-w-0">
          {creative.headline && <p className="text-[13px] font-semibold truncate">{creative.headline}</p>}
          {dest && <p className="text-[11px] text-[#a8a8a8] truncate">{dest}</p>}
        </div>
        <span className="shrink-0 text-[12px] font-semibold bg-[#0095f6] text-white px-3 py-1.5 rounded-lg">{CTAS[creative.cta] ?? creative.cta}</span>
      </div>
      {media.length > 1 && (
        <div className="flex justify-center gap-1 py-2 bg-black">
          {media.map((_, i) => <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === index ? 'bg-[#0095f6]' : 'bg-[#3a3a3a]'}`} />)}
        </div>
      )}
      <p className="px-3 py-1.5 text-[10px] text-[#6b6b6b] bg-black border-t border-[#1a1a1a]">{PLACEMENTS[creative.placement] ?? creative.placement}</p>
    </div>
  )
}
