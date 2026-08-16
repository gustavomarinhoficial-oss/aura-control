'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { OmarPanel } from './OmarPanel'

export function OmarButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed right-4 md:right-6 bottom-20 md:bottom-6 z-40 flex items-center gap-2 h-11 pl-3 pr-4 rounded-full bg-[#7c3aed] text-white shadow-lg shadow-[#7c3aed]/30 hover:bg-[#6d28d9] transition-colors"
      >
        <Sparkles size={17} />
        <span className="text-sm font-semibold">Omar</span>
      </button>
      <OmarPanel open={open} onOpenChange={setOpen} />
    </>
  )
}
