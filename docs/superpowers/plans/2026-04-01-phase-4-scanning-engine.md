# Phase 4 — AI Scanning Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A scan engine fetches recent news for each client, analyzes it with Gemini, and stores signals. Runs daily via cron and on-demand via a manual button. Works fully in mock mode when API keys are absent.

**Architecture:** `src/lib/scanner.ts` exports `scanClient()` which orchestrates search → analyze → store. Two internal helpers (`searchNews`, `analyzeArticle`) check for env vars and fall back to fixtures when absent. The cron route calls `scanClient()` for all active clients. A Server Action `triggerScan()` is called from the client detail page.

**Tech Stack:** Next.js 16, Supabase JS (service role for writes), Serper.dev REST API, Gemini REST API, vercel.json cron

**Prerequisite:** Phase 2 complete (clients table must exist).

---

## File Map

**New files:**
- `supabase/migrations/0005_create_scan_signals.sql` — scan_runs + signals tables + RLS
- `src/lib/scanner.ts` — scan engine with mock mode
- `src/app/actions/scan.ts` — triggerScan server action
- `src/app/api/cron/scan/route.ts` — cron endpoint
- `scripts/seed-signals.ts` — dev seed script
- `vercel.json` — cron schedule

**Modified files:**
- `src/app/(dashboard)/admin/clients/[id]/page.tsx` — add scan trigger UI
- `src/app/(dashboard)/rep/clients/[id]/page.tsx` — add scan trigger UI

---

## Task 1: Migration — scan_runs and signals tables

**Files:**
- Create: `supabase/migrations/0005_create_scan_signals.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0005_create_scan_signals.sql

CREATE TABLE public.scan_runs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by TEXT        NOT NULL CHECK (triggered_by IN ('manual', 'cron')),
  status       TEXT        NOT NULL DEFAULT 'running'
                           CHECK (status IN ('running', 'complete', 'failed')),
  client_count INT,
  error        TEXT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.scan_runs ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read scan runs
CREATE POLICY "Authenticated users can view scan runs"
  ON public.scan_runs FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only service role can write (no user-facing writes)

CREATE TABLE public.signals (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  headline     TEXT        NOT NULL,
  source_url   TEXT        NOT NULL,
  published_at TIMESTAMPTZ,
  summary      TEXT,
  score        INT         NOT NULL CHECK (score BETWEEN 1 AND 5),
  signal_type  TEXT        NOT NULL,
  opportunity  BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, source_url)
);

ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;

-- Admins can see all signals
CREATE POLICY "Admins can view all signals"
  ON public.signals FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Reps can see signals for their assigned clients
CREATE POLICY "Reps can view signals for assigned clients"
  ON public.signals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE id = client_id AND assigned_rep_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Apply in Supabase dashboard**

SQL Editor → paste and run.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0005_create_scan_signals.sql
git commit -m "feat(db): add scan_runs and signals tables with RLS"
```

---

## Task 2: Scanner library

**Files:**
- Create: `src/lib/scanner.ts`

- [ ] **Step 1: Write the scanner**

```typescript
// src/lib/scanner.ts
// Scan engine with mock mode.
// - If SERPER_API_KEY is absent: returns 3 fixture articles
// - If GEMINI_API_KEY is absent: returns fixture analysis
// Both mock paths insert real rows into the DB for testing.

import { createAdminClient } from '@/lib/supabase/admin'

// ── Types ─────────────────────────────────────────────────────────────────────

type Article = {
  headline: string
  url: string
  publishedAt: string | null
  snippet: string
}

type Analysis = {
  summary: string
  score: number       // 1–5
  signal_type: string // 'news' | 'funding' | 'hiring' | 'risk' | 'other'
  opportunity: boolean
}

export type ScanResult = {
  clientId: string
  inserted: number
  skipped: number   // duplicates
  error?: string
}

// ── Mock fixtures ─────────────────────────────────────────────────────────────

function mockArticles(clientName: string): Article[] {
  // Use crypto.randomUUID() to guarantee unique URLs even when called in rapid succession
  return [
    {
      headline: `${clientName} announces new product launch`,
      url: `https://example.com/mock-${crypto.randomUUID()}`,
      publishedAt: new Date().toISOString(),
      snippet: 'Mock article for testing.',
    },
    {
      headline: `${clientName} expands into new markets`,
      url: `https://example.com/mock-${crypto.randomUUID()}`,
      publishedAt: new Date().toISOString(),
      snippet: 'Mock article for testing.',
    },
    {
      headline: `${clientName} reports strong quarterly results`,
      url: `https://example.com/mock-${crypto.randomUUID()}`,
      publishedAt: new Date().toISOString(),
      snippet: 'Mock article for testing.',
    },
  ]
}

function mockAnalysis(): Analysis {
  return {
    summary: 'Mock signal for testing. Replace with real analysis by adding GEMINI_API_KEY.',
    score: 3,
    signal_type: 'news',
    opportunity: false,
  }
}

// ── Search ────────────────────────────────────────────────────────────────────

async function searchNews(clientName: string): Promise<Article[]> {
  if (!process.env.SERPER_API_KEY) {
    console.log(`[scanner] SERPER_API_KEY not set — using mock articles for "${clientName}"`)
    return mockArticles(clientName)
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  const res = await fetch('https://google.serper.dev/news', {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.SERPER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: `"${clientName}"`,
      num: 10,
      tbs: `cdr:1,cd_min:${thirtyDaysAgo}`,
    }),
  })

  if (!res.ok) throw new Error(`Serper API error: ${res.status}`)

  const data = await res.json()
  return ((data.news ?? []) as Record<string, string>[]).map((item) => ({
    headline: item.title ?? '',
    url: item.link ?? '',
    publishedAt: item.date ?? null,
    snippet: item.snippet ?? '',
  }))
}

// ── Analysis ──────────────────────────────────────────────────────────────────

async function analyzeArticle(article: Article, clientName: string): Promise<Analysis> {
  if (!process.env.GEMINI_API_KEY) {
    console.log(`[scanner] GEMINI_API_KEY not set — using mock analysis`)
    return mockAnalysis()
  }

  const prompt = `You are analyzing a news article about a client named "${clientName}".

Article headline: ${article.headline}
Article snippet: ${article.snippet}

Respond with a JSON object only (no markdown):
{
  "summary": "2-3 sentence summary relevant to a sales rep",
  "score": <integer 1-5 where 5 = highly relevant sales opportunity>,
  "signal_type": <one of: "news" | "funding" | "hiring" | "risk" | "other">,
  "opportunity": <true if this represents a sales opportunity, false otherwise>
}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  )

  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`)

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'

  try {
    return JSON.parse(text) as Analysis
  } catch {
    return mockAnalysis()
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function scanClient(clientId: string): Promise<ScanResult> {
  const adminSupabase = createAdminClient()

  // Fetch client name
  const { data: client, error: clientError } = await adminSupabase
    .from('clients')
    .select('name')
    .eq('id', clientId)
    .single()

  if (clientError || !client) {
    return { clientId, inserted: 0, skipped: 0, error: 'Client not found' }
  }

  let articles: Article[]
  try {
    articles = await searchNews(client.name)
  } catch (err) {
    return {
      clientId,
      inserted: 0,
      skipped: 0,
      error: `Search failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  let inserted = 0
  let skipped = 0

  for (const article of articles) {
    let analysis: Analysis
    try {
      analysis = await analyzeArticle(article, client.name)
    } catch {
      analysis = mockAnalysis()
    }

    const { error } = await adminSupabase.from('signals').insert({
      client_id: clientId,
      headline: article.headline,
      source_url: article.url,
      published_at: article.publishedAt,
      summary: analysis.summary,
      score: Math.min(5, Math.max(1, Math.round(analysis.score))),
      signal_type: analysis.signal_type,
      opportunity: analysis.opportunity,
    })

    if (error?.code === '23505') {
      // Unique constraint violation = duplicate URL, skip
      skipped++
    } else if (error) {
      console.error(`[scanner] insert error for ${article.url}:`, error.message)
      skipped++
    } else {
      inserted++
    }
  }

  return { clientId, inserted, skipped }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | head -40
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/scanner.ts
git commit -m "feat(scanner): scan engine with Serper+Gemini and mock fallback mode"
```

---

## Task 3: triggerScan server action

**Files:**
- Create: `src/app/actions/scan.ts`

- [ ] **Step 1: Write the action**

```typescript
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

  // Create scan_runs record
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

  // Update scan_runs
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
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | head -40
```

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/scan.ts
git commit -m "feat(actions): add triggerScan server action with access verification"
```

---

## Task 4: Cron endpoint

**Files:**
- Create: `src/app/api/cron/scan/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Write the cron route**

```typescript
// src/app/api/cron/scan/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scanClient } from '@/lib/scanner'

export async function GET(req: NextRequest) {
  // Verify cron secret.
  // On Vercel Pro, set CRON_SECRET as a Vercel env var and Vercel injects it automatically
  // as `Authorization: Bearer <secret>` on every cron invocation.
  // On Vercel Hobby, Vercel does NOT send this header — the endpoint will return 401 for
  // every cron call. Options: (a) upgrade to Pro, or (b) remove this check and rely on
  // the obscurity of the endpoint path (acceptable for non-sensitive operations).
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminSupabase = createAdminClient()

  // Fetch all active clients
  const { data: clients, error } = await adminSupabase
    .from('clients')
    .select('id')
    .eq('active', true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const clientIds = (clients ?? []).map((c) => c.id)

  // Create scan_runs record
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
    return NextResponse.json({ error: `Failed to create scan run: ${runError?.message ?? 'unknown'}` }, { status: 500 })
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
```

- [ ] **Step 2: Write vercel.json**

```json
{
  "crons": [
    {
      "path": "/api/cron/scan",
      "schedule": "0 6 * * *"
    }
  ]
}
```

- [ ] **Step 3: Add CRON_SECRET to env**

```bash
# Add to .env.local:
# CRON_SECRET=<generate a random string, e.g.: openssl rand -hex 32>
```

Vercel dashboard → Project Settings → Environment Variables → add `CRON_SECRET` for production.

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | head -40
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/ vercel.json
git commit -m "feat(cron): add daily scan cron endpoint with CRON_SECRET verification"
```

---

## Task 5: Scan trigger UI on client detail pages

**Files:**
- Modify: `src/app/(dashboard)/admin/clients/[id]/page.tsx`
- Modify: `src/app/(dashboard)/rep/clients/[id]/page.tsx`

- [ ] **Step 1: Create scan-button.tsx client component**

Create `src/components/clients/scan-button.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { triggerScan } from '@/app/actions/scan'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function ScanButton({ clientId }: { clientId: string }) {
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<{ inserted?: number; skipped?: number; error?: string } | null>(null)

  async function handleScan() {
    setPending(true)
    setResult(null)
    const r = await triggerScan(clientId)
    setResult(r)
    setPending(false)
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={handleScan} disabled={pending} variant="outline" size="sm">
        {pending ? 'Scanning…' : 'Scan now'}
      </Button>
      {result && !result.error && (
        <span className="text-sm text-muted-foreground">
          {result.inserted} new signal{result.inserted !== 1 ? 's' : ''}
          {result.skipped ? `, ${result.skipped} duplicate${result.skipped !== 1 ? 's' : ''} skipped` : ''}
        </span>
      )}
      {result?.error && (
        <span className="text-sm text-destructive">{result.error}</span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add scan section to admin client detail**

In `src/app/(dashboard)/admin/clients/[id]/page.tsx`, replace the Signals placeholder section:

```typescript
import { ScanButton } from '@/components/clients/scan-button'

// Inside the JSX, replace the "Signals" placeholder:
<div>
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-lg font-semibold">Scanning</h2>
  </div>
  <ScanButton clientId={id} />
  <p className="mt-3 text-sm text-muted-foreground">
    Signals appear in the Signals section after Phase 5 is built.
  </p>
</div>
```

- [ ] **Step 3: Add scan button to rep client detail**

Same pattern — add import and `<ScanButton clientId={id} />` to `rep/clients/[id]/page.tsx`.

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | head -40
```

- [ ] **Step 5: Manual test (mock mode)**

```bash
npm run dev
```

Navigate to a client detail page → click "Scan now". No API keys needed.
Expected: "3 new signals" (mock mode). Click again → "0 new signals, 3 duplicates skipped".

- [ ] **Step 6: Commit**

```bash
git add src/components/clients/scan-button.tsx src/app/(dashboard)/admin/clients/[id]/ src/app/(dashboard)/rep/clients/[id]/
git commit -m "feat(scan): add scan trigger UI to client detail pages"
```

---

## Task 6: Dev seed script

**Files:**
- Create: `scripts/seed-signals.ts`

- [ ] **Step 1: Write the seed script**

```typescript
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
  const { data: clients } = await supabase.from('clients').select('id, name').eq('active', true)
  if (!clients?.length) {
    console.log('No active clients found. Add clients first.')
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
```

- [ ] **Step 2: Test the script**

```bash
npx tsx scripts/seed-signals.ts
```

Expected: "Seeded 5 signals for [ClientName]" for each active client.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-signals.ts
git commit -m "feat(scripts): add signal seed script for dev testing"
```
