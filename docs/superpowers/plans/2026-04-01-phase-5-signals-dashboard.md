# Phase 5 — Signals Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full signal feed (role-scoped), URL-based filtering, status workflow (Reviewed/Actioned/Dismissed) with optional notes, and signal list on each client detail page.

**Architecture:** Signal feeds are server components that read URL search params for filtering. The signal card is a client component with optimistic status updates. A single `createAction` server action upserts `signal_actions` on the `(signal_id, user_id)` unique key.

**Tech Stack:** Next.js 16, React 19, Supabase JS, shadcn/ui, Server Actions

**Prerequisite:** Phase 4 complete (signals table must exist and have data from seed script or scan).

---

## File Map

**New files:**
- `supabase/migrations/0006_create_signal_actions.sql` — signal_actions table + RLS
- `src/app/actions/signals.ts` — createAction server action
- `src/app/(dashboard)/admin/signals/page.tsx` — global signal feed (server component)
- `src/app/(dashboard)/admin/signals/loading.tsx` — skeleton loader
- `src/app/(dashboard)/rep/signals/page.tsx` — rep signal feed (server component)
- `src/app/(dashboard)/rep/signals/loading.tsx` — skeleton loader
- `src/components/signals/signal-card.tsx` — signal card with status actions ('use client')
- `src/components/signals/signal-filters.tsx` — filter bar ('use client')
- `src/components/signals/signal-list.tsx` — renders list of signal cards (server component)

**Modified files:**
- `src/app/(dashboard)/admin/clients/[id]/page.tsx` — add signal list section
- `src/app/(dashboard)/rep/clients/[id]/page.tsx` — add signal list section

---

## Task 1: Migration — signal_actions table

**Files:**
- Create: `supabase/migrations/0006_create_signal_actions.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0006_create_signal_actions.sql
-- One action per user per signal (upsert on conflict).

CREATE TABLE public.signal_actions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id  UUID        NOT NULL REFERENCES public.signals(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     TEXT        NOT NULL CHECK (status IN ('reviewed', 'actioned', 'dismissed')),
  note       TEXT,       -- nullable
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (signal_id, user_id)
);

ALTER TABLE public.signal_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own signal actions"
  ON public.signal_actions
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

- [ ] **Step 2: Apply in Supabase dashboard**

SQL Editor → paste and run.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0006_create_signal_actions.sql
git commit -m "feat(db): add signal_actions table with RLS"
```

---

## Task 2: Signal server action

**Files:**
- Create: `src/app/actions/signals.ts`

- [ ] **Step 1: Write the action**

```typescript
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

  // Revalidate all signal feed paths
  revalidatePath('/admin/signals')
  revalidatePath('/rep/signals')

  return { success: true }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | head -40
```

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/signals.ts
git commit -m "feat(actions): add createAction signal status server action"
```

---

## Task 3: Signal card component

**Files:**
- Create: `src/components/signals/signal-card.tsx`

- [ ] **Step 1: Install card and textarea shadcn components (if not already installed)**

```bash
npx shadcn@latest add card
```

(textarea was installed in Phase 2)

- [ ] **Step 2: Write signal-card.tsx**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { createAction } from '@/app/actions/signals'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

type SignalAction = { status: string; note: string | null } | null

type Signal = {
  id: string
  headline: string
  source_url: string
  published_at: string | null
  summary: string | null
  score: number
  signal_type: string
  opportunity: boolean
  client_name?: string  // shown on global feed, not client detail
  action: SignalAction
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score <= 2 ? 'bg-red-100 text-red-700' :
    score === 3 ? 'bg-yellow-100 text-yellow-700' :
    'bg-green-100 text-green-700'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {score}/5
    </span>
  )
}

export function SignalCard({ signal }: { signal: Signal }) {
  const [currentAction, setCurrentAction] = useState(signal.action)
  const [showNote, setShowNote] = useState(false)
  const [note, setNote] = useState(signal.action?.note ?? '')
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const domain = (() => { try { return new URL(signal.source_url).hostname } catch { return signal.source_url } })()

  function handleAction(status: 'reviewed' | 'actioned' | 'dismissed') {
    if (status === 'actioned' || status === 'dismissed') {
      setPendingStatus(status)
      setShowNote(true)
      return
    }
    submitAction(status, undefined)
  }

  function submitAction(status: 'reviewed' | 'actioned' | 'dismissed', noteText?: string) {
    // Optimistic update
    setCurrentAction({ status, note: noteText ?? null })
    setShowNote(false)
    setPendingStatus(null)

    startTransition(async () => {
      await createAction(signal.id, status, noteText)
    })
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <a
              href={signal.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold hover:underline line-clamp-2"
            >
              {signal.headline}
            </a>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{domain}</span>
              {signal.published_at && (
                <span>{new Date(signal.published_at).toLocaleDateString()}</span>
              )}
              {signal.client_name && <span className="font-medium text-foreground">{signal.client_name}</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <ScoreBadge score={signal.score} />
            <Badge variant="outline" className="text-xs">{signal.signal_type}</Badge>
            {signal.opportunity && (
              <Badge className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-100">opportunity</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {signal.summary && (
          <p className="text-sm text-muted-foreground">{signal.summary}</p>
        )}

        {showNote && pendingStatus && (
          <div className="space-y-2">
            <Textarea
              placeholder={`Add a note (optional)`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => submitAction(pendingStatus as 'actioned' | 'dismissed', note || undefined)}
                disabled={isPending}
              >
                {isPending ? 'Saving…' : 'Confirm'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowNote(false); setPendingStatus(null) }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {currentAction ? (
            <Badge variant="secondary" className="capitalize">{currentAction.status}</Badge>
          ) : null}
          {!showNote && (
            <div className="flex gap-1">
              {(['reviewed', 'actioned', 'dismissed'] as const).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={currentAction?.status === s ? 'default' : 'ghost'}
                  className="h-7 px-2 text-xs capitalize"
                  onClick={() => handleAction(s)}
                  disabled={isPending}
                >
                  {s}
                </Button>
              ))}
            </div>
          )}
        </div>
        {currentAction?.note && (
          <p className="text-xs text-muted-foreground italic">Note: {currentAction.note}</p>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | head -40
```

- [ ] **Step 4: Commit**

```bash
git add src/components/signals/signal-card.tsx
git commit -m "feat(signals): signal card with optimistic status actions and note input"
```

---

## Task 4: Signal filter bar

**Files:**
- Create: `src/components/signals/signal-filters.tsx`

- [ ] **Step 1: Write signal-filters.tsx**

```typescript
'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

type FilterProps = {
  clients?: { id: string; name: string }[]
}

const SIGNAL_TYPES = ['news', 'funding', 'hiring', 'risk', 'other']
const STATUSES = ['reviewed', 'actioned', 'dismissed']

export function SignalFilters({ clients }: FilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  function clearAll() {
    router.push(pathname)
  }

  const hasFilters = searchParams.toString() !== ''

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      {clients && clients.length > 0 && (
        <Select
          value={searchParams.get('client') ?? 'all'}
          onValueChange={(v) => updateParam('client', v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select
        value={searchParams.get('score') ?? 'all'}
        onValueChange={(v) => updateParam('score', v)}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="All scores" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All scores</SelectItem>
          {[5, 4, 3, 2, 1].map((s) => (
            <SelectItem key={s} value={String(s)}>Score {s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get('type') ?? 'all'}
        onValueChange={(v) => updateParam('type', v)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {SIGNAL_TYPES.map((t) => (
            <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get('status') ?? 'all'}
        onValueChange={(v) => updateParam('status', v)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="unactioned">Unactioned</SelectItem>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll}>Clear filters</Button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | head -40
```

- [ ] **Step 3: Commit**

```bash
git add src/components/signals/signal-filters.tsx
git commit -m "feat(signals): URL-based signal filter bar component"
```

---

## Task 5: Shared signal query helper

**Files:**
- Create: `src/lib/queries/signals.ts`

- [ ] **Step 1: Write the query helper**

This avoids duplicating the complex Supabase query across admin/rep/client-detail pages.

```typescript
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
  // signal_actions is filtered to the current user's actions only (privacy + correctness)
  let query = supabase
    .from('signals')
    .select(`
      id, headline, source_url, published_at, summary, score, signal_type, opportunity, created_at,
      clients!inner(id, name, assigned_rep_id),
      signal_actions(status, note)
    `)
    .eq('signal_actions.user_id', userId)  // only fetch this user's action
    .order('created_at', { ascending: false })

  // RLS enforces access, but we apply explicit filters here too
  if (!isAdmin) {
    // rep: only their assigned clients (belt-and-suspenders alongside RLS)
    query = query.eq('clients.assigned_rep_id', userId)
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

  // Apply status filter server-side to avoid post-limit correctness issues
  if (filters.status === 'unactioned') {
    // No action row for this user = signal_actions array is empty
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
      client_name: (row.clients as { name: string } | null)?.name,
      action: userAction,
    }
  })

  return { signals, error: null }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | head -40
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/queries/signals.ts
git commit -m "feat(queries): add shared fetchSignals query helper"
```

---

## Task 6: Admin and rep signals feed pages

**Files:**
- Create: `src/app/(dashboard)/admin/signals/page.tsx`
- Create: `src/app/(dashboard)/rep/signals/page.tsx`

- [ ] **Step 1: Write admin signals page**

```typescript
// src/app/(dashboard)/admin/signals/page.tsx
import { createClient } from '@/lib/supabase/server'
import { checkRole } from '@/lib/roles'
import { redirect } from 'next/navigation'
import { fetchSignals } from '@/lib/queries/signals'
import { SignalFilters } from '@/components/signals/signal-filters'
import { SignalCard } from '@/components/signals/signal-card'

export default async function AdminSignalsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; score?: string; type?: string; status?: string }>
}) {
  const isAdmin = await checkRole('admin')
  if (!isAdmin) redirect('/rep/signals')

  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const [{ signals, error }, { data: clients }] = await Promise.all([
    fetchSignals(supabase, user.id, true, params),
    supabase.from('clients').select('id, name').eq('active', true).order('name'),
  ])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Signals</h1>
      <SignalFilters clients={clients ?? []} />
      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      {!signals.length ? (
        <div className="rounded-lg border p-12 text-center">
          <p className="text-muted-foreground">No signals found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {signals.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write rep signals page**

```typescript
// src/app/(dashboard)/rep/signals/page.tsx
import { createClient } from '@/lib/supabase/server'
import { checkRole } from '@/lib/roles'
import { redirect } from 'next/navigation'
import { fetchSignals } from '@/lib/queries/signals'
import { SignalFilters } from '@/components/signals/signal-filters'
import { SignalCard } from '@/components/signals/signal-card'

export default async function RepSignalsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; score?: string; type?: string; status?: string }>
}) {
  const isAdmin = await checkRole('admin')
  if (isAdmin) redirect('/admin/signals')

  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  // Fetch only assigned clients for filter dropdown
  const [{ signals, error }, { data: clients }] = await Promise.all([
    fetchSignals(supabase, user.id, false, params),
    supabase
      .from('clients')
      .select('id, name')
      .eq('assigned_rep_id', user.id)
      .eq('active', true)
      .order('name'),
  ])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Signals</h1>
      <SignalFilters clients={clients ?? []} />
      {error && <p className="text-sm text-destructive mb-4">{error}</p>}
      {!signals.length ? (
        <div className="rounded-lg border p-12 text-center">
          <p className="text-muted-foreground">No signals yet. Run a scan on a client.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {signals.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | head -60
```

- [ ] **Step 4: Manual check**

```bash
npm run dev
```

1. Seed signals: `npx tsx scripts/seed-signals.ts`
2. Navigate to `/admin/signals` — cards render with score badges, type tags
3. Click "Reviewed" — badge updates optimistically
4. Click "Actioned" — note input appears, fill it, confirm — note shows below card
5. Filter by score/type/status — URL updates, list filters

- [ ] **Step 5: Add loading skeletons**

Create `src/app/(dashboard)/admin/signals/loading.tsx` and `src/app/(dashboard)/rep/signals/loading.tsx` (identical content):

```typescript
import { Skeleton } from '@/components/ui/skeleton'

export default function SignalsLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-32 mb-6" />
      <div className="flex gap-2 mb-6">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-36" />)}
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-36 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/admin/signals/ src/app/(dashboard)/rep/signals/
git commit -m "feat(signals): admin and rep signal feed pages with filtering and loading skeletons"
```

---

## Task 7: Add signals to client detail pages

**Files:**
- Modify: `src/app/(dashboard)/admin/clients/[id]/page.tsx`
- Modify: `src/app/(dashboard)/rep/clients/[id]/page.tsx`

- [ ] **Step 1: Add signals section to admin client detail**

In `src/app/(dashboard)/admin/clients/[id]/page.tsx`, add to imports and data fetching:

```typescript
import { fetchSignals } from '@/lib/queries/signals'
import { SignalCard } from '@/components/signals/signal-card'
```

Add to the `Promise.all` data fetch:

```typescript
const [{ data: client }, { data: allPackages }, { data: assigned }, { signals }] = await Promise.all([
  supabase.from('clients').select('*, profiles!assigned_rep_id(name, email)').eq('id', id).single(),
  supabase.from('service_packages').select('id, name').order('name'),
  supabase.from('client_services').select('package_id').eq('client_id', id),
  fetchSignals(supabase, user.id, true, { clientId: id }),
])
```

Replace the placeholder signals section:

```tsx
<div>
  <h2 className="text-lg font-semibold mb-3">
    Signals {signals.length > 0 && <span className="text-muted-foreground font-normal text-base">({signals.length})</span>}
  </h2>
  {signals.length === 0 ? (
    <p className="text-sm text-muted-foreground">No signals yet. Click "Scan now" above.</p>
  ) : (
    <div className="space-y-3">
      {signals.map((signal) => (
        <SignalCard key={signal.id} signal={signal} />
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 2: Same pattern for rep client detail**

Apply the same changes to `src/app/(dashboard)/rep/clients/[id]/page.tsx` with `isAdmin: false`.

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | head -60
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/admin/clients/[id]/ src/app/(dashboard)/rep/clients/[id]/
git commit -m "feat(signals): add signal list to client detail pages"
```
