import { checkRole } from '@/lib/roles'
import { redirect } from 'next/navigation'

export default async function AdminDashboard() {
  const isAdmin = await checkRole('admin')
  if (!isAdmin) redirect('/rep')

  return (
    <div>
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Welcome to the Client Intelligence Platform. Manage clients, view signals, and monitor trends.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-6">
          <h3 className="font-semibold">Clients</h3>
          <p className="mt-1 text-sm text-muted-foreground">No clients yet. Add clients in Phase 2.</p>
        </div>
        <div className="rounded-lg border p-6">
          <h3 className="font-semibold">Signals</h3>
          <p className="mt-1 text-sm text-muted-foreground">No signals yet. Scanning starts in Phase 4.</p>
        </div>
        <div className="rounded-lg border p-6">
          <h3 className="font-semibold">Team</h3>
          <p className="mt-1 text-sm text-muted-foreground">Manage team members and roles.</p>
        </div>
      </div>
    </div>
  )
}
