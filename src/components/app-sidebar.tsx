'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { LayoutDashboard, Users, Briefcase, LogOut } from 'lucide-react'
import Link from 'next/link'

interface AppSidebarProps {
  name: string
  email: string
  role: string
}

function LogoMark() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Outer square */}
      <rect
        x="2"
        y="2"
        width="24"
        height="24"
        rx="5"
        stroke="oklch(0.55 0.18 234)"
        strokeWidth="1.75"
        fill="oklch(0.24 0.04 254)"
      />
      {/* Abstract C-shape — two arcs forming a bracket */}
      <path
        d="M18 8.5 C13 8.5 10 11 10 14 C10 17 13 19.5 18 19.5"
        stroke="oklch(0.72 0.18 220)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Small accent dot */}
      <circle cx="18.5" cy="14" r="1.5" fill="oklch(0.72 0.18 220)" />
    </svg>
  )
}

export function AppSidebar({ name, email, role }: AppSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
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

  const displayName = name || email
  const initials = displayName.charAt(0).toUpperCase()

  return (
    <Sidebar className="border-r-0">
      {/* Brand header */}
      <SidebarHeader className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-wide text-sidebar-foreground">
              Client Intel
            </span>
            <span className="text-[10px] font-medium tracking-widest uppercase text-sidebar-foreground/40">
              CRM
            </span>
          </div>
        </div>
      </SidebarHeader>

      {/* Nav */}
      <SidebarContent className="px-2 py-3">
        <SidebarMenu>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  render={<Link href={item.href} />}
                  isActive={isActive}
                  className={[
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium cursor-pointer',
                    'transition-colors duration-150',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                  ].join(' ')}
                >
                  <item.icon
                    className={[
                      'h-4 w-4 shrink-0',
                      isActive
                        ? 'text-sidebar-ring'
                        : 'text-sidebar-foreground/50',
                    ].join(' ')}
                  />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-ring/20 text-sm font-semibold text-sidebar-ring select-none">
            {initials}
          </div>

          {/* Name + role */}
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-sidebar-foreground leading-tight">
              {displayName}
            </span>
            <span
              className={[
                'mt-0.5 w-fit rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                isAdmin
                  ? 'bg-blue-500/15 text-blue-400'
                  : 'bg-slate-500/15 text-slate-400',
              ].join(' ')}
            >
              {role}
            </span>
          </div>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-sidebar-foreground/40 transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
