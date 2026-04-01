import Link from 'next/link'
import { Users } from 'lucide-react'
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
      <div className="flex items-center justify-between pb-4 border-b mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Clients{clients && clients.length > 0 && <span className="ml-2 rounded-full bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5">{clients.length}</span>}</h1>
          <p className="text-muted-foreground text-sm mt-1">Your assigned accounts.</p>
        </div>
      </div>

      <div className="mt-6">
        {!clients || clients.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">No clients assigned to you yet.</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/50">
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
                  <TableRow key={client.id} className="hover:bg-muted/30 transition-colors duration-150 cursor-pointer">
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
