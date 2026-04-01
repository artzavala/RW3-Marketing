# Phase 6 — Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Client detail page shows a score trend chart (last 90 days); admin and rep dashboards show a signal volume bar chart (last 12 weeks).

**Architecture:** Chart data is queried server-side and passed as props to `'use client'` Recharts wrapper components. shadcn/ui's `chart` component provides the Recharts integration and theming.

**Tech Stack:** Next.js 16, Recharts (via `npx shadcn@latest add chart`), Supabase JS

**Prerequisite:** Phase 5 complete (signals and signal_actions tables must have data).

---

## File Map

**New files:**
- `src/components/charts/score-trend-chart.tsx` — line chart for client score trend ('use client')
- `src/components/charts/volume-chart.tsx` — bar chart for weekly signal volume ('use client')

**Modified files:**
- `src/app/(dashboard)/admin/clients/[id]/page.tsx` — add score trend chart
- `src/app/(dashboard)/rep/clients/[id]/page.tsx` — add score trend chart
- `src/app/(dashboard)/admin/page.tsx` — replace Signals card with volume chart
- `src/app/(dashboard)/rep/page.tsx` — replace Signals card with volume chart

---

## Task 1: Install shadcn chart component

**Files:** `src/components/ui/chart.tsx`

- [ ] **Step 1: Install**

```bash
npx shadcn@latest add chart
```

This installs Recharts and adds `src/components/ui/chart.tsx`.

- [ ] **Step 2: Verify**

```bash
npm run build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/chart.tsx package.json package-lock.json
git commit -m "feat(ui): install shadcn chart (Recharts)"
```

---

## Task 2: Score trend chart component

**Files:**
- Create: `src/components/charts/score-trend-chart.tsx`

- [ ] **Step 1: Write the component**

This component receives pre-computed data from the server — it only handles rendering.

```typescript
'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

export type TrendPoint = {
  date: string   // 'YYYY-MM-DD'
  avgScore: number
}

export function ScoreTrendChart({ data }: { data: TrendPoint[] }) {
  if (!data.length) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border">
        <p className="text-sm text-muted-foreground">No signal data yet.</p>
      </div>
    )
  }

  const formatted = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: Number(d.avgScore.toFixed(1)),
  }))

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(value: number) => [`${value}`, 'Avg score']}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
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
git add src/components/charts/score-trend-chart.tsx
git commit -m "feat(charts): add score trend line chart component"
```

---

## Task 3: Volume bar chart component

**Files:**
- Create: `src/components/charts/volume-chart.tsx`

- [ ] **Step 1: Write the component**

```typescript
'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

export type VolumePoint = {
  week: string   // 'MMM D' formatted label
  count: number
}

export function VolumeChart({ data }: { data: VolumePoint[] }) {
  if (!data.length) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border">
        <p className="text-sm text-muted-foreground">No signal data yet.</p>
      </div>
    )
  }

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(value: number) => [`${value}`, 'Signals']}
          />
          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
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
git add src/components/charts/volume-chart.tsx
git commit -m "feat(charts): add weekly signal volume bar chart component"
```

---

## Task 4: Add trend chart to client detail pages

**Files:**
- Modify: `src/app/(dashboard)/admin/clients/[id]/page.tsx`
- Modify: `src/app/(dashboard)/rep/clients/[id]/page.tsx`

- [ ] **Step 1: Write the query helper**

Add to `src/lib/queries/signals.ts`:

```typescript
export async function fetchScoreTrend(
  supabase: SupabaseClient,
  clientId: string
): Promise<{ date: string; avgScore: number }[]> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const { data } = await supabase
    .from('signals')
    .select('score, created_at')
    .eq('client_id', clientId)
    .gte('created_at', ninetyDaysAgo)
    .order('created_at', { ascending: true })

  if (!data?.length) return []

  // Group by date, average scores
  const byDate = new Map<string, number[]>()
  for (const row of data) {
    const date = row.created_at.split('T')[0]
    if (!byDate.has(date)) byDate.set(date, [])
    byDate.get(date)!.push(row.score)
  }

  return Array.from(byDate.entries()).map(([date, scores]) => ({
    date,
    avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
  }))
}
```

- [ ] **Step 2: Add chart to admin client detail page**

In `src/app/(dashboard)/admin/clients/[id]/page.tsx`:

Add import:
```typescript
import { fetchScoreTrend } from '@/lib/queries/signals'
import { ScoreTrendChart } from '@/components/charts/score-trend-chart'
```

Add to `Promise.all`:
```typescript
fetchScoreTrend(supabase, id),
```

Add new section to JSX (before Signals section):

```tsx
<div>
  <h2 className="text-lg font-semibold mb-3">Score trend — last 90 days</h2>
  <ScoreTrendChart data={trendData} />
</div>
```

- [ ] **Step 3: Apply same pattern to rep client detail**

Same imports, same `fetchScoreTrend` call, same `<ScoreTrendChart>` section.

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | head -60
```

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/admin/clients/[id]/ src/app/(dashboard)/rep/clients/[id]/ src/lib/queries/signals.ts
git commit -m "feat(analytics): add score trend chart to client detail pages"
```

---

## Task 5: Add volume chart to dashboard pages

**Files:**
- Modify: `src/app/(dashboard)/admin/page.tsx`
- Modify: `src/app/(dashboard)/rep/page.tsx`

- [ ] **Step 1: Write the volume query helper**

Add to `src/lib/queries/signals.ts`:

```typescript
export async function fetchWeeklyVolume(
  supabase: SupabaseClient,
  userId: string,
  isAdmin: boolean
): Promise<{ week: string; count: number }[]> {
  const twelveWeeksAgo = new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000).toISOString()

  let query = supabase
    .from('signals')
    .select('created_at, clients!inner(assigned_rep_id)')
    .gte('created_at', twelveWeeksAgo)

  if (!isAdmin) {
    query = query.eq('clients.assigned_rep_id', userId)
  }

  const { data } = await query

  if (!data?.length) return []

  // Group by ISO week start (Monday)
  const byWeek = new Map<string, number>()

  for (const row of data) {
    const d = new Date(row.created_at)
    // Get Monday of the week
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(d.setDate(diff))
    const weekKey = monday.toISOString().split('T')[0]
    byWeek.set(weekKey, (byWeek.get(weekKey) ?? 0) + 1)
  }

  // Fill in all 12 weeks (including zeros)
  const weeks = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) - i * 7
    const monday = new Date(d.setDate(diff))
    const weekKey = monday.toISOString().split('T')[0]
    const label = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    weeks.push({ week: label, count: byWeek.get(weekKey) ?? 0 })
  }

  return weeks
}
```

- [ ] **Step 2: Update admin dashboard page**

In `src/app/(dashboard)/admin/page.tsx`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { checkRole } from '@/lib/roles'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { fetchWeeklyVolume } from '@/lib/queries/signals'
import { VolumeChart } from '@/components/charts/volume-chart'

export default async function AdminDashboard() {
  const isAdmin = await checkRole('admin')
  if (!isAdmin) redirect('/rep')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const volumeData = await fetchWeeklyVolume(supabase, user.id, true)

  return (
    <div>
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <p className="mt-2 text-muted-foreground">Manage clients, view signals, and monitor trends.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-6">
          <h3 className="font-semibold">Clients</h3>
          <p className="mt-1 text-sm text-muted-foreground">Manage client accounts and service assignments.</p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/admin/clients">View clients</Link>
          </Button>
        </div>
        <div className="rounded-lg border p-6">
          <h3 className="font-semibold">Team</h3>
          <p className="mt-1 text-sm text-muted-foreground">Manage team members and roles.</p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/admin/team">View team</Link>
          </Button>
        </div>
        <div className="rounded-lg border p-6">
          <h3 className="font-semibold mb-3">Signal volume — last 12 weeks</h3>
          <VolumeChart data={volumeData} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update rep dashboard page**

Same pattern with `isAdmin: false`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { fetchWeeklyVolume } from '@/lib/queries/signals'
import { VolumeChart } from '@/components/charts/volume-chart'

export default async function RepDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const volumeData = await fetchWeeklyVolume(supabase, user.id, false)

  return (
    <div>
      <h1 className="text-2xl font-bold">My Dashboard</h1>
      <p className="mt-2 text-muted-foreground">View your assigned clients and recent signals.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-6">
          <h3 className="font-semibold">My Clients</h3>
          <p className="mt-1 text-sm text-muted-foreground">View your assigned clients.</p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/rep/clients">View clients</Link>
          </Button>
        </div>
        <div className="rounded-lg border p-6">
          <h3 className="font-semibold mb-3">Signal volume — last 12 weeks</h3>
          <VolumeChart data={volumeData} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Final build check**

```bash
npm run build
```

Expected: clean build, no TypeScript errors

- [ ] **Step 5: Manual check**

```bash
npm run dev
```

1. Seed signals: `npx tsx scripts/seed-signals.ts`
2. Admin dashboard — volume bar chart renders
3. Rep dashboard — volume bar chart renders (scoped to assigned clients)
4. Client detail — score trend line chart renders

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/admin/page.tsx src/app/(dashboard)/rep/page.tsx src/lib/queries/
git commit -m "feat(analytics): add weekly signal volume chart to dashboards"
```
