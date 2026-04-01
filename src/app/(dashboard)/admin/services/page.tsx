import { createClient } from '@/lib/supabase/server'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AddPackageDialog } from './components'
import { EditPackageDialog } from './components'
import { DeletePackageButton } from './components'

export default async function AdminServicesPage() {
  const supabase = await createClient()

  const { data: packages } = await supabase
    .from('service_packages')
    .select('id, name, created_at')
    .order('name')

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Service Packages</h1>
        <AddPackageDialog />
      </div>

      <div className="mt-6">
        {!packages || packages.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-muted-foreground">No service packages yet.</p>
            <AddPackageDialog />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell className="font-medium">{pkg.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(pkg.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <EditPackageDialog id={pkg.id} name={pkg.name} />
                      <DeletePackageButton id={pkg.id} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
