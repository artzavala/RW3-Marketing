'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { checkRole } from '@/lib/roles'

type ActionState = { error: string } | null

export async function createClientAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const isAdmin = await checkRole('admin')
  if (!isAdmin) return { error: 'Unauthorized' }

  const supabase = await createClient()

  const name = formData.get('name') as string
  const website = formData.get('website') as string | null
  const assigned_rep = formData.get('assigned_rep') as string | null

  if (!name?.trim()) return { error: 'Name is required' }

  const { data, error } = await supabase
    .from('clients')
    .insert({
      name: name.trim(),
      website: website?.trim() || null,
      assigned_rep: assigned_rep || null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/admin/clients')
  redirect(`/admin/clients/${data.id}`)
}

export async function updateClientAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const isAdmin = await checkRole('admin')
  if (!isAdmin) return { error: 'Unauthorized' }

  const supabase = await createClient()

  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const website = formData.get('website') as string | null
  const assigned_rep = formData.get('assigned_rep') as string | null

  if (!id) return { error: 'ID is required' }
  if (!name?.trim()) return { error: 'Name is required' }

  const { error } = await supabase
    .from('clients')
    .update({
      name: name.trim(),
      website: website?.trim() || null,
      assigned_rep: assigned_rep || null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/clients')
  revalidatePath(`/admin/clients/${id}`)
  return null
}

export async function assignPackagesAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const isAdmin = await checkRole('admin')
  if (!isAdmin) return { error: 'Unauthorized' }

  const clientId = formData.get('client_id') as string
  const packageIds = formData.getAll('package_ids') as string[]

  const supabase = await createClient()

  // Delete all existing assignments for this client
  const { error: deleteError } = await supabase
    .from('client_services')
    .delete()
    .eq('client_id', clientId)

  if (deleteError) return { error: deleteError.message }

  // Insert new assignments (if any selected)
  if (packageIds.length > 0) {
    const { error: insertError } = await supabase
      .from('client_services')
      .insert(packageIds.map(pid => ({
        client_id: clientId,
        service_package_id: pid,
      })))

    if (insertError) return { error: insertError.message }
  }

  revalidatePath(`/admin/clients/${clientId}`)
  revalidatePath('/admin/clients')
  return null
}

export async function deleteClientAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const isAdmin = await checkRole('admin')
  if (!isAdmin) return { error: 'Unauthorized' }

  const supabase = await createClient()

  const id = formData.get('id') as string
  if (!id) return { error: 'ID is required' }

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/clients')
  return null
}
