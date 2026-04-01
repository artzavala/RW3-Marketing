import { createAdminClient } from '@/lib/supabase/admin'
import { NewClientForm } from './new-client-form'

export default async function NewClientPage() {
  const adminSupabase = createAdminClient()
  const { data: reps } = await adminSupabase
    .from('profiles')
    .select('id, name')
    .eq('role', 'rep')
    .order('name')

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold">Add Client</h1>
      <p className="mt-1 text-muted-foreground">
        Create a new client and optionally assign a rep.
      </p>
      <div className="mt-6">
        <NewClientForm reps={reps ?? []} />
      </div>
    </div>
  )
}
