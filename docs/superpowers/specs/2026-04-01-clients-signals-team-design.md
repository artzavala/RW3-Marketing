# Design Spec — Clients, Signals & Team
**Date:** 2026-04-01
**Status:** Approved
**Covers:** Phases 2–6 of Client Intelligence Platform v1

---

## Overview

Completes the core product after Phase 1 (foundation). Implements five sequential feature phases:

1. **Phase 2 — Client & Services Management** (CLI-01–05, SVC-01–05)
2. **Phase 3 — Google Sheets Import** (GS-01–04)
3. **Phase 4 — AI Scanning Engine** (SCN-01–05, with mock mode)
4. **Phase 5 — Signals Dashboard** (SIG-01–05)
5. **Phase 6 — Analytics** (ANL-01–02)
6. **Team Management** (admin-managed user roster + invite, added requirement)

Implementation strategy: **sequential phases** — each phase is fully deployable and testable before the next begins.

---

## Data Model

### New migrations (applied in order)

#### `0002_create_clients.sql`
```sql
clients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  website       TEXT,
  assigned_rep_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  active        BOOLEAN NOT NULL DEFAULT true,
  sheets_row_id TEXT,           -- for Google Sheets upsert deduplication
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```
RLS:
- Admin: full CRUD
- Rep: SELECT where `assigned_rep_id = auth.uid()`

#### `0003_create_services.sql`
```sql
service_packages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
)

client_services (
  client_id   UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  package_id  UUID REFERENCES public.service_packages(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (client_id, package_id)
)
```
RLS:
- `service_packages`: admin CRUD; rep SELECT
- `client_services`: admin CRUD; rep SELECT on assigned clients only

#### `0004_create_sheets_config.sql`
```sql
sheets_config (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_url      TEXT NOT NULL,
  tab_name       TEXT NOT NULL DEFAULT 'Sheet1',
  last_synced_at TIMESTAMPTZ,
  created_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```
RLS: admin only (SELECT + UPDATE)

#### `0005_create_scan_signals.sql`
```sql
scan_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by TEXT NOT NULL CHECK (triggered_by IN ('manual', 'cron')),
  status       TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'complete', 'failed')),
  client_count INT,
  error        TEXT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
)

signals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  headline     TEXT NOT NULL,
  source_url   TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  summary      TEXT,
  score        INT NOT NULL CHECK (score BETWEEN 1 AND 5),
  signal_type  TEXT NOT NULL,   -- e.g. 'news', 'funding', 'hiring', 'risk'
  opportunity  BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, source_url)  -- deduplication
)
```
RLS:
- `scan_runs`: admin + rep SELECT; no user writes (service role only)
- `signals`: admin SELECT all; rep SELECT on assigned clients only

#### `0006_create_signal_actions.sql`
```sql
signal_actions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id  UUID NOT NULL REFERENCES public.signals(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status     TEXT NOT NULL CHECK (status IN ('reviewed', 'actioned', 'dismissed')),
  note       TEXT,   -- nullable
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (signal_id, user_id)  -- one action per user per signal; use upsert on status change
)
```
RLS: users INSERT/SELECT their own rows (`user_id = auth.uid()`)

---

## Pages & Routing

All routes under `src/app/(dashboard)/` — inherit auth + sidebar layout.

### Admin routes
| Route | Purpose |
|-------|---------|
| `/admin/clients` | Table of all clients (name, website, rep, active status) + "Add Client" button |
| `/admin/clients/new` | Form: name, website, assign rep (dropdown), active toggle |
| `/admin/clients/[id]` | Detail: client info + edit, service assignment, scan trigger, signal list, score trend chart |
| `/admin/signals` | Global feed, newest first; filter bar |
| `/admin/services` | Table of service packages + "Add Package" button; inline edit/delete per row |
| `/admin/team` | Roster table + "Invite" button |
| `/admin/settings` | Google Sheets config + manual sync |

### Rep routes
| Route | Purpose |
|-------|---------|
| `/rep/clients` | Assigned client list |
| `/rep/clients/[id]` | Client detail (read-only, no edit/reassign) |
| `/rep/signals` | Signal feed scoped to assigned clients |

### Sidebar additions
**Admin:** Dashboard · Clients · Signals · Team · Settings
**Rep:** Dashboard · My Clients · Signals

---

## Feature Implementation

### Phase 2 — Client & Services Management

**Server Actions** (`src/app/actions/clients.ts`, `src/app/actions/services.ts`)
- `createClient(data)` — inserts client, sets `created_by = auth.uid()`
- `updateClient(id, data)` — updates name, website, assigned_rep_id, active
- `deleteClient(id)` — soft delete via `active = false`
- `createPackage(data)` — inserts service_package row (admin only, verified server-side)
- `updatePackage(id, data)` — updates name/description
- `deletePackage(id)` — hard delete (no clients should be using it; server action checks and blocks if any `client_services` rows exist)
- `assignPackage(clientId, packageId)` — upsert `client_services`
- `unassignPackage(clientId, packageId)` — delete from `client_services`

**UI patterns**
- List pages: server components, direct Supabase fetch, no client-side fetching
- `/admin/services`: table with inline edit (shadcn `Sheet` drawer) and delete (confirm dialog); "Add Package" opens same drawer
- Service assignment on client detail: checkbox list of all packages, checked = assigned
- Rep dropdown: fetches all profiles where `role = 'rep'`

### Team Management

**Routes:** `/admin/team`

**Actions** (`src/app/actions/team.ts`)
- `inviteUser(email, role)` — calls `supabase.auth.admin.inviteUserByEmail(email, { data: { role } })` via service role client; Supabase sends the invite email
- `changeRole(userId, role)` — updates `profiles.role` via service role client

**UI**
- Table: name, email, role badge, joined date
- "Invite" button opens a Sheet with email input + role selector (Admin / Rep)
- Role badge is clickable for admins — inline toggle between admin/rep

### Phase 3 — Google Sheets Import

**Library:** `src/lib/sheets.ts`
- Authenticates via service account (`GOOGLE_SERVICE_ACCOUNT_JSON` env var)
- Sheet must have a header row (row 1 is skipped). Expected columns: **A = name, B = website, C = rep email**. Missing B or C values are treated as empty string / unassigned — not errors.
- `readSheet(sheetUrl, tabName)` — returns array of `{ name, website, repEmail, rowIndex }` (rowIndex is 1-based, used as `sheets_row_id`)
- `syncSheet()` server action:
  1. Reads config from `sheets_config`
  2. Fetches rows from sheet
  3. Resolves `repEmail` → `profiles.id`
  4. Upserts clients by `sheets_row_id` (create or update name/website/rep)
  5. Updates `sheets_config.last_synced_at`
  6. Returns `{ created, updated, errors[] }`

**Settings page** (`/admin/settings`)
- Form: Sheet URL + tab name
- "Sync Now" button calls `syncSheet()`, shows result summary
- "Last synced" timestamp display

### Phase 4 — AI Scanning Engine

**Library:** `src/lib/scanner.ts`

```
scanClient(clientId) →
  1. search(clientName)       // Serper.dev or mock
  2. analyzeArticle(article)  // Gemini or mock
  3. upsert signals           // deduplicated by source_url
```

**Mock mode**
- `SERPER_API_KEY` absent → returns 3 fixture articles per client
- `GEMINI_API_KEY` absent → returns fixture analysis: `{ score: 3, signal_type: 'news', opportunity: false, summary: 'Mock signal for testing.' }`
- Mock mode is silent — scan completes successfully, inserts real rows into DB

**Cron endpoint** (`src/app/api/cron/scan/route.ts`)
- Verifies `CRON_SECRET` header
- Fetches all active clients
- Calls `scanClient()` for each
- Creates `scan_runs` record (status: running → complete/failed)

**Manual trigger**
- Server Action `triggerScan(clientId)` on client detail page
- Before scanning, verifies the calling user has access to `clientId`: admin always passes; rep must have `assigned_rep_id = auth.uid()` on that client (checked via anon client query — RLS enforces this automatically)
- Creates a `scan_runs` record with `triggered_by = 'manual'`
- Returns scan result summary

**`vercel.json`**
```json
{
  "crons": [{ "path": "/api/cron/scan", "schedule": "0 6 * * *" }]
}
```

**Dev seed script** (`scripts/seed-signals.ts`)
- Inserts fixture signals for all clients directly — bypasses scan entirely
- Use to test signals UI without running a scan

### Phase 5 — Signals Dashboard

**Feed architecture**
- Server components with URL-based filter state: `?client=&score=&type=&status=`
- Filter bar is a client component that updates URL params (no form submit)
- Signal list re-renders on navigation (server-side filtered query)

**Signal card** (client component)
- Headline (linked to source), source domain, published date
- Score badge: 1–2 red, 3 yellow, 4–5 green
- Signal type tag, opportunity flag icon
- Latest action status badge (if any action exists)
- Action buttons: Reviewed / Actioned / Dismissed
- Note input appears inline when Actioned or Dismissed is selected
- Optimistic UI: status badge updates immediately, Server Action persists async

**Signal actions** (`src/app/actions/signals.ts`)
- `createAction(signalId, status, note?)` — upserts `signal_actions` row on `(signal_id, user_id)` conflict; updates status + note

---

### Phase 6 — Analytics

**Client detail page — score trend chart** (ANL-01)
- Recharts `LineChart` (via shadcn/ui) on client detail page
- Query: average `signals.score` grouped by day for the last 90 days for that client
- X-axis: date; Y-axis: score 1–5
- Rendered as a server component; chart data passed as props to a `'use client'` chart wrapper

**Dashboard — signal volume by week** (ANL-02)
- Recharts `BarChart` on both `/admin` and `/rep` dashboards
- Admin: signal count across all clients grouped by ISO week (last 12 weeks)
- Rep: same but scoped to assigned clients
- Replaces the current empty-state "Signals" card on the dashboard pages

---

## Cross-Cutting Concerns

### Loading states
- Every list/detail page has a `loading.tsx` with table row skeletons
- Scan trigger button shows spinner while Server Action is pending

### Empty states
- Clients list: "No clients yet — Add your first client" + CTA
- Signals feed: "No signals yet — run a scan on a client"
- Team page: "No team members — Invite someone"

### Error handling
- All Server Actions return `{ error: string } | { data: ... }` — never throw to client
- Form validation errors displayed inline below fields
- Scan failures: `scan_runs.status = 'failed'`, error stored in `scan_runs.error`, shown on client detail

### RLS verification
- Each migration file includes a comment block listing every policy applied
- Service role client (`lib/supabase/admin.ts`) used only for: team invite, role changes, cron scan writes
- All user-facing reads/writes use anon client with RLS enforced

### Cron timeout constraint
The cron scan loops all active clients sequentially. On Vercel Hobby (10s limit) this is unsuitable for more than ~3 clients. On Pro (60s default, up to 800s with Fluid Compute) it handles typical loads. For v1, document this limit; parallel scanning is a v2 concern.

### Environment variables
| Variable | Purpose | Required for |
|----------|---------|--------------|
| `SERPER_API_KEY` | News search | Live scanning (optional — mock mode if absent) |
| `GEMINI_API_KEY` | Signal analysis | Live scanning (optional — mock mode if absent) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Sheets API auth | Google Sheets import |
| `CRON_SECRET` | Cron endpoint auth | Production cron |

---

## Requirement Coverage

| Req ID | Phase | Status |
|--------|-------|--------|
| CLI-01–05 | Phase 2 | Covered |
| SVC-01–05 | Phase 2 | Covered |
| GS-01–04 | Phase 3 | Covered |
| SCN-01–05 | Phase 4 | Covered (mock mode for local dev) |
| SIG-01–05 | Phase 5 | Covered |
| ANL-01–02 | Phase 6 | Covered |
| Team management | Added | Covered (admin user roster + invite) |
