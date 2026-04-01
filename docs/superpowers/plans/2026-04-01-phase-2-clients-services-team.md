# Phase 2 — Clients, Services & Team Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins can manage clients, service packages, and team members; reps see their assigned clients; service package assignment works end-to-end.

**Architecture:** Server Components for all data-fetching pages; `'use client'` components only for interactive forms using React 19 `useActionState`. All writes go through Server Actions in `src/app/actions/`. Supabase RLS enforces access control at the database layer.

**Tech Stack:** Next.js 16, React 19, Supabase JS (anon + service role), shadcn/ui, TypeScript

---

## File Map

**New files:**
- `supabase/migrations/0002_create_clients.sql` — clients table + RLS
- `supabase/migrations/0003_create_services.sql` — service_packages + client_services + RLS
- `src/app/actions/clients.ts` — createClient, updateClient, deleteClient
- `src/app/actions/services.ts` — createPackage, updatePackage, deletePackage, assignPackage, unassignPackage
- `src/app/actions/team.ts` — inviteUser, changeRole
- `src/app/(dashboard)/admin/clients/page.tsx` — admin client list (server component)
- `src/app/(dashboard)/admin/clients/new/page.tsx` — add client page (server component + client form)
- `src/app/(dashboard)/admin/clients/[id]/page.tsx` — admin client detail (server component)
- `src/app/(dashboard)/admin/services/page.tsx` — services CRUD page (server component)
- `src/app/(dashboard)/admin/team/page.tsx` — team roster + invite (server component)
- `src/app/(dashboard)/rep/clients/page.tsx` — rep client list (server component)
- `src/app/(dashboard)/rep/clients/[id]/page.tsx` — rep client detail (server component)
- `src/components/clients/client-form.tsx` — add/edit client form ('use client')
- `src/components/clients/service-checkboxes.tsx` — service assignment checkboxes ('use client')
- `src/components/services/service-drawer.tsx` — add/edit package sheet ('use client')
- `src/components/team/invite-drawer.tsx` — invite form sheet ('use client')
- `src/components/team/team-page-client.tsx` — team table + role toggle + invite trigger ('use client')

**Modified files:**
- `src/components/app-sidebar.tsx` — add Services, Team, Settings nav items for admin
- `src/app/(dashboard)/admin/page.tsx` — link empty-state cards to real routes
- `src/app/(dashboard)/rep/page.tsx` — link empty-state card to /rep/clients

---

## Task 1: Install shadcn/ui components

**Files:** none (installs to `src/components/ui/`)

- [ ] **Step 1: Install required components**

```bash
npx shadcn@latest add badge table select label textarea alert-dialog checkbox
```

Expected: components appear in `src/components/ui/`

- [ ] **Step 2: Verify build still passes**

```bash
npm run build
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/
git commit -m "feat(ui): install badge, table, select, label, textarea, alert-dialog"
```

---

## Task 2: Migration — clients table

**Files:**
- Create: `supabase/migrations/0002_create_clients.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0002_create_clients.sql
-- Policies: admin full CRUD; rep SELECT on assigned clients only

CREATE TABLE public.clients (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  website         TEXT,
  assigned_rep_id UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  active          BOOLEAN     NOT NULL DEFAULT true,
  sheets_row_id   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage clients"
  ON public.clients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Reps can view their assigned clients
CREATE POLICY "Reps can view assigned clients"
  ON public.clients
  FOR SELECT
  USING (assigned_rep_id = auth.uid());
```

- [ ] **Step 2: Apply migration in Supabase dashboard**

Open Supabase dashboard → SQL Editor → paste and run the migration.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_create_clients.sql
git commit -m "feat(db): add clients table with RLS"
```

---

## Task 3: Migration — service_packages and client_services tables

**Files:**
- Create: `supabase/migrations/0003_create_services.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0003_create_services.sql
-- Policies: admin full CRUD on both; rep SELECT only

CREATE TABLE public.service_packages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage service packages"
  ON public.service_packages
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Reps can view service packages"
  ON public.service_packages
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'rep')
  );

-- Junction table: which packages are assigned to which clients
CREATE TABLE public.client_services (
  client_id   UUID        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  package_id  UUID        NOT NULL REFERENCES public.service_packages(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (client_id, package_id)
);

ALTER TABLE public.client_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage client services"
  ON public.client_services
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Reps can view client services for assigned clients"
  ON public.client_services
  FOR SELECT
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
git add supabase/migrations/0003_create_services.sql
git commit -m "feat(db): add service_packages and client_services tables with RLS"
```

---

## Task 4: Client server actions

**Files:**
- Create: `src/app/actions/clients.ts`

- [ ] **Step 1: Write the actions file**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ClientActionState = { error?: string; success?: boolean }

export async function createClient_(
  _prevState: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const name = formData.get('name') as string
  const website = formData.get('website') as string
  const assignedRepId = formData.get('assigned_rep_id') as string | null

  if (!name?.trim()) return { error: 'Client name is required' }

  const { error } = await supabase.from('clients').insert({
    name: name.trim(),
    website: website?.trim() || null,
    assigned_rep_id: assignedRepId || null,
    created_by: user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/admin/clients')
  return { success: true }
}

export async function updateClient(
  id: string,
  _prevState: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const website = formData.get('website') as string
  const assignedRepId = formData.get('assigned_rep_id') as string | null
  const active = formData.get('active') === 'true'

  if (!name?.trim()) return { error: 'Client name is required' }

  const { error } = await supabase
    .from('clients')
    .update({
      name: name.trim(),
      website: website?.trim() || null,
      assigned_rep_id: assignedRepId || null,
      active,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath(`/admin/clients/${id}`)
  revalidatePath('/admin/clients')
  return { success: true }
}

export async function deleteClient(id: string): Promise<ClientActionState> {
  const supabase = await createClient()

  // Soft delete
  const { error } = await supabase
    .from('clients')
    .update({ active: false })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/clients')
  return { success: true }
}
```

> Note: the action is named `createClient_` (with underscore) to avoid collision with `createClient` from `@/lib/supabase/server`. Import it aliased: `import { createClient_ as createClientAction } from '@/app/actions/clients'`.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -40
```

Expected: no errors in `src/app/actions/clients.ts`

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/clients.ts
git commit -m "feat(actions): add client CRUD server actions"
```

---

## Task 5: Service server actions

**Files:**
- Create: `src/app/actions/services.ts`

- [ ] **Step 1: Write the actions file**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ServiceActionState = { error?: string; success?: boolean }

export async function createPackage(
  _prevState: ServiceActionState,
  formData: FormData
): Promise<ServiceActionState> {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const description = formData.get('description') as string

  if (!name?.trim()) return { error: 'Package name is required' }

  const { error } = await supabase.from('service_packages').insert({
    name: name.trim(),
    description: description?.trim() || null,
  })

  if (error) return { error: error.message }

  revalidatePath('/admin/services')
  return { success: true }
}

export async function updatePackage(
  id: string,
  _prevState: ServiceActionState,
  formData: FormData
): Promise<ServiceActionState> {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const description = formData.get('description') as string

  if (!name?.trim()) return { error: 'Package name is required' }

  const { error } = await supabase
    .from('service_packages')
    .update({ name: name.trim(), description: description?.trim() || null })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/services')
  return { success: true }
}

export async function deletePackage(id: string): Promise<ServiceActionState> {
  const supabase = await createClient()

  // Block delete if any clients are using this package
  const { count } = await supabase
    .from('client_services')
    .select('*', { count: 'exact', head: true })
    .eq('package_id', id)

  if (count && count > 0) {
    return { error: `Cannot delete: ${count} client(s) use this package. Remove them first.` }
  }

  const { error } = await supabase.from('service_packages').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/services')
  return { success: true }
}

export async function assignPackage(
  clientId: string,
  packageId: string
): Promise<ServiceActionState> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('client_services')
    .upsert({ client_id: clientId, package_id: packageId })

  if (error) return { error: error.message }

  revalidatePath(`/admin/clients/${clientId}`)
  revalidatePath(`/rep/clients/${clientId}`)
  return { success: true }
}

export async function unassignPackage(
  clientId: string,
  packageId: string
): Promise<ServiceActionState> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('client_services')
    .delete()
    .eq('client_id', clientId)
    .eq('package_id', packageId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/clients/${clientId}`)
  revalidatePath(`/rep/clients/${clientId}`)
  return { success: true }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | head -40
```

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/services.ts
git commit -m "feat(actions): add service package and client_services server actions"
```

---

## Task 6: Team server actions

**Files:**
- Create: `src/app/actions/team.ts`

- [ ] **Step 1: Write the actions file**

```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export type TeamActionState = { error?: string; success?: boolean }

export async function inviteUser(
  _prevState: TeamActionState,
  formData: FormData
): Promise<TeamActionState> {
  const email = (formData.get('email') as string)?.trim()
  const role = formData.get('role') as string

  if (!email) return { error: 'Email is required' }
  if (!['admin', 'rep'].includes(role)) return { error: 'Invalid role' }

  const adminClient = createAdminClient()

  const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { role },
  })

  if (error) return { error: error.message }

  revalidatePath('/admin/team')
  return { success: true }
}

export async function changeRole(
  userId: string,
  newRole: 'admin' | 'rep'
): Promise<TeamActionState> {
  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId)

  if (error) return { error: error.message }

  revalidatePath('/admin/team')
  return { success: true }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | head -40
```

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/team.ts
git commit -m "feat(actions): add team invite and role change server actions"
```

---

## Task 7: Update sidebar navigation

**Files:**
- Modify: `src/components/app-sidebar.tsx`

- [ ] **Step 1: Add new nav items**

Replace the `navItems` array in `app-sidebar.tsx`:

```typescript
import { LayoutDashboard, Users, Zap, Settings, UserCircle } from 'lucide-react'

// inside AppSidebar component:
const navItems = isAdmin
  ? [
      { label: 'Dashboard',  href: '/admin',           icon: LayoutDashboard },
      { label: 'Clients',    href: '/admin/clients',   icon: Users },
      { label: 'Signals',    href: '/admin/signals',   icon: Zap },
      { label: 'Services',   href: '/admin/services',  icon: UserCircle },
      { label: 'Team',       href: '/admin/team',      icon: Users },
      { label: 'Settings',   href: '/admin/settings',  icon: Settings },
    ]
  : [
      { label: 'Dashboard',   href: '/rep',          icon: LayoutDashboard },
      { label: 'My Clients',  href: '/rep/clients',  icon: Users },
      { label: 'Signals',     href: '/rep/signals',  icon: Zap },
    ]
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | head -40
```

- [ ] **Step 3: Commit**

```bash
git add src/components/app-sidebar.tsx
git commit -m "feat(nav): expand sidebar with Services, Team, Settings, Signals links"
```

---

## Task 8: Admin clients list page and add-client form

**Files:**
- Create: `src/app/(dashboard)/admin/clients/page.tsx`
- Create: `src/app/(dashboard)/admin/clients/new/page.tsx`
- Create: `src/components/clients/client-form.tsx`

- [ ] **Step 1: Write client-form.tsx (client component)**

```typescript
'use client'

import { useActionState } from 'react'
import { createClient_ as createClientAction } from '@/app/actions/clients'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

type Rep = { id: string; name: string | null; email: string }

export function ClientForm({ reps }: { reps: Rep[] }) {
  const [state, action, isPending] = useActionState(createClientAction, {})
  const router = useRouter()

  useEffect(() => {
    if (state.success) router.push('/admin/clients')
  }, [state.success, router])

  return (
    <form action={action} className="space-y-4 max-w-md">
      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="name">Client name *</Label>
        <Input id="name" name="name" required placeholder="Acme Corp" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="website">Website</Label>
        <Input id="website" name="website" placeholder="https://acme.com" />
      </div>
      <div className="space-y-1.5">
        <Label>Assigned rep</Label>
        <Select name="assigned_rep_id">
          <SelectTrigger>
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            {reps.map((rep) => (
              <SelectItem key={rep.id} value={rep.id}>
                {rep.name || rep.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Adding…' : 'Add client'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Write admin clients list page**

```typescript
import { createClient } from '@/lib/supabase/server'
import { checkRole } from '@/lib/roles'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export default async function AdminClientsPage() {
  const isAdmin = await checkRole('admin')
  if (!isAdmin) redirect('/rep')

  const supabase = await createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, website, active, assigned_rep_id, profiles!assigned_rep_id(name, email)')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Clients</h1>
        <Button asChild>
          <Link href="/admin/clients/new">Add client</Link>
        </Button>
      </div>
      {!clients?.length ? (
        <div className="rounded-lg border p-12 text-center">
          <p className="text-muted-foreground">No clients yet.</p>
          <Button asChild className="mt-4">
            <Link href="/admin/clients/new">Add your first client</Link>
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Website</TableHead>
              <TableHead>Rep</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => {
              const rep = client.profiles as { name: string | null; email: string } | null
              return (
                <TableRow key={client.id} className="cursor-pointer">
                  <TableCell>
                    <Link href={`/admin/clients/${client.id}`} className="font-medium hover:underline">
                      {client.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{client.website || '—'}</TableCell>
                  <TableCell>{rep ? (rep.name || rep.email) : <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                  <TableCell>
                    <Badge variant={client.active ? 'default' : 'secondary'}>
                      {client.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Write add-client page**

```typescript
// src/app/(dashboard)/admin/clients/new/page.tsx
import { createClient } from '@/lib/supabase/server'
import { checkRole } from '@/lib/roles'
import { redirect } from 'next/navigation'
import { ClientForm } from '@/components/clients/client-form'

export default async function NewClientPage() {
  const isAdmin = await checkRole('admin')
  if (!isAdmin) redirect('/rep')

  const supabase = await createClient()
  const { data: reps } = await supabase
    .from('profiles')
    .select('id, name, email')
    .eq('role', 'rep')
    .order('name')

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Add client</h1>
      <ClientForm reps={reps ?? []} />
    </div>
  )
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | head -60
```

Expected: no TypeScript errors

- [ ] **Step 5: Manual check**

```bash
npm run dev
```

Navigate to `/admin/clients` — table renders. Click "Add client" — form renders. Fill out and submit — redirects back to list.

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/admin/clients/ src/components/clients/client-form.tsx
git commit -m "feat(clients): admin client list and add-client form"
```

---

## Task 9: Admin client detail page

**Files:**
- Create: `src/app/(dashboard)/admin/clients/[id]/page.tsx`
- Create: `src/components/clients/service-checkboxes.tsx`

- [ ] **Step 1: Write service-checkboxes.tsx (client component)**

```typescript
'use client'

import { assignPackage, unassignPackage } from '@/app/actions/services'
import { useTransition } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

type Package = { id: string; name: string }

export function ServiceCheckboxes({
  clientId,
  allPackages,
  assignedIds,
}: {
  clientId: string
  allPackages: Package[]
  assignedIds: string[]
}) {
  const [isPending, startTransition] = useTransition()

  function handleToggle(packageId: string, checked: boolean) {
    startTransition(async () => {
      if (checked) {
        await assignPackage(clientId, packageId)
      } else {
        await unassignPackage(clientId, packageId)
      }
    })
  }

  return (
    <div className="space-y-2">
      {allPackages.map((pkg) => (
        <div key={pkg.id} className="flex items-center gap-2">
          <Checkbox
            id={pkg.id}
            checked={assignedIds.includes(pkg.id)}
            onCheckedChange={(checked) => handleToggle(pkg.id, !!checked)}
            disabled={isPending}
          />
          <Label htmlFor={pkg.id}>{pkg.name}</Label>
        </div>
      ))}
    </div>
  )
}
```

Note: install `checkbox` component first:
```bash
npx shadcn@latest add checkbox
```

- [ ] **Step 2: Write admin client detail page**

```typescript
// src/app/(dashboard)/admin/clients/[id]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { checkRole } from '@/lib/roles'
import { notFound, redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { ServiceCheckboxes } from '@/components/clients/service-checkboxes'

export default async function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const isAdmin = await checkRole('admin')
  if (!isAdmin) redirect('/rep')

  const { id } = await params
  const supabase = await createClient()

  const [{ data: client }, { data: allPackages }, { data: assigned }] = await Promise.all([
    supabase
      .from('clients')
      .select('*, profiles!assigned_rep_id(name, email)')
      .eq('id', id)
      .single(),
    supabase.from('service_packages').select('id, name').order('name'),
    supabase.from('client_services').select('package_id').eq('client_id', id),
  ])

  if (!client) notFound()

  const rep = client.profiles as { name: string | null; email: string } | null
  const assignedIds = (assigned ?? []).map((r) => r.package_id)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{client.name}</h1>
        <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
          {client.website && <span>{client.website}</span>}
          <span>Rep: {rep ? (rep.name || rep.email) : 'Unassigned'}</span>
          <Badge variant={client.active ? 'default' : 'secondary'}>
            {client.active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Service packages</h2>
        {allPackages?.length ? (
          <ServiceCheckboxes
            clientId={id}
            allPackages={allPackages}
            assignedIds={assignedIds}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            No packages yet.{' '}
            <a href="/admin/services" className="underline">Add some in Services.</a>
          </p>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Signals</h2>
        <p className="text-sm text-muted-foreground">Signals appear here after scanning is set up (Phase 4).</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | head -60
```

- [ ] **Step 4: Manual check**

Navigate to `/admin/clients/[id]` — client detail renders with service checkboxes.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/admin/clients/[id]/ src/components/clients/service-checkboxes.tsx
git commit -m "feat(clients): admin client detail with service package assignment"
```

---

## Task 10: Admin services page

**Files:**
- Create: `src/app/(dashboard)/admin/services/page.tsx`
- Create: `src/components/services/service-drawer.tsx`

- [ ] **Step 1: Write service-drawer.tsx (client component)**

```typescript
'use client'

import { useActionState, useEffect, useState } from 'react'
import { createPackage, updatePackage } from '@/app/actions/services'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Package = { id: string; name: string; description: string | null }

export function ServiceDrawer({
  open,
  onClose,
  pkg,
}: {
  open: boolean
  onClose: () => void
  pkg?: Package | null
}) {
  const action = pkg
    ? updatePackage.bind(null, pkg.id)
    : createPackage

  const [state, formAction, isPending] = useActionState(action, {})

  useEffect(() => {
    if (state.success) onClose()
  }, [state.success, onClose])

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{pkg ? 'Edit package' : 'Add package'}</SheetTitle>
        </SheetHeader>
        <form action={formAction} className="mt-6 space-y-4">
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" name="name" defaultValue={pkg?.name} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" defaultValue={pkg?.description ?? ''} />
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? 'Saving…' : pkg ? 'Save changes' : 'Add package'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Write admin services page**

> Note: the services page is intentionally a `'use client'` component despite the general server-component preference. Inline edit/delete/drawer state cannot live in a server component — this is the minimum necessary client boundary.

```typescript
// src/app/(dashboard)/admin/services/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { deletePackage } from '@/app/actions/services'
import { ServiceDrawer } from '@/components/services/service-drawer'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
```

> Note: the services page needs to be a client component because it manages drawer/dialog open state. It fetches data directly from Supabase browser client on mount.

Full file:

```typescript
'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { deletePackage } from '@/app/actions/services'
import { ServiceDrawer } from '@/components/services/service-drawer'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type Package = { id: string; name: string; description: string | null; created_at: string }

export default function AdminServicesPage() {
  const [packages, setPackages] = useState<Package[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Package | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Package | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const loadPackages = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('service_packages')
      .select('*')
      .order('name')
    setPackages(data ?? [])
  }, [])

  useEffect(() => { loadPackages() }, [loadPackages])

  function openAdd() { setEditing(null); setDrawerOpen(true) }
  function openEdit(pkg: Package) { setEditing(pkg); setDrawerOpen(true) }
  function closeDrawer() { setDrawerOpen(false); setEditing(null); loadPackages() }

  async function handleDelete() {
    if (!deleteTarget) return
    const result = await deletePackage(deleteTarget.id)
    if (result.error) {
      setDeleteError(result.error)
    } else {
      setDeleteTarget(null)
      loadPackages()
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Service packages</h1>
        <Button onClick={openAdd}>Add package</Button>
      </div>

      {!packages.length ? (
        <div className="rounded-lg border p-12 text-center">
          <p className="text-muted-foreground">No packages yet.</p>
          <Button className="mt-4" onClick={openAdd}>Add your first package</Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {packages.map((pkg) => (
              <TableRow key={pkg.id}>
                <TableCell className="font-medium">{pkg.name}</TableCell>
                <TableCell className="text-muted-foreground">{pkg.description || '—'}</TableCell>
                <TableCell>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(pkg)}>Edit</Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setDeleteTarget(pkg); setDeleteError(null) }}>Delete</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ServiceDrawer open={drawerOpen} onClose={closeDrawer} pkg={editing} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
              {deleteError && <span className="block mt-2 text-destructive">{deleteError}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | head -60
```

- [ ] **Step 4: Manual check**

Navigate to `/admin/services` — empty state renders. Add a package — it appears in the table. Edit, delete confirm dialog works.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/admin/services/ src/components/services/
git commit -m "feat(services): admin service packages CRUD page"
```

---

## Task 11: Admin team page

**Files:**
- Create: `src/app/(dashboard)/admin/team/page.tsx`
- Create: `src/components/team/invite-drawer.tsx`

- [ ] **Step 1: Write invite-drawer.tsx (client component)**

```typescript
'use client'

import { useActionState, useEffect } from 'react'
import { inviteUser } from '@/app/actions/team'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function InviteDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [state, formAction, isPending] = useActionState(inviteUser, {})

  useEffect(() => {
    if (state.success) onClose()
  }, [state.success, onClose])

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Invite team member</SheetTitle>
        </SheetHeader>
        <form action={formAction} className="mt-6 space-y-4">
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" name="email" type="email" required placeholder="rep@company.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Role *</Label>
            <Select name="role" defaultValue="rep">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rep">Client Service Rep</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? 'Sending invite…' : 'Send invite'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Write admin team page**

```typescript
// src/app/(dashboard)/admin/team/page.tsx
import { createClient } from '@/lib/supabase/server'
import { checkRole } from '@/lib/roles'
import { redirect } from 'next/navigation'
import { TeamPageClient } from '@/components/team/team-page-client'

export default async function AdminTeamPage() {
  const isAdmin = await checkRole('admin')
  if (!isAdmin) redirect('/rep')

  const supabase = await createClient()
  const { data: members } = await supabase
    .from('profiles')
    .select('id, name, email, role, created_at')
    .order('created_at', { ascending: true })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Team</h1>
      </div>
      <TeamPageClient members={members ?? []} />
    </div>
  )
}
```

- [ ] **Step 3: Write team-page-client.tsx**

Create `src/components/team/team-page-client.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { changeRole } from '@/app/actions/team'
import { InviteDrawer } from './invite-drawer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

type Member = { id: string; name: string | null; email: string; role: string; created_at: string }

export function TeamPageClient({ members }: { members: Member[] }) {
  const [inviteOpen, setInviteOpen] = useState(false)

  async function handleRoleChange(userId: string, newRole: 'admin' | 'rep') {
    await changeRole(userId, newRole)
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setInviteOpen(true)}>Invite member</Button>
      </div>

      {!members.length ? (
        <div className="rounded-lg border p-12 text-center">
          <p className="text-muted-foreground">No team members yet.</p>
          <Button className="mt-4" onClick={() => setInviteOpen(true)}>Invite someone</Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name || '—'}</TableCell>
                <TableCell>{m.email}</TableCell>
                <TableCell>
                  <Select
                    defaultValue={m.role}
                    onValueChange={(v) => handleRoleChange(m.id, v as 'admin' | 'rep')}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="rep">Rep</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(m.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <InviteDrawer open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </>
  )
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | head -60
```

- [ ] **Step 5: Manual check**

Navigate to `/admin/team` — roster renders. Click "Invite member" — sheet opens. Role dropdown changes inline.

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/admin/team/ src/components/team/
git commit -m "feat(team): admin team roster with invite and role management"
```

---

## Task 12: Rep clients pages

**Files:**
- Create: `src/app/(dashboard)/rep/clients/page.tsx`
- Create: `src/app/(dashboard)/rep/clients/[id]/page.tsx`

- [ ] **Step 1: Write rep clients list page**

```typescript
// src/app/(dashboard)/rep/clients/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { checkRole } from '@/lib/roles'
import Link from 'next/link'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export default async function RepClientsPage() {
  const isAdmin = await checkRole('admin')
  if (isAdmin) redirect('/admin/clients')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, website, active')
    .eq('assigned_rep_id', user.id)
    .eq('active', true)
    .order('name')

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">My Clients</h1>
      {!clients?.length ? (
        <div className="rounded-lg border p-12 text-center">
          <p className="text-muted-foreground">No clients assigned to you yet.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Website</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <Link href={`/rep/clients/${client.id}`} className="font-medium hover:underline">
                    {client.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{client.website || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write rep client detail page**

```typescript
// src/app/(dashboard)/rep/clients/[id]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { checkRole } from '@/lib/roles'
import { Badge } from '@/components/ui/badge'

export default async function RepClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const isAdmin = await checkRole('admin')
  const { id } = await params

  if (isAdmin) redirect(`/admin/clients/${id}`)

  const supabase = await createClient()

  const [{ data: client }, { data: assigned }] = await Promise.all([
    supabase
      .from('clients')
      .select('*, service_packages:client_services(service_packages(id, name))')
      .eq('id', id)
      .single(),
    supabase
      .from('client_services')
      .select('service_packages(name)')
      .eq('client_id', id),
  ])

  if (!client) notFound()

  const packages = (assigned ?? []).flatMap((r) =>
    r.service_packages ? [r.service_packages as { name: string }] : []
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{client.name}</h1>
        {client.website && (
          <p className="mt-1 text-sm text-muted-foreground">{client.website}</p>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Service packages</h2>
        {packages.length ? (
          <div className="flex flex-wrap gap-2">
            {packages.map((p) => (
              <Badge key={p.name} variant="secondary">{p.name}</Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No packages assigned.</p>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Signals</h2>
        <p className="text-sm text-muted-foreground">Signals appear here after scanning is set up.</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | head -60
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/rep/clients/
git commit -m "feat(clients): rep client list and detail pages"
```

---

## Task 13: Update dashboard landing pages

**Files:**
- Modify: `src/app/(dashboard)/admin/page.tsx`
- Modify: `src/app/(dashboard)/rep/page.tsx`

- [ ] **Step 1: Update admin dashboard**

Replace the content of `src/app/(dashboard)/admin/page.tsx`:

```typescript
import { checkRole } from '@/lib/roles'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function AdminDashboard() {
  const isAdmin = await checkRole('admin')
  if (!isAdmin) redirect('/rep')

  return (
    <div>
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Manage clients, view signals, and monitor trends.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-6">
          <h3 className="font-semibold">Clients</h3>
          <p className="mt-1 text-sm text-muted-foreground">Manage client accounts and service assignments.</p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/admin/clients">View clients</Link>
          </Button>
        </div>
        <div className="rounded-lg border p-6">
          <h3 className="font-semibold">Signals</h3>
          <p className="mt-1 text-sm text-muted-foreground">Global signal feed across all clients.</p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/admin/signals">View signals</Link>
          </Button>
        </div>
        <div className="rounded-lg border p-6">
          <h3 className="font-semibold">Team</h3>
          <p className="mt-1 text-sm text-muted-foreground">Manage team members and roles.</p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/admin/team">View team</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update rep dashboard**

```typescript
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function RepDashboard() {
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
          <h3 className="font-semibold">Recent Signals</h3>
          <p className="mt-1 text-sm text-muted-foreground">Signals from your clients.</p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/rep/signals">View signals</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Final build check**

```bash
npm run build
```

Expected: clean build, no errors

- [ ] **Step 4: Final manual check**

```bash
npm run dev
```

Walk through:
1. Sign in as admin → dashboard shows links → clients page → add client → detail page → service assignment works
2. Sign in as rep → dashboard → my clients → detail page (read-only)
3. Admin: services page CRUD
4. Admin: team page + invite drawer

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/admin/page.tsx src/app/(dashboard)/rep/page.tsx
git commit -m "feat(dashboard): update landing pages with navigation links"
```
