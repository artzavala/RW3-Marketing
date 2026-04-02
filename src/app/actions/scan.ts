'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scanClient } from '@/lib/scanner'
import { revalidatePath } from 'next/cache'

export type ScanActionState = {
  error?: string
  inserted?: number
  skipped?: number
}

export async function triggerScan(clientId: string): Promise<ScanActionState> {
  // Verify the calling user has access to this client via RLS
  const supabase = await createClient()
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .single()

  if (!client) return { error: 'Client not found or access denied' }

  const adminSupabase = createAdminClient()
  const { data: run, error: runError } = await adminSupabase
    .from('scan_runs')
    .insert({ triggered_by: 'manual', status: 'running', client_count: 1 })
    .select('id')
    .single()

  if (runError || !run) {
    return { error: `Failed to create scan run: ${runError?.message ?? 'unknown'}` }
  }

  const result = await scanClient(clientId)

  await adminSupabase
    .from('scan_runs')
    .update({
      status: result.error ? 'failed' : 'complete',
      error: result.error ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', run.id)

  revalidatePath(`/admin/clients/${clientId}`)
  revalidatePath(`/rep/clients/${clientId}`)

  if (result.error) return { error: result.error }
  return { inserted: result.inserted, skipped: result.skipped }
}
