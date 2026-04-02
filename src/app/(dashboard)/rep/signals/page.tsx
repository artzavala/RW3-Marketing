import { createClient } from '@/lib/supabase/server'
import { checkRole } from '@/lib/roles'
import { redirect } from 'next/navigation'
import { fetchSignals } from '@/lib/queries/signals'
import { SignalFilters } from '@/components/signals/signal-filters'
import { SignalCard } from '@/components/signals/signal-card'

export default async function RepSignalsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; score?: string; type?: string; status?: string }>
}) {
  const isAdmin = await checkRole('admin')
  if (isAdmin) redirect('/admin/signals')

  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const [{ signals, error }, { data: clients }] = await Promise.all([
    fetchSignals(supabase, user.id, false, params),
    supabase
      .from('clients')
      .select('id, name')
      .eq('assigned_rep', user.id)
      .order('name'),
  ])

  return (
    <div>
      <div className="flex items-center justify-between pb-4 border-b mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            Signals
            {signals.length > 0 && (
              <span className="ml-2 rounded-full bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5">
                {signals.length}
              </span>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">News and activity signals for your clients.</p>
        </div>
      </div>
      <SignalFilters clients={clients ?? []} />
      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      {!signals.length ? (
        <div className="rounded-lg border p-12 text-center">
          <p className="text-muted-foreground">No signals yet. Run a scan on one of your clients.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {signals.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}
    </div>
  )
}
