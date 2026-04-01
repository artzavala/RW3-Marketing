import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single()

  return (
    <SidebarProvider>
      <AppSidebar
        name={profile?.name ?? ''}
        email={user.email ?? ''}
        role={profile?.role ?? 'rep'}
      />
      <main className="flex-1 overflow-auto bg-background">
        <header className="flex items-center gap-2 border-b bg-card px-4 py-2.5">
          <SidebarTrigger />
        </header>
        <div className="p-6">
          {children}
        </div>
      </main>
    </SidebarProvider>
  )
}
