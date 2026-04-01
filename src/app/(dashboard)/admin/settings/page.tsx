import { createClient } from '@/lib/supabase/server'
import { checkRole } from '@/lib/roles'
import { redirect } from 'next/navigation'
import { SheetsConfigForm } from '@/components/settings/sheets-config-form'

export default async function AdminSettingsPage() {
  const isAdmin = await checkRole('admin')
  if (!isAdmin) redirect('/rep')

  const supabase = await createClient()
  const { data: config } = await supabase
    .from('sheets_config')
    .select('sheet_url, tab_name, last_synced_at')
    .limit(1)
    .single()

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <SheetsConfigForm config={config} />
    </div>
  )
}
