'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Layers, Newspaper, Kanban } from 'lucide-react'

const NAV = [
  { href: '/dashboard', label: 'Home',     icon: LayoutDashboard },
  { href: '/pipeline',  label: 'Pipeline', icon: Kanban },
  { href: '/clientes',  label: 'Clientes', icon: Users },
  { href: '/projetos',  label: 'Projetos', icon: Layers },
  { href: '/conteudo',  label: 'Conteúdo', icon: Newspaper },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d0d]/95 backdrop-blur-md border-t border-[#1f1f1f] flex md:hidden safe-bottom">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
        return (
          <Link key={href} href={href}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
              active ? 'text-[#a78bfa]' : 'text-[#555] hover:text-[#888]'
            }`}>
            <Icon size={22} strokeWidth={active ? 2 : 1.5} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
