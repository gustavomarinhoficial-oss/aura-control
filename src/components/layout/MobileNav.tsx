'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Kanban, Newspaper, Users,
  Layers, DollarSign, Target, CheckSquare,
  CalendarDays, Brain, Settings, LogOut,
  MoreHorizontal, X,
} from 'lucide-react'

const PINNED = [
  { href: '/dashboard', label: 'Home',     icon: LayoutDashboard },
  { href: '/pipeline',  label: 'Pipeline', icon: Kanban },
  { href: '/conteudo',  label: 'Conteúdo', icon: Newspaper },
  { href: '/clientes',  label: 'Clientes', icon: Users },
]

const MORE_NAV = [
  { href: '/projetos',     label: 'Projetos',   icon: Layers },
  { href: '/financeiro',   label: 'Financeiro', icon: DollarSign },
  { href: '/metas',        label: 'Metas',      icon: Target },
  { href: '/tarefas',      label: 'Tarefas',    icon: CheckSquare },
  { href: '/ia',           label: 'Central IA', icon: Brain },
  { href: '/calendario',   label: 'Calendário', icon: CalendarDays },
  { href: '/configuracoes',label: 'Config.',    icon: Settings },
]

export function MobileNav() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)

  // fechar gaveta ao navegar
  useEffect(() => { setOpen(false) }, [pathname])

  // fechar com Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isMoreActive = MORE_NAV.some(n =>
    pathname === n.href || (pathname.startsWith(n.href + '/'))
  )

  return (
    <>
      {/* Gaveta "Mais" */}
      {open && (
        <div className="fixed inset-0 z-[60] md:hidden" onClick={() => setOpen(false)}>
          {/* overlay */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* sheet */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-[#0d0d0d] border-t border-[#1f1f1f] rounded-t-2xl pb-safe"
            onClick={e => e.stopPropagation()}
          >
            {/* handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-[#333] rounded-full" />
            </div>

            {/* header */}
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Menu</span>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-[#1a1a1a] text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* nav grid */}
            <div className="grid grid-cols-4 gap-1 px-3 pb-2">
              {MORE_NAV.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex flex-col items-center gap-1.5 py-4 rounded-xl transition-colors ${
                      active
                        ? 'bg-[#7c3aed]/15 text-[#a78bfa]'
                        : 'text-[#666] hover:text-foreground hover:bg-[#1a1a1a]'
                    }`}
                  >
                    <Icon size={22} strokeWidth={active ? 2 : 1.5} />
                    <span className="text-[10px] font-medium">{label}</span>
                  </Link>
                )
              })}
            </div>

            {/* sair */}
            <div className="px-4 py-3 border-t border-[#1a1a1a]">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm text-muted-foreground hover:text-[#ef4444] hover:bg-[#ef4444]/5 transition-colors"
              >
                <LogOut size={15} strokeWidth={1.5} />
                Sair
              </button>
            </div>

            {/* safe area spacer */}
            <div className="h-6" />
          </div>
        </div>
      )}

      {/* Barra inferior */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d0d]/95 backdrop-blur-md border-t border-[#1f1f1f] flex md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {PINNED.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
                active ? 'text-[#a78bfa]' : 'text-[#555] hover:text-[#888]'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2 : 1.5} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}

        {/* botão Mais */}
        <button
          onClick={() => setOpen(true)}
          className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
            open || isMoreActive ? 'text-[#a78bfa]' : 'text-[#555] hover:text-[#888]'
          }`}
        >
          <MoreHorizontal size={22} strokeWidth={open || isMoreActive ? 2 : 1.5} />
          <span className="text-[10px] font-medium">Mais</span>
        </button>
      </nav>
    </>
  )
}
