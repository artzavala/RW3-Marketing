import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DeleteClientButton } from './delete-client-button'

export default async function AdminClientsPage() {
  const supabase = await createClient()

  const { data: clients } = await supabase
    .from('clients')
    .select(`
      id,
      name,
      website,
      created_at,
      assigned_rep:profiles!clients_assigned_rep_fkey(id, name),
      client_services(count)
    `)
    .order('name')

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clients</h1>
        <Link href="/admin/clients/new" className={buttonVariants({ variant: 'default' })}>
          Add Client
        </Link>
      </div>

      <div className="mt-6">
        {!clients || clients.length === 0 ? (
          <p className="text-muted-foreground">
            No clients yet. Add your first client.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Assigned Rep</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => {
                const rep = Array.isArray(client.assigned_rep)
                  ? client.assigned_rep[0]
                  : client.assigned_rep
                const serviceCount = Array.isArray(client.client_services)
                  ? (client.client_services[0] as { count: number } | undefined)?.count ?? 0
                  : 0

                return (
                  <TableRow key={client.id}>
                    <TableCell>
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {client.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {client.website ? (
                        <a
                          href={client.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground underline-offset-4 hover:underline"
                        >
                          {client.website}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {rep ? (
                        <span>{(rep as { name: string }).name}</span>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>{serviceCount}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/clients/${client.id}`}
                          className={buttonVariants({ variant: 'outline', size: 'sm' })}
                        >
                          Edit
                        </Link>
                        <DeleteClientButton clientId={client.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
