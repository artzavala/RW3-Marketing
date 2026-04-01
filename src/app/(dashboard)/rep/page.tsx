import { Users, BarChart3 } from 'lucide-react'
import Link from 'next/link'

export default function RepDashboard() {
  return (
    <div>
      <div className="mb-8 rounded-xl bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-6 text-white">
        <h1 className="text-2xl font-bold tracking-tight">My Dashboard</h1>
        <p className="mt-1 text-slate-300 text-sm">Your assigned clients and activity.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/rep/clients" className="group rounded-xl border bg-card p-6 hover:shadow-md transition-all duration-200 cursor-pointer border-l-4 border-l-blue-500">
          <div className="flex items-start justify-between">
            <div className="rounded-lg bg-blue-50 p-2.5">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-muted-foreground">My Clients</p>
            <p className="mt-1 text-sm text-muted-foreground">View your assigned accounts and services</p>
          </div>
          <p className="mt-4 text-xs font-medium text-primary group-hover:underline">View clients →</p>
        </Link>

        <div className="rounded-xl border bg-card p-6 opacity-60 border-l-4 border-l-amber-400">
          <div className="flex items-start justify-between">
            <div className="rounded-lg bg-amber-50 p-2.5">
              <BarChart3 className="h-5 w-5 text-amber-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-muted-foreground">Recent Signals</p>
            <p className="mt-1 text-sm text-muted-foreground">Client activity and engagement alerts</p>
          </div>
          <p className="mt-4 text-xs font-medium text-muted-foreground">Coming soon</p>
        </div>
      </div>
    </div>
  )
}
