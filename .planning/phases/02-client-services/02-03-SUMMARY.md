---
phase: 02-client-services
plan: "03"
subsystem: ui
tags: [nextjs, supabase, server-actions, react, shadcn, rls]

# Dependency graph
requires:
  - phase: 02-01
    provides: clients/client_services schema, shadcn components, sidebar nav

provides:
  - Client list page at /admin/clients with FK join for rep name and service count
  - New client form at /admin/clients/new with admin-client rep dropdown
  - Server Actions: createClientAction, updateClientAction, deleteClientAction
  - DeleteClientButton client component using useActionState

affects:
  - 02-04 (client detail/edit page — updateClientAction already present)
  - any phase rendering /admin/clients links

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Server Component wrapper fetches sensitive data (rep list via adminClient), passes as props to Client Component form
    - useActionState with (prevState, formData) two-argument Server Action signature
    - buttonVariants used directly on Link/a elements (base-ui Button has no asChild)
    - shadcn Select + hidden input pattern for FormData compatibility

key-files:
  created:
    - src/app/(dashboard)/admin/clients/actions.ts
    - src/app/(dashboard)/admin/clients/page.tsx
    - src/app/(dashboard)/admin/clients/delete-client-button.tsx
    - src/app/(dashboard)/admin/clients/new/page.tsx
    - src/app/(dashboard)/admin/clients/new/new-client-form.tsx
  modified: []

key-decisions:
  - "Server Actions use (prevState, formData) two-arg signature — required by useActionState in React/Next.js 16"
  - "buttonVariants used on Link/a directly — base-ui Button primitive has no asChild prop unlike radix-based shadcn"
  - "Select state typed as string | null — base-ui Select onValueChange passes string | null"

patterns-established:
  - "Two-arg Server Actions: export async function fooAction(_prevState: ActionState, formData: FormData)"
  - "Rep dropdown: Server Component fetches via createAdminClient(), Client Component gets reps as prop"
  - "buttonVariants({ variant, size }) applied to Link/a for link-styled-as-button pattern"

# Metrics
duration: 4min
completed: 2026-04-01
---

# Phase 2 Plan 03: Client List Page + CRUD Actions (Admin) Summary

**Admin client list at /admin/clients with FK-joined rep names and service counts, plus /admin/clients/new form using createAdminClient() rep dropdown and useActionState Server Actions**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-01T13:51:34Z
- **Completed:** 2026-04-01T13:56:07Z
- **Tasks:** 2
- **Files modified:** 5 created

## Accomplishments

- Three Server Actions (create/update/delete) with `checkRole('admin')` guard on every action
- Client list Server Component with PostgREST FK join for assigned rep name and service count
- New client form with Server Component wrapper (admin client for rep list) + Client Component for controlled Select
- DeleteClientButton client component using `useActionState` for inline optimistic pending state
- `npm run build` passes with clean TypeScript

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Client Server Actions file** - `f1caacf` (feat)
2. **Task 2: Create client list page and new client form** - `dac85e0` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/app/(dashboard)/admin/clients/actions.ts` — createClientAction, updateClientAction, deleteClientAction with (prevState, formData) signatures
- `src/app/(dashboard)/admin/clients/page.tsx` — Server Component list with FK join, empty state, table with edit/delete per row
- `src/app/(dashboard)/admin/clients/delete-client-button.tsx` — Client Component with useActionState for inline delete
- `src/app/(dashboard)/admin/clients/new/page.tsx` — Server Component wrapper that fetches reps via createAdminClient()
- `src/app/(dashboard)/admin/clients/new/new-client-form.tsx` — Client Component with controlled Select + hidden input pattern

## Decisions Made

- **Two-argument Server Action signature:** `useActionState` requires actions typed as `(prevState, formData)`. Plan showed single-arg signature which TypeScript rejected. All actions updated to `(_prevState: ActionState, formData: FormData)`.
- **buttonVariants on Link/a:** The project uses `@base-ui/react/button` which has no `asChild` prop. Applied `buttonVariants({ variant, size })` className directly to `<Link>` and `<a>` elements instead.
- **Select state as `string | null`:** base-ui's Select `onValueChange` passes `string | null`; typed state accordingly and used `value ?? ''` on the hidden input.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated all Server Actions to two-argument (prevState, formData) signature**
- **Found during:** Task 2 (npm run build)
- **Issue:** Plan specified single-arg `(formData: FormData)` but `useActionState` requires `(state, formData)` — TypeScript error on `DeleteClientButton`
- **Fix:** Added `_prevState: ActionState` as first parameter to all three actions; defined `ActionState = { error: string } | null`
- **Files modified:** `actions.ts`
- **Verification:** TypeScript type check passes in build
- **Committed in:** dac85e0 (Task 2 commit, actions.ts included)

**2. [Rule 1 - Bug] Replaced Button asChild with buttonVariants on Link/a elements**
- **Found during:** Task 2 (npm run build)
- **Issue:** `asChild` prop doesn't exist on base-ui Button primitive; build TypeScript error
- **Fix:** Imported `buttonVariants` and applied as className to `<Link>` and `<a>` elements directly
- **Files modified:** `page.tsx`, `new/new-client-form.tsx`
- **Verification:** TypeScript type check passes in build
- **Committed in:** dac85e0 (Task 2 commit)

**3. [Rule 1 - Bug] Typed Select state as `string | null`**
- **Found during:** Task 2 (npm run build)
- **Issue:** base-ui Select `onValueChange` signature is `(value: string | null, ...) => void`; `useState('')` typed as `string` was incompatible
- **Fix:** Changed to `useState<string | null>(null)`, used `repId ?? ''` on hidden input
- **Files modified:** `new/new-client-form.tsx`
- **Verification:** TypeScript type check passes in build
- **Committed in:** dac85e0 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 - Bug: TypeScript type errors caught by build)
**Impact on plan:** All fixes were necessary for correctness. The plan's import paths (`@/lib/auth/roles`, `createServerClient`) also corrected to match actual codebase (`@/lib/roles`, `createClient`). No scope creep.

## Issues Encountered

- Plan's assumed import paths (`@/lib/auth/roles`, `createServerClient`) don't match actual codebase — corrected inline before writing files by reading existing code first.
- `checkRole` in this project takes no supabase client argument (creates its own internally) — plan showed `checkRole('admin', supabase)` pattern; corrected to `checkRole('admin')`.

## User Setup Required

None — no new external services required. Supabase schema migration (0002) must already be applied per 02-01 blockers.

## Next Phase Readiness

- `updateClientAction` is already present for 02-04 (client detail/edit page)
- `/admin/clients/[id]` route is referenced by list page links but not yet built — that's 02-04
- FK join uses `profiles!clients_assigned_rep_fkey` — if Supabase generated a different constraint name, the query will need adjustment (fallback: `profiles(id, full_name)`)

---
*Phase: 02-client-services*
*Completed: 2026-04-01*
