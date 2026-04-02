import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { ScanButton } from '@/components/clients/scan-button'
import { fetchSignals } from '@/lib/queries/signals'
import { SignalCard } from '@/components/signals/signal-card'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function RepClientDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, website')
    .eq('id', id)
    .single()

  if (!client) {
    notFound()
  }

  const [{ data: services }, { signals }] = await Promise.all([
    supabase
      .from('client_services')
      .select(`
        service_package_id,
        service_packages ( name )
      `)
      .eq('client_id', id),
    fetchSignals(supabase, user.id, false, { clientId: id }),
  ])

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link
          href="/rep/clients"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
        >
          ← Back to My Clients
        </Link>
      </div>

      {/* Section 1: Client Information */}
      <div className="rounded-xl border bg-card p-6">
        <h1 className="text-2xl font-bold">{client.name}</h1>

        <dl className="mt-4 space-y-3">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Website</dt>
            <dd className="mt-1">
              {client.website ? (
                <a
                  href={client.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-4 hover:underline"
                >
                  {client.website}
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </dd>
          </div>

        </dl>
      </div>

      {/* Section 2: Scanning */}
      <div className="mt-6 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Scanning</h2>
        <div className="mt-3">
          <ScanButton clientId={client.id} />
        </div>
      </div>

      {/* Section 3: Signals */}
      <div className="mt-6 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold mb-3">
          Signals
          {signals.length > 0 && (
            <span className="ml-2 text-muted-foreground font-normal text-base">({signals.length})</span>
          )}
        </h2>
        {signals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No signals yet. Click &quot;Scan now&quot; above.</p>
        ) : (
          <div className="space-y-3">
            {signals.map((signal) => (
              <SignalCard key={signal.id} signal={signal} />
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Assigned Services */}
      <div className="mt-6 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Services</h2>

        <div className="mt-3">
          {!services || services.length === 0 ? (
            <p className="text-muted-foreground">No services assigned.</p>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {services.map((svc) => {
                const pkg = Array.isArray(svc.service_packages)
                  ? (svc.service_packages[0] as { name: string } | undefined)
                  : (svc.service_packages as { name: string } | null)
                const name = pkg?.name ?? svc.service_package_id

                return (
                  <Badge key={svc.service_package_id} variant="secondary">
                    {name}
                  </Badge>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
