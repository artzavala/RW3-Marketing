'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type SignalActionState = { error?: string; success?: boolean }

export async function createAction(
  signalId: string,
  status: 'reviewed' | 'actioned' | 'dismissed',
  note?: string
): Promise<SignalActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('signal_actions')
    .upsert(
      {
        signal_id: signalId,
        user_id: user.id,
        status,
        note: note ?? null,
      },
      { onConflict: 'signal_id,user_id' }
    )

  if (error) return { error: error.message }

  revalidatePath('/admin/signals')
  revalidatePath('/rep/signals')

  return { success: true }
}
