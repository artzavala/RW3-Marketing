import { checkRole } from '@/lib/roles'
import { redirect } from 'next/navigation'
import { Users, Package, BarChart3, Settings } from 'lucide-react'
import Link from 'next/link'

export default async function AdminDashboard() {
  const isAdmin = await checkRole('admin')
  if (!isAdmin) redirect('/rep')

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back. Here's what's happening.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/admin/clients" className="group rounded-xl border bg-card p-6 hover:shadow-md transition-all duration-200 cursor-pointer">
          <div className="flex items-start justify-between">
            <div className="rounded-lg bg-blue-50 p-2.5">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-muted-foreground">Clients</p>
            <p className="mt-1 text-sm text-muted-foreground">Manage accounts and rep assignments</p>
          </div>
          <p className="mt-4 text-xs font-medium text-primary group-hover:underline">View clients →</p>
        </Link>

        <div className="rounded-xl border bg-card p-6 opacity-60">
          <div className="flex items-start justify-between">
            <div className="rounded-lg bg-amber-50 p-2.5">
              <BarChart3 className="h-5 w-5 text-amber-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-muted-foreground">Signals</p>
            <p className="mt-1 text-sm text-muted-foreground">Client activity and engagement alerts</p>
          </div>
          <p className="mt-4 text-xs font-medium text-muted-foreground">Coming soon</p>
        </div>

        <Link href="/admin/services" className="group rounded-xl border bg-card p-6 hover:shadow-md transition-all duration-200 cursor-pointer">
          <div className="flex items-start justify-between">
            <div className="rounded-lg bg-emerald-50 p-2.5">
              <Package className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-muted-foreground">Services</p>
            <p className="mt-1 text-sm text-muted-foreground">Manage service packages and offerings</p>
          </div>
          <p className="mt-4 text-xs font-medium text-primary group-hover:underline">View services →</p>
        </Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Link href="/admin/settings" className="group rounded-xl border bg-card p-6 hover:shadow-md transition-all duration-200 cursor-pointer">
          <div className="flex items-start justify-between">
            <div className="rounded-lg bg-slate-100 p-2.5">
              <Settings className="h-5 w-5 text-slate-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-muted-foreground">Settings</p>
            <p className="mt-1 text-sm text-muted-foreground">Configure Google Sheets sync and integrations</p>
          </div>
          <p className="mt-4 text-xs font-medium text-primary group-hover:underline">Open settings →</p>
        </Link>
      </div>
    </div>
  )
}
