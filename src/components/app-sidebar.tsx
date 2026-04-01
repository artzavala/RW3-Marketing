'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { LayoutDashboard, Users, Briefcase, LogOut } from 'lucide-react'
import Link from 'next/link'

interface AppSidebarProps {
  name: string
  email: string
  role: string
}

export function AppSidebar({ name, email, role }: AppSidebarProps) {
  const router = useRouter()
  const isAdmin = role === 'admin'

  const navItems = [
    {
      label: 'Dashboard',
      href: isAdmin ? '/admin' : '/rep',
      icon: LayoutDashboard,
    },
    ...(isAdmin
      ? [
          { label: 'Clients', href: '/admin/clients', icon: Users },
          { label: 'Services', href: '/admin/services', icon: Briefcase },
        ]
      : [{ label: 'Clients', href: '/rep/clients', icon: Users }]),
  ]

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/sign-in')
    router.refresh()
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <span className="text-lg font-semibold">Client Intel</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton render={<Link href={item.href} />}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col text-sm">
            <span className="truncate font-medium">{name || email}</span>
            <span className="text-xs capitalize text-muted-foreground">{role}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
