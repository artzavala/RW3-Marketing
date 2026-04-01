# Phase 3: Google Sheets Import - Research

**Researched:** 2026-04-01
**Domain:** Google Sheets API v4, service account auth, Supabase upsert, Next.js server actions
**Confidence:** HIGH (core stack), MEDIUM (sheets_row_id strategy)

---

## Summary

Phase 3 integrates Google Sheets as a client data source. The standard approach uses the
`googleapis` npm package with a service account for server-side authentication. Credentials
are stored as a base64-encoded JSON string in a single Vercel environment variable, decoded
at runtime. The Sheets API v4 `spreadsheets.values.get` endpoint returns a 2D array that maps
cleanly to client rows.

The most important design decision is `sheets_row_id` — the mechanism for identifying which
sheet row corresponds to which database client record. The right strategy is a **dedicated
column in the sheet** (e.g., column A named "ID") containing a stable identifier like the
client domain or a UUID written by the admin. Row index is not safe because rows can be
reordered or inserted. The synced value becomes a UNIQUE-constrained column on the `clients`
table used as the upsert conflict target.

For rep email resolution, the codebase already has a `profiles` table with an `email` column
that mirrors `auth.users`. Query `profiles` via the existing `createAdminClient()` helper —
no need for `auth.admin.getUserByEmail` or direct `auth.users` access.

**Primary recommendation:** Install only `googleapis`. Store service account JSON as
`GOOGLE_SHEETS_CREDENTIALS_BASE64`. Use row-zero header detection and a dedicated "ID" column
as `sheets_row_id`. Query `profiles.email` for rep resolution. Use Supabase `.upsert()` with
`onConflict: 'sheets_row_id'` for bulk import.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `googleapis` | latest (v148+) | Google Sheets API v4 client + GoogleAuth | Official Google-maintained client; includes auth library as dependency |

### Supporting (already in project)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/supabase-js` | (already installed) | Upsert clients, query profiles | Reuse existing `createAdminClient()` |

### What NOT to install

| Package | Why to Skip |
|---------|-------------|
| `google-auth-library` | Already bundled inside `googleapis`; installing separately is redundant |
| `google-spreadsheet` | Higher-level wrapper; adds abstraction overhead without benefit for this narrow use case |
| `@google-cloud/local-auth` | OAuth2 desktop flow; wrong auth type for server-to-server service accounts |

**Installation:**
```bash
npm install googleapis
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   └── google-sheets.ts        # GoogleAuth + sheets client factory
├── app/(dashboard)/
│   └── admin/
│       └── sheets/
│           ├── page.tsx         # Settings UI: Sheet URL + tab name form
│           ├── actions.ts       # saveConfigAction, triggerSyncAction
│           └── sync-status.tsx  # Last synced, rows imported display
supabase/
└── migrations/
    └── 0003_create_sheets_config.sql
```

### Pattern 1: Service Account Auth with Parsed Credentials

**What:** Decode base64 JSON credentials at runtime; pass as `credentials` object to GoogleAuth.
**When to use:** Any server action or route handler that calls Sheets API.

```typescript
// src/lib/google-sheets.ts
// Source: https://www.paulie.dev/posts/2024/06/how-to-use-google-application-json-credentials-in-environment-variables/
import { google } from 'googleapis'

export function getSheetsClient() {
  const raw = process.env.GOOGLE_SHEETS_CREDENTIALS_BASE64
  if (!raw) throw new Error('GOOGLE_SHEETS_CREDENTIALS_BASE64 is not set')

  const credentials = JSON.parse(
    Buffer.from(raw, 'base64').toString('utf-8')
  )

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })

  return google.sheets({ version: 'v4', auth })
}
```

### Pattern 2: Extract spreadsheetId from URL

**What:** Parse the spreadsheet ID from a user-supplied Google Sheets URL.
**When to use:** When admin saves a Sheet URL in settings.

```typescript
// Source: Google Sheets URL format (verified from official URL structure)
// URL format: https://docs.google.com/spreadsheets/d/{spreadsheetId}/edit#gid=0
export function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return match ? match[1] : null
}
```

### Pattern 3: Read a Sheet Range

**What:** Fetch all rows from a named tab.
**When to use:** In the sync server action.

```typescript
// Source: https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get
// GET https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/{range}
// Response: { range, majorDimension, values: string[][] }
export async function readSheetRows(
  spreadsheetId: string,
  tabName: string
): Promise<string[][]> {
  const sheets = getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A:Z`,   // read all columns
    majorDimension: 'ROWS',
    valueRenderOption: 'FORMATTED_VALUE',
  })
  return res.data.values ?? []
}
```

**Response shape:**
```json
{
  "range": "Sheet1!A1:Z1000",
  "majorDimension": "ROWS",
  "values": [
    ["ID", "Name", "Website", "Rep Email"],
    ["acme-corp", "Acme Corp", "acme.com", "rep@example.com"],
    ["globex", "Globex", "globex.com", "other@example.com"]
  ]
}
```

Row 0 is the header row. Rows 1..N are data. Trailing empty cells are omitted from each row
array — code must handle rows shorter than the header.

### Pattern 4: Upsert with Supabase

**What:** Bulk insert-or-update clients using `sheets_row_id` as the conflict column.
**When to use:** After mapping sheet rows to client objects.

```typescript
// Source: https://supabase.com/docs/reference/javascript/upsert
const adminClient = createAdminClient()

const { error } = await adminClient
  .from('clients')
  .upsert(
    rows.map(r => ({
      sheets_row_id: r.id,        // the stable ID from the sheet's column A
      name: r.name,
      website: r.website || null,
      assigned_rep: r.repId || null,
    })),
    { onConflict: 'sheets_row_id' }
  )
```

The `onConflict` column must have a UNIQUE constraint in the DB for upsert to work.

### Pattern 5: Rep Email Resolution via profiles table

**What:** Convert rep email strings from the sheet to `profiles.id` UUIDs.
**When to use:** During sync row mapping, before upsert.

```typescript
// This project already has profiles.email — use it directly
// Source: /supabase/migrations/0001_create_profiles.sql — profiles has email column
const adminClient = createAdminClient()

async function resolveRepEmail(email: string): Promise<string | null> {
  if (!email?.trim()) return null
  const { data } = await adminClient
    .from('profiles')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .single()
  return data?.id ?? null
}
```

This is simpler and faster than `auth.admin.getUserByEmail` and works with existing RLS
bypass (admin client uses service role key).

### Anti-Patterns to Avoid

- **Using row index as sheets_row_id:** Row numbers shift when rows are inserted or deleted.
  A row that was client #5 becomes client #6 after an insert above it — this creates duplicate
  records on next sync.
- **Storing credentials as raw JSON in env var:** Node.js env vars are strings; JSON with
  newlines in `private_key` will corrupt on many platforms. Use base64 encoding.
- **Using keyFile path in production:** File system is ephemeral on Vercel/serverless. Always
  use `credentials` object, never `keyFile`.
- **Reading one row at a time:** Call `spreadsheets.values.get` once for the full range, not
  per-row. Each call counts against the 300 req/min quota.
- **Not sharing the sheet with the service account:** The sheet must be shared with the service
  account's `client_email`. This is a GCP console step, not a code step — easy to forget.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Service account auth | Custom JWT signing | `new google.auth.GoogleAuth({ credentials, scopes })` | Token refresh, expiry, retry all handled |
| Spreadsheet URL parsing | Regex from scratch | The regex `\/spreadsheets\/d\/([a-zA-Z0-9-_]+)` is simple enough to inline | Low risk |
| Upsert logic | Manual SELECT then INSERT/UPDATE | `.upsert(rows, { onConflict })` | Single round-trip, atomic |
| Rep email lookup | Scanning all users | Query `profiles.email` (indexed) | O(1) per email, uses existing table |
| Rate limit retry | Custom sleep/retry loop | For admin sync, a single read request is well under quota — no retry needed unless syncing >300 sheets/min | Overkill for this use case |

**Key insight:** The googleapis library handles all OAuth2 token lifecycle automatically.
Never manage tokens manually.

---

## Common Pitfalls

### Pitfall 1: private_key newline corruption
**What goes wrong:** When a raw service account JSON is pasted into an env var, the
`private_key` field contains literal `\n` strings instead of actual newline characters.
GoogleAuth fails with a key parse error.
**Why it happens:** Shell and .env parsers handle escaped characters differently.
**How to avoid:** Use base64 encoding. `Buffer.from(raw, 'base64').toString('utf-8')` produces
the correct JSON with real newlines.
**Warning signs:** `Error: error:0909006C:PEM routines:get_name:no start line`

### Pitfall 2: Sheet not shared with service account
**What goes wrong:** API returns 403 Forbidden despite valid credentials.
**Why it happens:** Service accounts are separate Google identities. A sheet must be explicitly
shared with the service account's `client_email` (e.g., `sync@project.iam.gserviceaccount.com`).
**How to avoid:** Document the setup step. Surface the `client_email` in the admin UI after
config is saved so the admin knows what email to share the sheet with.
**Warning signs:** `GoogleJsonResponseException: 403 Forbidden`

### Pitfall 3: Header row included in upsert data
**What goes wrong:** Row 0 (headers like "ID", "Name") gets inserted as a client record.
**Why it happens:** `res.data.values` includes the header row.
**How to avoid:** Always slice from index 1: `const dataRows = values.slice(1)`.

### Pitfall 4: Ragged rows (missing trailing cells)
**What goes wrong:** A row with no website has only 3 elements instead of 4. Accessing `row[3]`
returns `undefined`, which causes type errors or inserts `undefined` as a string.
**Why it happens:** Sheets API omits trailing empty cells from each row array.
**How to avoid:** Use `row[i] ?? null` or `row[i] ?? ''` when mapping columns.

### Pitfall 5: sheets_row_id missing UNIQUE constraint
**What goes wrong:** `.upsert({ onConflict: 'sheets_row_id' })` silently fails or inserts
duplicates instead of updating.
**Why it happens:** Supabase upsert's `onConflict` requires a UNIQUE or PRIMARY KEY constraint
on the named column.
**How to avoid:** Add `UNIQUE` to `sheets_row_id` in the migration.

### Pitfall 6: clients column is assigned_rep not assigned_rep_id
**What goes wrong:** Code uses `assigned_rep_id` — column doesn't exist, insert silently
ignores it or throws.
**Why it happens:** The migration (`0002_create_clients_services.sql`) names it `assigned_rep`.
**How to avoid:** Always use `assigned_rep` in all client table operations.

---

## Code Examples

### Full sync flow skeleton

```typescript
// src/app/(dashboard)/admin/sheets/actions.ts
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getSheetsClient, readSheetRows, extractSpreadsheetId } from '@/lib/google-sheets'
import { revalidatePath } from 'next/cache'
import { checkRole } from '@/lib/roles'

type SyncResult = { rowsImported: number; error?: string }

export async function triggerSyncAction(
  _prevState: SyncResult | null,
  _formData: FormData
): Promise<SyncResult> {
  const isAdmin = await checkRole('admin')
  if (!isAdmin) return { rowsImported: 0, error: 'Unauthorized' }

  const adminClient = createAdminClient()

  // 1. Load config
  const { data: config } = await adminClient
    .from('sheets_config')
    .select('spreadsheet_url, tab_name')
    .single()
  if (!config) return { rowsImported: 0, error: 'No sheet configured' }

  const spreadsheetId = extractSpreadsheetId(config.spreadsheet_url)
  if (!spreadsheetId) return { rowsImported: 0, error: 'Invalid sheet URL' }

  // 2. Fetch rows
  const values = await readSheetRows(spreadsheetId, config.tab_name)
  const dataRows = values.slice(1)   // skip header

  // 3. Map header to column indices
  const headers = values[0].map(h => h.toLowerCase().trim())
  const col = (name: string) => headers.indexOf(name)
  const idCol = col('id')
  const nameCol = col('name')
  const websiteCol = col('website')
  const repEmailCol = col('rep email')

  // 4. Resolve rep emails in batch (deduplicated)
  const emails = [...new Set(dataRows.map(r => r[repEmailCol]).filter(Boolean))]
  const emailToId: Record<string, string> = {}
  if (emails.length > 0) {
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('id, email')
      .in('email', emails)
    profiles?.forEach(p => { emailToId[p.email] = p.id })
  }

  // 5. Build upsert payload
  const rows = dataRows
    .filter(r => r[idCol]?.trim())   // skip rows with no ID
    .map(r => ({
      sheets_row_id: r[idCol].trim(),
      name: r[nameCol] ?? '',
      website: r[websiteCol]?.trim() || null,
      assigned_rep: emailToId[r[repEmailCol]?.trim()] ?? null,
    }))

  // 6. Upsert
  const { error } = await adminClient
    .from('clients')
    .upsert(rows, { onConflict: 'sheets_row_id' })

  // 7. Update sync status
  await adminClient
    .from('sheets_config')
    .update({
      last_synced_at: new Date().toISOString(),
      rows_imported: rows.length,
      last_error: error?.message ?? null,
    })
    .eq('id', 1)  // single-row config table

  revalidatePath('/admin/sheets')
  revalidatePath('/admin/clients')
  return error
    ? { rowsImported: 0, error: error.message }
    : { rowsImported: rows.length }
}
```

### sheets_config migration

```sql
-- supabase/migrations/0003_create_sheets_config.sql

-- Add sheets_row_id to clients for stable upsert identity
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS sheets_row_id TEXT UNIQUE;

-- Single-row config table for sheet settings
CREATE TABLE sheets_config (
  id               INTEGER PRIMARY KEY DEFAULT 1,
  spreadsheet_url  TEXT,
  tab_name         TEXT NOT NULL DEFAULT 'Sheet1',
  last_synced_at   TIMESTAMPTZ,
  rows_imported    INTEGER,
  last_error       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Enforce single row: seed it
INSERT INTO sheets_config (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

-- Auto-update updated_at
CREATE TRIGGER handle_sheets_config_updated_at
  BEFORE UPDATE ON sheets_config
  FOR EACH ROW EXECUTE PROCEDURE extensions.moddatetime(updated_at);

-- RLS: only admins
ALTER TABLE sheets_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_sheets_config" ON sheets_config
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
```

---

## sheets_row_id Strategy

**Decision: Dedicated column in the sheet named "ID"**

Options evaluated:

| Option | Verdict | Reason |
|--------|---------|--------|
| Row index (1-based) | REJECT | Shifts on insert/delete; creates phantom duplicates |
| Spreadsheet internal row ID | REJECT | Not exposed via Sheets API v4 |
| Dedicated "ID" column in sheet | USE THIS | Stable, human-readable, admin controls values |
| A natural key (e.g., website domain) | ACCEPTABLE | Works if domain is guaranteed unique; more fragile |

**Recommended sheet layout (document for admin):**

| A (ID) | B (Name) | C (Website) | D (Rep Email) |
|--------|----------|-------------|---------------|
| acme-corp | Acme Corp | acme.com | rep@example.com |

The ID should be a slug or any stable string. Admin enters it once; it never changes.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| OAuth2 browser consent flow | Service account with JSON credentials | Server-to-server; no user interaction needed |
| `keyFile` path on disk | `credentials` object in memory | Required for Vercel/serverless deployments |
| `google-auth-library` standalone | `googleapis` (includes auth) | One package, fully maintained |

**Deprecated/outdated:**
- `@google-cloud/local-auth`: OAuth2 desktop flow only; never use for server-side sync
- `now secret` Vercel CLI: Replaced by Vercel dashboard Environment Variables UI

---

## Open Questions

1. **Column header names in the sheet**
   - What we know: The sync code needs to locate columns by header name
   - What's unclear: Are header names fixed (admin must use exact names) or configurable?
   - Recommendation: Define canonical names ("ID", "Name", "Website", "Rep Email") and
     document them. Configurable column mapping is a Deferred Idea.

2. **auth.admin.getUserByEmail existence**
   - What we know: Multiple community sources confirm it exists; official Supabase docs page
     404'd during research; the `profiles.email` approach is available and preferred
   - What's unclear: Exact method signature in current supabase-js version
   - Recommendation: Use `profiles` table query — it's already confirmed from the migration
     file and avoids any ambiguity about admin API availability.

3. **Error handling during partial sync failure**
   - What we know: If one row fails to upsert (e.g., malformed data), the whole batch may roll back
   - What's unclear: Does Supabase upsert fail atomically or row-by-row?
   - Recommendation: Wrap the upsert in a try/catch; store the error message in
     `sheets_config.last_error`; display it in the UI.

---

## Sources

### Primary (HIGH confidence)
- Google Sheets API v4 reference: https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get
- Google Sheets API quotas: https://developers.google.com/workspace/sheets/api/limits
- Supabase upsert docs: https://supabase.com/docs/reference/javascript/upsert
- Project migrations: `/supabase/migrations/0001_create_profiles.sql`, `0002_create_clients_services.sql`
- Project admin client: `/src/lib/supabase/admin.ts`

### Secondary (MEDIUM confidence)
- Credentials-as-env-var pattern: https://www.paulie.dev/posts/2024/06/how-to-use-google-application-json-credentials-in-environment-variables/
- Vercel JSON credentials discussion: https://github.com/vercel/community/discussions/219
- Supabase email lookup discussion: https://github.com/orgs/supabase/discussions/40431

### Tertiary (LOW confidence)
- `auth.admin.getUserByEmail` existence: multiple community sources agree but official docs 404'd

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `googleapis` is the official Google-maintained client, confirmed from npm and official quickstart
- Credential storage: HIGH — base64 pattern confirmed from multiple sources including Vercel community
- API endpoint + response shape: HIGH — confirmed from official REST reference
- Upsert pattern: HIGH — confirmed from official Supabase docs
- sheets_row_id strategy: MEDIUM — logical conclusion from API constraints; no official "sheets sync" pattern document
- Rep email resolution via profiles: HIGH — confirmed from actual migration files in this codebase

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (googleapis and Supabase JS are stable; re-verify if major version bumps)
