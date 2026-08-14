'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getRole, ROLE_NAME, JULIA_NAV, type Role } from '@/lib/roles'
import { LayoutDashboard, Users, DollarSign, Target, LogOut, CheckSquare, Settings, CalendarDays, Kanban, Layers, Newspaper, Brain, Download } from 'lucide-react'

const ALL_NAV = [
  { href: '/dashboard',    label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/pipeline',     label: 'Pipeline',    icon: Kanban },
  { href: '/clientes',     label: 'Clientes',    icon: Users },
  { href: '/projetos',     label: 'Projetos',    icon: Layers },
  { href: '/conteudo',     label: 'Conteúdo',    icon: Newspaper },
  { href: '/ia',           label: 'Central IA',  icon: Brain },
  { href: '/financeiro',   label: 'Financeiro',  icon: DollarSign },
  { href: '/metas',        label: 'Metas',       icon: Target },
  { href: '/tarefas',      label: 'Tarefas',     icon: CheckSquare },
  { href: '/calendario',   label: 'Calendário',  icon: CalendarDays },
  { href: '/configuracoes',label: 'Config.',     icon: Settings },
]

const ROLE_COLOR: Record<Role, string> = {
  gustavo: '#a78bfa',
  gabriel: '#34d399',
  thomas:  '#60a5fa',
  admin:   '#f59e0b',
  julia:   '#f472b6',
  default: '#6b7280',
}

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  const [role, setRole]         = useState<Role>('default')
  const [userName, setUserName]   = useState('')
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const r = getRole(user.user_metadata)
      setRole(r)
      setUserName(ROLE_NAME[r] || (user.email?.split('@')[0] ?? ''))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (installPrompt as any).prompt()
    setInstallPrompt(null)
  }

  const nav = role === 'julia'
    ? JULIA_NAV.map(href => ALL_NAV.find(n => n.href === href)).filter(Boolean) as typeof ALL_NAV
    : ALL_NAV

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const accentColor = ROLE_COLOR[role]

  return (
    <aside className="fixed left-0 top-0 h-full w-[200px] bg-[#0d0d0d] border-r border-[#1f1f1f] hidden md:flex flex-col z-40">
      {/* Logo */}
      <div className="px-6 py-6">
        <div>
          <span className="text-3xl font-black tracking-tighter text-foreground leading-none">a.</span>
          <p className="text-[8px] tracking-[0.3em] text-muted-foreground uppercase mt-0.5">mkt.club</p>
        </div>

        {/* Saudação */}
        {userName && (
          <div className="mt-4 flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
              style={{ background: accentColor }}
            >
              {userName[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-foreground truncate">{userName}</p>
              <p className="text-[9px] text-muted-foreground">
                {role === 'julia' ? 'Social Media' : role === 'admin' ? 'Admin' : 'Sócio'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-1 transition-colors ${
                active
                  ? 'bg-[#7c3aed]/10 text-[#a78bfa]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a]'
              }`}
            >
              <Icon size={16} strokeWidth={active ? 2 : 1.5} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-[#1f1f1f] flex flex-col gap-1">
        {installPrompt && (
          <button
            onClick={handleInstall}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-[#a78bfa] hover:bg-[#7c3aed]/10 transition-colors"
          >
            <Download size={16} strokeWidth={1.5} />
            Instalar app
          </button>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a] transition-colors"
        >
          <LogOut size={16} strokeWidth={1.5} />
          Sair
        </button>
      </div>
    </aside>
  )
}
