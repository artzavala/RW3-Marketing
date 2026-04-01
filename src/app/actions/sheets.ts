'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readSheet } from '@/lib/sheets'
import { revalidatePath } from 'next/cache'

export type SheetsConfigState = { error?: string; success?: boolean }
export type SyncResult = {
  error?: string
  created?: number
  updated?: number
  errors?: string[]
}

export async function saveConfig(
  _prevState: SheetsConfigState,
  formData: FormData
): Promise<SheetsConfigState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const sheetUrl = (formData.get('sheet_url') as string)?.trim()
  const tabName = (formData.get('tab_name') as string)?.trim() || 'Sheet1'

  if (!sheetUrl) return { error: 'Sheet URL is required' }

  // Upsert — only one config row ever exists
  const { data: existing } = await supabase
    .from('sheets_config')
    .select('id')
    .limit(1)
    .single()

  if (existing) {
    const { error } = await supabase
      .from('sheets_config')
      .update({ sheet_url: sheetUrl, tab_name: tabName })
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('sheets_config')
      .insert({ sheet_url: sheetUrl, tab_name: tabName, created_by: user.id })
    if (error) return { error: error.message }
  }

  revalidatePath('/admin/settings')
  return { success: true }
}

export async function syncSheet(): Promise<SyncResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return { error: 'Not authorized' }

  const adminSupabase = createAdminClient()

  // Load config
  const { data: config } = await supabase
    .from('sheets_config')
    .select('*')
    .limit(1)
    .single()

  if (!config) return { error: 'No sheet configured. Save a Sheet URL first.' }

  // Read rows from sheet
  let rows
  try {
    rows = await readSheet(config.sheet_url, config.tab_name)
  } catch (err) {
    return { error: `Could not read sheet: ${err instanceof Error ? err.message : String(err)}` }
  }

  // Build rep name → profile id map
  const repNames = [...new Set(rows.map((r) => r.repName).filter(Boolean))]
  const { data: repProfiles } = await adminSupabase
    .from('profiles')
    .select('id, name')
    .in('name', repNames)

  const repMap = new Map((repProfiles ?? []).map((p) => [p.name, p.id]))

  let created = 0
  let updated = 0
  const errors: string[] = []

  for (const row of rows) {
    const assignedRepId = row.repName ? (repMap.get(row.repName) ?? null) : null

    const { data: existing } = await adminSupabase
      .from('clients')
      .select('id')
      .eq('sheets_row_id', String(row.rowIndex))
      .single()

    if (existing) {
      const { error } = await adminSupabase
        .from('clients')
        .update({
          name: row.name,
          website: row.website || null,
          assigned_rep: assignedRepId,
        })
        .eq('id', existing.id)

      if (error) errors.push(`Row ${row.rowIndex}: ${error.message}`)
      else updated++
    } else {
      const { error } = await adminSupabase.from('clients').insert({
        name: row.name,
        website: row.website || null,
        assigned_rep: assignedRepId,
        sheets_row_id: String(row.rowIndex),
      })

      if (error) errors.push(`Row ${row.rowIndex}: ${error.message}`)
      else created++
    }
  }

  // Update last_synced_at
  await adminSupabase
    .from('sheets_config')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', config.id)

  revalidatePath('/admin/clients')
  revalidatePath('/admin/settings')

  return { created, updated, errors }
}
