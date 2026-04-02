// src/app/api/cron/scan/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scanClient } from '@/lib/scanner'

export async function GET(req: NextRequest) {
  // Verify cron secret.
  // On Vercel Pro, set CRON_SECRET as a Vercel env var — Vercel injects it automatically
  // as `Authorization: Bearer <secret>` on every cron invocation.
  // On Vercel Hobby, Vercel does NOT send this header — the endpoint will return 401 for
  // every cron call. Options: (a) upgrade to Pro, or (b) remove this check and rely on
  // the obscurity of the endpoint path (acceptable for non-sensitive operations).
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminSupabase = createAdminClient()

  const { data: clients, error } = await adminSupabase
    .from('clients')
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const clientIds = (clients ?? []).map((c) => c.id)

  const { data: run, error: runError } = await adminSupabase
    .from('scan_runs')
    .insert({
      triggered_by: 'cron',
      status: 'running',
      client_count: clientIds.length,
    })
    .select('id')
    .single()

  if (runError || !run) {
    return NextResponse.json(
      { error: `Failed to create scan run: ${runError?.message ?? 'unknown'}` },
      { status: 500 }
    )
  }

  // Scan each client sequentially
  // NOTE: On Vercel Hobby (10s limit) this handles ~3 clients.
  // On Pro with Fluid Compute (800s) it handles larger sets.
  const results = []
  for (const id of clientIds) {
    const result = await scanClient(id)
    results.push(result)
  }

  const failed = results.filter((r) => r.error).length

  await adminSupabase
    .from('scan_runs')
    .update({
      status: failed === results.length && results.length > 0 ? 'failed' : 'complete',
      completed_at: new Date().toISOString(),
    })
    .eq('id', run.id)

  return NextResponse.json({ scanned: results.length, failed, results })
}
