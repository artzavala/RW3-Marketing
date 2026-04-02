// scripts/seed-signals.ts
// Inserts fixture signals for all clients directly — no scan needed.
// Usage: npx tsx scripts/seed-signals.ts
//
// Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const SIGNAL_TYPES = ['news', 'funding', 'hiring', 'risk']

async function seed() {
  const { data: clients } = await supabase.from('clients').select('id, name')
  if (!clients?.length) {
    console.log('No clients found. Add clients first.')
    return
  }

  for (const client of clients) {
    const signals = Array.from({ length: 5 }, (_, i) => ({
      client_id: client.id,
      headline: `[Seed] ${client.name} — signal ${i + 1}`,
      source_url: `https://example.com/seed-${client.id}-${i + 1}`,
      published_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
      summary: `This is a seeded signal for ${client.name} to test the signals UI.`,
      score: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5,
      signal_type: SIGNAL_TYPES[i % SIGNAL_TYPES.length],
      opportunity: i % 2 === 0,
    }))

    const { error } = await supabase.from('signals').upsert(signals, {
      onConflict: 'client_id,source_url',
    })

    if (error) {
      console.error(`Error seeding ${client.name}:`, error.message)
    } else {
      console.log(`Seeded 5 signals for ${client.name}`)
    }
  }
}

seed().catch(console.error)
