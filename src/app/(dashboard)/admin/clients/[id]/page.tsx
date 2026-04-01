import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ClientEditForm, ServiceAssignmentForm } from './components'

type Props = {
  params: Promise<{ id: string }>
}

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const admin = createAdminClient()

  const [clientResult, packagesResult, assignedResult, repsResult] =
    await Promise.all([
      supabase
        .from('clients')
        .select(`
          id,
          name,
          website,
          assigned_rep,
          profiles!clients_assigned_rep_fkey ( id, name )
        `)
        .eq('id', id)
        .single(),

      supabase
        .from('service_packages')
        .select('id, name')
        .order('name'),

      supabase
        .from('client_services')
        .select('service_package_id')
        .eq('client_id', id),

      admin
        .from('profiles')
        .select('id, name')
        .eq('role', 'rep')
        .order('name'),
    ])

  const client = clientResult.data
  if (!client) notFound()

  const allPackages = packagesResult.data ?? []
  const assignedPackageIds = new Set(
    (assignedResult.data ?? []).map((r) => r.service_package_id as string)
  )
  const reps = repsResult.data ?? []

  const repProfile = Array.isArray(client.profiles)
    ? (client.profiles[0] as { id: string; name: string | null } | undefined)
    : (client.profiles as { id: string; name: string | null } | null | undefined)

  return (
    <div className="max-w-2xl space-y-8">
      <Link href="/admin/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ChevronLeft className="h-4 w-4" />Back to Clients
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{client.name}</h1>
        {client.website && (
          <a
            href={client.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {client.website}
          </a>
        )}
        {repProfile && (
          <p className="text-sm text-muted-foreground mt-1">
            Rep: {repProfile.name ?? 'Unknown'}
          </p>
        )}
      </div>

      {/* Section 1: Client Details */}
      <section className="rounded-xl border bg-card p-6 space-y-4">
        <h2 className="text-base font-semibold">Client Details</h2>
        <ClientEditForm
          client={{
            id: client.id,
            name: client.name,
            website: client.website ?? null,
            assigned_rep: client.assigned_rep ?? null,
          }}
          reps={reps.map((r) => ({ id: r.id, name: r.name ?? null }))}
        />
      </section>

      {/* Section 2: Service Packages */}
      <section className="rounded-xl border bg-card p-6 space-y-4">
        <h2 className="text-base font-semibold">Service Packages</h2>
        <ServiceAssignmentForm
          clientId={client.id}
          allPackages={allPackages.map((p) => ({ id: p.id, name: p.name }))}
          assignedPackageIds={assignedPackageIds}
        />
      </section>
    </div>
  )
}
