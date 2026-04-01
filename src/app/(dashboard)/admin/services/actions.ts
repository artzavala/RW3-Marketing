'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { checkRole } from '@/lib/roles'

type ActionState = { error: string } | null

export async function createPackageAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const isAdmin = await checkRole('admin')
  if (!isAdmin) return { error: 'Unauthorized' }

  const supabase = await createClient()

  const name = formData.get('name') as string
  const description = formData.get('description') as string | null

  if (!name?.trim()) return { error: 'Name is required' }

  const { error } = await supabase
    .from('service_packages')
    .insert({ name: name.trim(), description: description?.trim() || null })

  if (error) return { error: error.message }

  revalidatePath('/admin/services')
  return null
}

export async function updatePackageAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const isAdmin = await checkRole('admin')
  if (!isAdmin) return { error: 'Unauthorized' }

  const supabase = await createClient()

  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const description = formData.get('description') as string | null

  if (!id) return { error: 'ID is required' }
  if (!name?.trim()) return { error: 'Name is required' }

  const { error } = await supabase
    .from('service_packages')
    .update({ name: name.trim(), description: description?.trim() || null })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/services')
  return null
}

export async function deletePackageAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const isAdmin = await checkRole('admin')
  if (!isAdmin) return { error: 'Unauthorized' }

  const supabase = await createClient()

  const id = formData.get('id') as string
  if (!id) return { error: 'ID is required' }

  const { error } = await supabase
    .from('service_packages')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/services')
  return null
}
