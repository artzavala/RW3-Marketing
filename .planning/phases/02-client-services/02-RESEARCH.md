# Phase 2: Client & Services Management - Research

**Researched:** 2026-04-01
**Domain:** Supabase RLS + Next.js 16 Server Actions + shadcn/ui data tables
**Confidence:** HIGH

---

## Summary

This phase introduces three new tables (`clients`, `service_packages`, `client_services`) with Supabase RLS enforcing role-scoped access, and builds client list + detail pages with admin CRUD and rep read-only views.

The codebase from Phase 1 is in good shape. The Supabase client split (server/client/admin), the `checkRole()` helper reading from `profiles.role`, and the `proxy.ts` admin-route guard are all established and can be used directly. No new auth primitives are needed. The main new work is schema + RLS migration, Server Actions for mutations, and several shadcn/ui components that are not yet installed.

The key architectural decision for this phase is mutation strategy. The project uses Next.js 16 App Router with React 19. Server Actions are the right choice: they avoid building API routes, integrate with `useActionState` for form state, and revalidate on completion using `revalidatePath`. The sign-in page established the pattern of using the browser Supabase client in Client Components for interactivity — for mutations (write operations), Server Actions with the server client are cleaner and allow RLS to run under the authenticated session.

**Primary recommendation:** Use Server Actions with the server Supabase client for all writes. Use Server Components with direct Supabase queries for all reads. Enforce admin checks inside every Server Action with `checkRole()` before touching the DB.

---

## Codebase Findings

These are confirmed facts about the existing Phase 1 code — not assumptions.

### Supabase client split (HIGH confidence)
Three clients exist:
- `src/lib/supabase/server.ts` — `createClient()` async, uses `@supabase/ssr` with cookie store. Use this in Server Components, Server Actions, and Route Handlers.
- `src/lib/supabase/client.ts` — `createClient()` sync, browser client. Use in Client Components only.
- `src/lib/supabase/admin.ts` — `createAdminClient()` with service role key. Use only for operations that must bypass RLS (e.g., listing all users/profiles for the rep dropdown).

### Role utility (HIGH confidence)
`src/lib/roles.ts` exports:
- `getRole(): Promise<Role | null>` — queries `profiles.role` for the current user
- `checkRole(role: Role): Promise<boolean>` — returns boolean
- `type Role = 'admin' | 'rep'`

Both functions use the server Supabase client. Call `checkRole('admin')` at the top of every Server Action that performs writes.

### Proxy route guard (HIGH confidence)
`src/proxy.ts` already redirects non-admins away from `/admin/*` routes. This means:
- Pages under `(dashboard)/admin/` are already protected at the routing layer
- Still need role checks in Server Actions (defense in depth — proxy is not a security boundary)
- Rep-scoped routes under `(dashboard)/rep/` have no DB-level guard in proxy; rely on RLS + query scoping

### profiles table (HIGH confidence)
`profiles` has `id UUID` (FK to `auth.users.id`), `email TEXT`, `name TEXT`, `role TEXT` (`'admin'|'rep'`). Role stored as TEXT with CHECK constraint (not enum) to avoid Supabase auth admin type resolution issues. The rep dropdown query should pull from `profiles` where `role = 'rep'`.

### shadcn style (HIGH confidence)
`components.json` shows `"style": "base-nova"` (not "new-york"). This is a shadcn v4 style variant. All `shadcn add` commands must use this project's registry — components will render consistently.

### Existing shadcn components (HIGH confidence)
Already installed: `button`, `input`, `sidebar`, `separator`, `avatar`, `dropdown-menu`, `sheet`, `skeleton`, `tooltip`.

Not yet installed (needed for this phase): `table`, `dialog`, `select`, `form`, `label`, `badge`, `toast` (or `sonner`).

### Form pattern in use (HIGH confidence)
Sign-in page uses a controlled Client Component form (`useState` + `useRouter` + browser Supabase client). For Phase 2, Server Actions are more appropriate for admin mutations since they: run on the server (so the service role client or server client can be used securely), support `revalidatePath`, and reduce round-trips.

---

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@supabase/supabase-js` | ^2.101.1 | DB queries, RLS | Already in project |
| `@supabase/ssr` | ^0.10.0 | Cookie-based sessions for SSR | Already in project |
| `next` | 16.2.2 | Server Actions, Server Components | Already in project |
| `react` | 19.2.4 | `useActionState`, `useOptimistic` | Already in project |

### To Install (shadcn components)
```bash
npx shadcn@latest add table
npx shadcn@latest add dialog
npx shadcn@latest add select
npx shadcn@latest add form
npx shadcn@latest add label
npx shadcn@latest add badge
npx shadcn@latest add sonner
```

`sonner` is the shadcn-recommended toast library (replaces the older `toast` component). It pairs with a `<Toaster />` in the root layout.

### Supporting
| Library | Purpose | Notes |
|---------|---------|-------|
| `lucide-react` | Icons (already v1.7.0) | `Building2`, `Package`, `UserCheck`, `Plus`, `Pencil`, `Trash2` |

---

## Database Schema

### Tables to create

```sql
-- clients table
CREATE TABLE public.clients (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  website      TEXT,
  contact_name TEXT,
  contact_email TEXT,
  assigned_rep UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- service_packages table
CREATE TABLE public.service_packages (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT  NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- client_services junction table
CREATE TABLE public.client_services (
  client_id         UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_package_id UUID NOT NULL REFERENCES public.service_packages(id) ON DELETE CASCADE,
  assigned_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (client_id, service_package_id)
);
```

### RLS Policies

**clients:**
```sql
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Admins can read all clients
CREATE POLICY "Admins read all clients"
  ON public.clients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Reps can read only their assigned clients
CREATE POLICY "Reps read assigned clients"
  ON public.clients FOR SELECT
  USING (assigned_rep = auth.uid());

-- Only admins can write (insert/update/delete)
CREATE POLICY "Admins insert clients"
  ON public.clients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins update clients"
  ON public.clients FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins delete clients"
  ON public.clients FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

**service_packages:**
```sql
ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read service packages
CREATE POLICY "Authenticated users read packages"
  ON public.service_packages FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admins can write
CREATE POLICY "Admins write packages"
  ON public.service_packages FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins update packages"
  ON public.service_packages FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins delete packages"
  ON public.service_packages FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

**client_services:**
```sql
ALTER TABLE public.client_services ENABLE ROW LEVEL SECURITY;

-- Same read scope as clients: admin sees all, rep sees their assigned
CREATE POLICY "Admins read all client_services"
  ON public.client_services FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Reps read their client_services"
  ON public.client_services FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = client_services.client_id
        AND clients.assigned_rep = auth.uid()
    )
  );

-- Only admins can assign/unassign packages
CREATE POLICY "Admins manage client_services"
  ON public.client_services FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins delete client_services"
  ON public.client_services FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

### Migration file naming
Follow the existing convention: `0002_create_clients_services.sql`

---

## Architecture Patterns

### Recommended Route Structure
```
src/app/(dashboard)/
├── admin/
│   ├── clients/
│   │   ├── page.tsx              # Client list (admin view, all clients)
│   │   ├── new/
│   │   │   └── page.tsx          # Create client form page
│   │   └── [id]/
│   │       └── page.tsx          # Client detail (admin: edit controls visible)
│   └── services/
│       └── page.tsx              # Service packages list + CRUD
└── rep/
    └── clients/
        ├── page.tsx              # Client list (rep view, assigned only)
        └── [id]/
            └── page.tsx          # Client detail (rep: read only)
```

Server Actions live in dedicated files alongside the routes that use them:
```
src/app/(dashboard)/admin/clients/
├── actions.ts                    # createClient, updateClient, deleteClient, assignPackages
└── ...
src/app/(dashboard)/admin/services/
├── actions.ts                    # createPackage, updatePackage, deletePackage
└── ...
```

### Pattern 1: Server Component data fetch

**What:** Server Component reads data directly from Supabase. RLS enforces access at query time.

```typescript
// src/app/(dashboard)/admin/clients/page.tsx
import { createClient } from '@/lib/supabase/server'
import { checkRole } from '@/lib/roles'
import { redirect } from 'next/navigation'

export default async function ClientsPage() {
  const isAdmin = await checkRole('admin')
  if (!isAdmin) redirect('/rep/clients')

  const supabase = await createClient()

  const { data: clients } = await supabase
    .from('clients')
    .select(`
      id,
      name,
      website,
      assigned_rep,
      profiles!clients_assigned_rep_fkey ( name ),
      client_services ( count )
    `)
    .order('name')

  return <ClientsTable clients={clients ?? []} />
}
```

**Key detail:** The Supabase JS client supports join queries using PostgREST syntax. `profiles!clients_assigned_rep_fkey` disambiguates the foreign key when multiple FKs exist.

### Pattern 2: Server Action for mutations

**What:** `'use server'` function that validates role, performs DB operation, revalidates cache.

```typescript
// src/app/(dashboard)/admin/clients/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { checkRole } from '@/lib/roles'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createClientAction(formData: FormData) {
  const isAdmin = await checkRole('admin')
  if (!isAdmin) throw new Error('Unauthorized')

  const supabase = await createClient()

  const { error } = await supabase
    .from('clients')
    .insert({
      name: formData.get('name') as string,
      website: formData.get('website') as string,
      contact_name: formData.get('contact_name') as string,
      contact_email: formData.get('contact_email') as string,
      assigned_rep: formData.get('assigned_rep') as string || null,
    })

  if (error) throw new Error(error.message)

  revalidatePath('/admin/clients')
  redirect('/admin/clients')
}
```

**Key detail:** `revalidatePath` purges the Next.js cache for that route so the list re-fetches fresh data after mutation.

### Pattern 3: Rep-scoped list query

**What:** Rep client list uses same route structure but queries only return RLS-allowed rows.

```typescript
// src/app/(dashboard)/rep/clients/page.tsx
import { createClient } from '@/lib/supabase/server'

export default async function RepClientsPage() {
  const supabase = await createClient()

  // RLS on clients table limits this to assigned_rep = auth.uid() rows
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, website, client_services ( count )')
    .order('name')

  return <ClientsTable clients={clients ?? []} isAdmin={false} />
}
```

### Pattern 4: Service package assignment (bulk replace)

**What:** Admin selects/deselects packages on client detail page, submits. Action deletes all existing assignments for the client and inserts the new set.

```typescript
export async function assignPackagesAction(clientId: string, packageIds: string[]) {
  const isAdmin = await checkRole('admin')
  if (!isAdmin) throw new Error('Unauthorized')

  const supabase = await createClient()

  // Delete all current assignments
  await supabase
    .from('client_services')
    .delete()
    .eq('client_id', clientId)

  // Insert new set (if any)
  if (packageIds.length > 0) {
    await supabase
      .from('client_services')
      .insert(packageIds.map(pid => ({ client_id: clientId, service_package_id: pid })))
  }

  revalidatePath(`/admin/clients/${clientId}`)
}
```

### Pattern 5: Rep dropdown data

**What:** Admin client form needs to list reps. Use `createAdminClient()` (service role) to bypass RLS and read all profiles with `role = 'rep'`. This is safe because the data is used server-side only.

```typescript
// In a Server Component or Server Action
import { createAdminClient } from '@/lib/supabase/admin'

const admin = createAdminClient()
const { data: reps } = await admin
  .from('profiles')
  .select('id, name, email')
  .eq('role', 'rep')
  .order('name')
```

**Why admin client:** The server Supabase client (anon key) respects RLS. The `profiles` table RLS only allows users to read their own profile (`auth.uid() = id`). An admin user cannot see all reps' profiles with the anon key unless you add an explicit "admins can read all profiles" policy. Using the admin client for this specific list query avoids adding a broad RLS policy that other code might unexpectedly benefit from.

**Alternative:** Add a Supabase RLS policy allowing admins to read all profiles (is also reasonable — both approaches work).

### Pattern 6: Client Component with Server Action

**What:** Dialog/form that calls a Server Action on submit, shows pending state, and displays error.

```typescript
'use client'

import { useActionState } from 'react'
import { createClientAction } from './actions'

export function CreateClientDialog() {
  const [state, formAction, isPending] = useActionState(createClientAction, null)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" />Add Client</Button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          {/* fields */}
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Creating…' : 'Create client'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

**Key detail:** `useActionState` (React 19, replaces `useFormState`) takes a Server Action and returns `[state, action, isPending]`. The Server Action must return a value (e.g., `{ error: string } | null`) rather than throwing when input validation fails, so the form can display the error. Throw only for truly exceptional errors (auth failures, DB errors).

### Anti-Patterns to Avoid

- **Using admin client for all queries:** The admin client bypasses RLS entirely. Use it only for the specific admin-privileged operations (rep list). All other queries should go through the server client so RLS acts as a defense-in-depth layer.
- **Server Actions that redirect from inside a try/catch:** `redirect()` in Next.js 16 throws a special error. If you catch all errors with `try/catch`, the redirect throw gets swallowed. Either call `redirect()` outside the try block or re-throw if `error.message === 'NEXT_REDIRECT'`.
- **Fetching the client list inside a Client Component:** Don't use the browser Supabase client to fetch the client list — this leaks the query to the client and bypasses Server Component caching. Only use the browser client for interactive state that must run in the browser (e.g., a live search filter).
- **Sharing one `actions.ts` for admin and rep mutations:** Keep admin actions in `admin/clients/actions.ts`. This makes the `checkRole('admin')` guard obvious and prevents accidental use of admin actions in rep routes.
- **Multi-select for service packages as a native `<select multiple>`:** Native multi-select has poor UX. Use a list of checkboxes or shadcn `Command` component with `Checkbox` items rendered in a popover. The decision to use "multi-select from existing service packages list" is satisfied by a checkbox list inside the form — simpler than a combobox.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data table with sorting | Custom `<table>` with sort state | shadcn `Table` + server-side `ORDER BY` query | Client-side sort on a paginated set gives wrong results; server-side ordering is trivial with Supabase `.order()` |
| Toast notifications | Custom toast component | `sonner` via `shadcn add sonner` | Handles stacking, dismissal, accessibility |
| Form validation | Custom regex/check functions | HTML5 constraint validation (`required`, `type="email"`) for basic fields; server-side error state for DB-level validation | Sufficient for v1 internal tooling; no need for Zod/react-hook-form in this phase |
| Pagination | Custom offset/limit logic | Supabase `.range(from, to)` + URL search params for page | Composable, no library needed |
| Optimistic updates | Manual state tracking | `useOptimistic` (React 19) | Only needed if perceived latency is a problem; defer to Phase 2+ |

**Key insight:** This is an internal admin tool. Reach for simplicity. shadcn components + Supabase queries + Server Actions covers all requirements without additional libraries.

---

## Common Pitfalls

### Pitfall 1: PostgREST foreign key join syntax

**What goes wrong:** Query like `.select('profiles(name)')` fails or returns wrong results when `clients` has multiple foreign keys (e.g., `assigned_rep` pointing at `profiles.id` and potentially a future `created_by` column).

**Why it happens:** PostgREST can't infer which FK to use for the join when there are multiple options.

**How to avoid:** Use the explicit FK name syntax: `profiles!clients_assigned_rep_fkey(name)`. Find the constraint name in Supabase Dashboard → Table Editor → Relationships, or in the migration SQL.

**Warning signs:** Supabase returns a `Could not embed resource` error or unexpected null for the joined column.

### Pitfall 2: `redirect()` inside `try/catch`

**What goes wrong:** Server Action calls `redirect('/admin/clients')` inside a try/catch block. The redirect never fires — the page stays put after form submission.

**Why it happens:** `redirect()` in Next.js 16 works by throwing a special `NEXT_REDIRECT` error. If all errors are caught, the redirect is swallowed.

**How to avoid:** Call `redirect()` after the try/catch block, not inside it. Or check `if (isRedirectError(error)) throw error` in the catch handler.

```typescript
// Wrong
try {
  await supabase.from('clients').insert(...)
  redirect('/admin/clients')       // ← this throw gets caught
} catch (e) {
  // swallows redirect
}

// Right
let insertError: string | null = null
try {
  const { error } = await supabase.from('clients').insert(...)
  if (error) insertError = error.message
} catch (e) {
  insertError = 'Unexpected error'
}
if (insertError) return { error: insertError }
redirect('/admin/clients')         // ← called outside try/catch
```

### Pitfall 3: `revalidatePath` scope too narrow

**What goes wrong:** After creating/deleting a client, the list page still shows stale data on next navigation.

**Why it happens:** `revalidatePath('/admin/clients/[id]')` only invalidates that specific dynamic segment, not the list page.

**How to avoid:** Call `revalidatePath('/admin/clients')` (the list) AND `revalidatePath('/admin/clients/[id]', 'page')` as needed. For simplicity, you can `revalidatePath('/admin', 'layout')` to invalidate the whole admin subtree.

### Pitfall 4: RLS blocks admin from reading rep profiles

**What goes wrong:** Admin tries to load the rep dropdown on the new client form; the query returns empty because the anon-key server client can only read the current user's own profile row.

**Why it happens:** The `profiles` RLS policy from Phase 1 only allows `auth.uid() = id`. An admin is also a user — their own row is visible, but other users' rows are not.

**How to avoid:** Use `createAdminClient()` (service role) for the rep-list query, or add an explicit RLS policy on `profiles` like `FOR SELECT USING (auth.uid() IS NOT NULL AND role = 'rep')` to allow anyone to read rep profiles. The admin client approach avoids broadening the RLS surface.

### Pitfall 5: shadcn `Dialog` keeps form state after close

**What goes wrong:** User opens Add Client dialog, fills in some fields, closes without submitting, reopens — old field values still there.

**Why it happens:** React keeps DOM state in controlled components when the element stays mounted. `Dialog` uses a CSS `visibility` or `display` toggle, keeping the form in the DOM.

**How to avoid:** Use a `key` prop on the dialog content tied to an "open" counter so React remounts the form when the dialog opens. Or use uncontrolled form inputs (rely on native form reset on `dialog` close) rather than controlled `useState` fields.

### Pitfall 6: Pagination with `count` from Supabase

**What goes wrong:** Total record count for pagination is wrong or missing.

**Why it happens:** Supabase JS client `.select()` doesn't return total count by default. You must pass `{ count: 'exact' }` as an option.

**How to avoid:**
```typescript
const { data, count } = await supabase
  .from('clients')
  .select('*', { count: 'exact' })
  .range(from, to)
  .order('name')
// count is the total number of rows matching the query (before .range)
```

---

## Code Examples

### Supabase join query with rep name and package count

```typescript
// Source: Supabase JS v2 docs — PostgREST embedding
const { data: clients } = await supabase
  .from('clients')
  .select(`
    id,
    name,
    website,
    profiles!clients_assigned_rep_fkey ( id, name ),
    client_services ( count )
  `)
  .order('name')
  .range(0, 19)
```

### Server Action returning error state (not throwing)

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { checkRole } from '@/lib/roles'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

type ActionState = { error: string } | null

export async function createClientAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const isAdmin = await checkRole('admin')
  if (!isAdmin) return { error: 'Unauthorized' }

  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Client name is required' }

  const supabase = await createClient()
  const { error } = await supabase.from('clients').insert({
    name,
    website: (formData.get('website') as string) || null,
    assigned_rep: (formData.get('assigned_rep') as string) || null,
  })

  if (error) return { error: error.message }

  revalidatePath('/admin/clients')
  redirect('/admin/clients')
}
```

### Pagination URL param pattern

```typescript
// page.tsx
type Props = { searchParams: Promise<{ page?: string }> }

export default async function ClientsPage({ searchParams }: Props) {
  const { page } = await searchParams
  const pageNum = Math.max(1, parseInt(page ?? '1', 10))
  const pageSize = 20
  const from = (pageNum - 1) * pageSize
  const to = from + pageSize - 1

  const supabase = await createClient()
  const { data: clients, count } = await supabase
    .from('clients')
    .select('id, name, website', { count: 'exact' })
    .order('name')
    .range(from, to)

  const totalPages = Math.ceil((count ?? 0) / pageSize)
  // ...
}
```

### shadcn Table shell

```typescript
// Standard table pattern — no library needed beyond shadcn
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'

export function ClientsTable({ clients }: { clients: Client[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Assigned Rep</TableHead>
          <TableHead>Services</TableHead>
          <TableHead className="w-[100px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map(client => (
          <TableRow key={client.id}>
            <TableCell className="font-medium">{client.name}</TableCell>
            <TableCell>{client.profiles?.name ?? '—'}</TableCell>
            <TableCell>{client.client_services?.[0]?.count ?? 0}</TableCell>
            <TableCell>
              {/* admin action buttons */}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact for This Phase |
|--------------|------------------|----------------------|
| `useFormState` (React 18) | `useActionState` (React 19) | Project uses React 19.2.4 — use `useActionState` |
| API Routes for mutations | Server Actions | Cleaner, no separate endpoint, integrated with form |
| Client-side Supabase for data fetching | Server Components + server client | Avoids exposing anon key usage patterns; SSR-friendly |

---

## Open Questions

1. **Admin ability to read all profiles for rep dropdown**
   - What we know: Current `profiles` RLS blocks cross-user reads with the anon client
   - Options: (a) Use `createAdminClient()` for the rep-list query, (b) Add an admin-can-read-all-profiles RLS policy
   - Recommendation: Use `createAdminClient()` in the server action/component that populates the rep dropdown. Avoids RLS policy sprawl.

2. **service_packages READ access for reps**
   - What we know: Reps need to see which packages a client has (CLI-05, SVC-05)
   - Decision needed: Should reps read `service_packages` directly, or only see packages via the joined `client_services` query?
   - Recommendation: Allow all authenticated users to read `service_packages` (via RLS policy). Reps need to see package names to understand what's assigned to their client. This is read-only and non-sensitive.

3. **`updated_at` auto-update trigger**
   - What we know: `clients` table has an `updated_at` column
   - Gap: Without a trigger, `updated_at` won't update automatically on row updates
   - Recommendation: Add a `moddatetime` extension trigger or a manual `BEFORE UPDATE` trigger in the migration. Supabase supports `moddatetime` as a built-in extension.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `/Users/mymac/Documents/RW-3/src/lib/supabase/server.ts` — confirmed async `createClient()` pattern
- `/Users/mymac/Documents/RW-3/src/lib/supabase/admin.ts` — confirmed `createAdminClient()` with service role
- `/Users/mymac/Documents/RW-3/src/lib/roles.ts` — confirmed `checkRole()` API
- `/Users/mymac/Documents/RW-3/src/proxy.ts` — confirmed admin route guard
- `/Users/mymac/Documents/RW-3/supabase/migrations/0001_create_profiles.sql` — confirmed profiles schema + RLS pattern
- `/Users/mymac/Documents/RW-3/components.json` — confirmed shadcn `base-nova` style
- `/Users/mymac/Documents/RW-3/package.json` — confirmed React 19, Next.js 16.2.2, all dependencies

### Secondary (MEDIUM confidence — framework knowledge current as of training cutoff Aug 2025, Next.js 16 + React 19 release notes cross-checked)
- Next.js 16 Server Actions docs — `revalidatePath`, `redirect`, `useActionState` integration
- Supabase JS v2 PostgREST embedding syntax — join with FK disambiguation
- React 19 `useActionState` replacing `useFormState`

### Tertiary (LOW confidence — patterns derived from training)
- shadcn `sonner` as preferred toast — confirmed to exist in shadcn v4 registry but not verified against live docs for `base-nova` style variant

---

## Metadata

**Confidence breakdown:**
- Existing codebase patterns: HIGH — read directly from source files
- Database schema design: HIGH — standard Supabase RLS patterns
- Server Actions pattern: HIGH — well-established Next.js 16 + React 19 pattern
- shadcn components to install: HIGH (list) / MEDIUM (exact CLI flags for `base-nova` style)
- PostgREST join syntax: MEDIUM — confident in pattern, FK constraint name may differ from assumed name

**Research date:** 2026-04-01
**Valid until:** 2026-05-01
