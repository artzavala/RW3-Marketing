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
