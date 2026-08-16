import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { OmarButton } from '@/components/domain/omar/OmarButton'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <MobileNav />
      <OmarButton />
      <main className="md:ml-[200px] min-h-screen pb-safe-nav md:pb-0">
        <div className="max-w-6xl mx-auto px-4 md:px-8 pb-6 md:py-8 pt-safe-top">
          {children}
        </div>
      </main>
    </div>
  )
}
