import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default async function RepClientsPage() {
  const supabase = await createClient()

  const { data: clients } = await supabase
    .from('clients')
    .select(`
      id,
      name,
      website,
      client_services ( count )
    `)
    .order('name')

  return (
    <div>
      <h1 className="text-2xl font-bold">My Clients</h1>

      <div className="mt-6">
        {!clients || clients.length === 0 ? (
          <p className="text-center text-muted-foreground">
            No clients assigned to you yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Services</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => {
                const serviceCount = Array.isArray(client.client_services)
                  ? (client.client_services[0] as { count: number } | undefined)?.count ?? 0
                  : 0

                return (
                  <TableRow key={client.id}>
                    <TableCell>
                      <Link
                        href={`/rep/clients/${client.id}`}
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
                    <TableCell>{serviceCount}</TableCell>
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
