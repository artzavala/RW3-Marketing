# Phase 3 — Google Sheets Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin configures a Google Sheets URL; system reads client rows and upserts them into the database on demand.

**Architecture:** `src/lib/sheets.ts` handles authentication and row reading. A Server Action calls it, upserts clients, and returns a result summary. The settings page (`/admin/settings`) renders the config form and sync button.

**Tech Stack:** Next.js 16, googleapis npm package, Supabase JS, Server Actions

**Prerequisite:** Phase 2 complete (clients table must exist).

---

## File Map

**New files:**
- `supabase/migrations/0004_create_sheets_config.sql` — sheets_config table + RLS
- `src/lib/sheets.ts` — Google Sheets auth + row reader
- `src/app/actions/sheets.ts` — saveConfig, syncSheet server actions
- `src/app/(dashboard)/admin/settings/page.tsx` — settings page (server component)
- `src/components/settings/sheets-config-form.tsx` — config form + sync button ('use client')

**No modifications to existing files.**

---

## Task 1: Install googleapis

**Files:** `package.json`

- [ ] **Step 1: Install the package**

```bash
npm install googleapis
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(deps): add googleapis for Google Sheets integration"
```

---

## Task 2: Migration — sheets_config table

**Files:**
- Create: `supabase/migrations/0004_create_sheets_config.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0004_create_sheets_config.sql
-- One config row (upserted on save). Admin read + write only.

CREATE TABLE public.sheets_config (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_url      TEXT        NOT NULL,
  tab_name       TEXT        NOT NULL DEFAULT 'Sheet1',
  last_synced_at TIMESTAMPTZ,
  created_by     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sheets_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sheets config"
  ON public.sheets_config
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

- [ ] **Step 2: Apply in Supabase dashboard**

SQL Editor → paste and run.

- [ ] **Step 3: Add env var**

Add to `.env.local` (get the JSON from Google Cloud Console → Service Accounts → Keys → Add Key → JSON):

```
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
```

The value is the entire JSON object as a single-line string.

- [ ] **Step 4: Commit migration**

```bash
git add supabase/migrations/0004_create_sheets_config.sql
git commit -m "feat(db): add sheets_config table with RLS"
```

---

## Task 3: Google Sheets library

**Files:**
- Create: `src/lib/sheets.ts`

- [ ] **Step 1: Write the library**

```typescript
// src/lib/sheets.ts
// Reads client rows from a Google Sheet using a service account.
//
// Expected sheet format:
//   Row 1: header (skipped)
//   Column A: client name (required)
//   Column B: website (optional)
//   Column C: rep email (optional)

import { google } from 'googleapis'

export type SheetRow = {
  name: string
  website: string
  repEmail: string
  rowIndex: number  // 1-based row number (used as sheets_row_id)
}

function getAuth() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!json) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set')

  const credentials = JSON.parse(json)
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

function extractSheetId(url: string): string {
  // Handles: https://docs.google.com/spreadsheets/d/SHEET_ID/edit#gid=0
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (!match) throw new Error('Invalid Google Sheets URL')
  return match[1]
}

export async function readSheet(sheetUrl: string, tabName: string): Promise<SheetRow[]> {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const spreadsheetId = extractSheetId(sheetUrl)

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A:C`,
  })

  const rows = response.data.values ?? []

  // Skip header row (index 0 = row 1 in the sheet)
  return rows.slice(1).map((row, i) => ({
    name: (row[0] as string | undefined)?.trim() ?? '',
    website: (row[1] as string | undefined)?.trim() ?? '',
    repEmail: (row[2] as string | undefined)?.trim() ?? '',
    rowIndex: i + 2,  // row 2 onward (1-based, header is row 1)
  })).filter((row) => row.name !== '')  // skip blank name rows
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | head -40
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/sheets.ts
git commit -m "feat(lib): add Google Sheets reader with service account auth"
```

---

## Task 4: Sheets server actions

**Files:**
- Create: `src/app/actions/sheets.ts`

- [ ] **Step 1: Write the actions**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readSheet } from '@/lib/sheets'
import { revalidatePath } from 'next/cache'

export type SheetsConfigState = { error?: string; success?: boolean }
export type SyncResult = {
  error?: string
  created?: number
  updated?: number
  errors?: string[]
}

export async function saveConfig(
  _prevState: SheetsConfigState,
  formData: FormData
): Promise<SheetsConfigState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const sheetUrl = (formData.get('sheet_url') as string)?.trim()
  const tabName = (formData.get('tab_name') as string)?.trim() || 'Sheet1'

  if (!sheetUrl) return { error: 'Sheet URL is required' }

  // Upsert — only one config row ever exists
  const { data: existing } = await supabase
    .from('sheets_config')
    .select('id')
    .limit(1)
    .single()

  if (existing) {
    const { error } = await supabase
      .from('sheets_config')
      .update({ sheet_url: sheetUrl, tab_name: tabName })
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('sheets_config')
      .insert({ sheet_url: sheetUrl, tab_name: tabName, created_by: user.id })
    if (error) return { error: error.message }
  }

  revalidatePath('/admin/settings')
  return { success: true }
}

export async function syncSheet(): Promise<SyncResult> {
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  // Load config
  const { data: config } = await supabase
    .from('sheets_config')
    .select('*')
    .limit(1)
    .single()

  if (!config) return { error: 'No sheet configured. Save a Sheet URL first.' }

  // Read rows from sheet
  let rows
  try {
    rows = await readSheet(config.sheet_url, config.tab_name)
  } catch (err) {
    return { error: `Could not read sheet: ${err instanceof Error ? err.message : String(err)}` }
  }

  // Build rep email → profile id map
  const repEmails = [...new Set(rows.map((r) => r.repEmail).filter(Boolean))]
  const { data: repProfiles } = await adminSupabase
    .from('profiles')
    .select('id, email')
    .in('email', repEmails)

  const repMap = new Map((repProfiles ?? []).map((p) => [p.email, p.id]))

  let created = 0
  let updated = 0
  const errors: string[] = []

  for (const row of rows) {
    const assignedRepId = row.repEmail ? (repMap.get(row.repEmail) ?? null) : null

    const { data: existing } = await adminSupabase
      .from('clients')
      .select('id')
      .eq('sheets_row_id', String(row.rowIndex))
      .single()

    if (existing) {
      const { error } = await adminSupabase
        .from('clients')
        .update({
          name: row.name,
          website: row.website || null,
          assigned_rep_id: assignedRepId,
        })
        .eq('id', existing.id)

      if (error) errors.push(`Row ${row.rowIndex}: ${error.message}`)
      else updated++
    } else {
      const { error } = await adminSupabase.from('clients').insert({
        name: row.name,
        website: row.website || null,
        assigned_rep_id: assignedRepId,
        sheets_row_id: String(row.rowIndex),
      })

      if (error) errors.push(`Row ${row.rowIndex}: ${error.message}`)
      else created++
    }
  }

  // Update last_synced_at
  await adminSupabase
    .from('sheets_config')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', config.id)

  revalidatePath('/admin/clients')
  revalidatePath('/admin/settings')

  return { created, updated, errors }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | head -40
```

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/sheets.ts
git commit -m "feat(actions): add saveConfig and syncSheet server actions"
```

---

## Task 5: Settings page

**Files:**
- Create: `src/app/(dashboard)/admin/settings/page.tsx`
- Create: `src/components/settings/sheets-config-form.tsx`

- [ ] **Step 1: Write sheets-config-form.tsx (client component)**

```typescript
'use client'

import { useActionState, useState } from 'react'
import { saveConfig, syncSheet, SyncResult } from '@/app/actions/sheets'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Config = { sheet_url: string; tab_name: string; last_synced_at: string | null } | null

export function SheetsConfigForm({ config }: { config: Config }) {
  const [configState, configAction, configPending] = useActionState(saveConfig, {})
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [syncing, setSyncing] = useState(false)

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    const result = await syncSheet()
    setSyncResult(result)
    setSyncing(false)
  }

  return (
    <div className="space-y-8 max-w-lg">
      <div>
        <h2 className="text-lg font-semibold mb-4">Google Sheets configuration</h2>
        <form action={configAction} className="space-y-4">
          {configState.error && <p className="text-sm text-destructive">{configState.error}</p>}
          {configState.success && <p className="text-sm text-green-600">Saved.</p>}
          <div className="space-y-1.5">
            <Label htmlFor="sheet_url">Sheet URL *</Label>
            <Input
              id="sheet_url"
              name="sheet_url"
              defaultValue={config?.sheet_url}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tab_name">Tab name</Label>
            <Input
              id="tab_name"
              name="tab_name"
              defaultValue={config?.tab_name ?? 'Sheet1'}
              placeholder="Sheet1"
            />
          </div>
          <Button type="submit" disabled={configPending}>
            {configPending ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </div>

      {config && (
        <div>
          <h2 className="text-lg font-semibold mb-2">Sync</h2>
          {config.last_synced_at && (
            <p className="text-sm text-muted-foreground mb-3">
              Last synced: {new Date(config.last_synced_at).toLocaleString()}
            </p>
          )}
          <Button onClick={handleSync} disabled={syncing} variant="outline">
            {syncing ? 'Syncing…' : 'Sync now'}
          </Button>
          {syncResult && (
            <div className="mt-3 text-sm">
              {syncResult.error && <p className="text-destructive">{syncResult.error}</p>}
              {syncResult.created !== undefined && (
                <p className="text-green-600">
                  {syncResult.created} created, {syncResult.updated} updated
                  {syncResult.errors && syncResult.errors.length > 0 && (
                    <span className="text-destructive ml-2">({syncResult.errors.length} errors)</span>
                  )}
                </p>
              )}
              {syncResult.errors?.map((e, i) => (
                <p key={i} className="text-destructive">{e}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write settings page**

```typescript
// src/app/(dashboard)/admin/settings/page.tsx
import { createClient } from '@/lib/supabase/server'
import { checkRole } from '@/lib/roles'
import { redirect } from 'next/navigation'
import { SheetsConfigForm } from '@/components/settings/sheets-config-form'

export default async function AdminSettingsPage() {
  const isAdmin = await checkRole('admin')
  if (!isAdmin) redirect('/rep')

  const supabase = await createClient()
  const { data: config } = await supabase
    .from('sheets_config')
    .select('sheet_url, tab_name, last_synced_at')
    .limit(1)
    .single()

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <SheetsConfigForm config={config} />
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

Navigate to `/admin/settings` — form renders. Save a Sheet URL — success message. Share the sheet with the service account email. Click "Sync now" — verify clients are created/updated in `/admin/clients`.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/admin/settings/ src/components/settings/
git commit -m "feat(sheets): Google Sheets import — settings page and sync action"
```
