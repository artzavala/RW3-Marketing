import { createClient } from '@/lib/supabase/server'

export type Role = 'admin' | 'rep'

export async function getRole(): Promise<Role | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return (profile?.role as Role) ?? null
}

export async function checkRole(role: Role): Promise<boolean> {
  return (await getRole()) === role
}
