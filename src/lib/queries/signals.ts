// src/lib/queries/signals.ts
import { SupabaseClient } from '@supabase/supabase-js'

export type SignalFilters = {
  clientId?: string
  score?: string
  type?: string
  status?: string
}

export async function fetchSignals(
  supabase: SupabaseClient,
  userId: string,
  isAdmin: boolean,
  filters: SignalFilters
) {
  // signal_actions filtered to current user's actions only
  let query = supabase
    .from('signals')
    .select(`
      id, headline, source_url, published_at, summary, score, signal_type, opportunity, created_at,
      clients!inner(id, name, assigned_rep),
      signal_actions(status, note)
    `)
    .eq('signal_actions.user_id', userId)
    .order('created_at', { ascending: false })

  if (!isAdmin) {
    // Rep: only their assigned clients (belt-and-suspenders alongside RLS)
    query = query.eq('clients.assigned_rep', userId)
  }

  if (filters.clientId) {
    query = query.eq('client_id', filters.clientId)
  }

  if (filters.score) {
    query = query.eq('score', parseInt(filters.score))
  }

  if (filters.type) {
    query = query.eq('signal_type', filters.type)
  }

  if (filters.status === 'unactioned') {
    query = query.is('signal_actions.status', null)
  } else if (filters.status) {
    query = query.eq('signal_actions.status', filters.status)
  }

  const { data, error } = await query

  if (error) return { signals: [], error: error.message }

  const signals = (data ?? []).map((row) => {
    const userAction = (row.signal_actions as { status: string; note: string | null }[] | null)?.[0] ?? null
    return {
      id: row.id,
      headline: row.headline,
      source_url: row.source_url,
      published_at: row.published_at,
      summary: row.summary,
      score: row.score,
      signal_type: row.signal_type,
      opportunity: row.opportunity,
      client_name: (Array.isArray(row.clients)
        ? (row.clients[0] as { name: string } | undefined)?.name
        : (row.clients as { name: string } | null)?.name),
      action: userAction,
    }
  })

  return { signals, error: null }
}
