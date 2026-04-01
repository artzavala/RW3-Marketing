import { Package } from 'lucide-react'
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
      <div className="flex items-center justify-between pb-4 border-b mb-6">
        <div>
          <h1 className="text-2xl font-bold">Service Packages{packages && packages.length > 0 && <span className="ml-2 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium px-2 py-0.5">{packages.length}</span>}</h1>
          <p className="text-muted-foreground text-sm mt-1">Define and manage service packages.</p>
        </div>
        <AddPackageDialog />
      </div>

      <div className="mt-6">
        {!packages || packages.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <Package className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">No service packages yet.</p>
            <AddPackageDialog />
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages.map((pkg) => (
                <TableRow key={pkg.id} className="hover:bg-muted/30 transition-colors duration-150">
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
