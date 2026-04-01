---
phase: 02-client-services
verified: 2026-04-01T14:11:33Z
status: gaps_found
score: 6/9 must-haves verified
gaps:
  - truth: "Rep client list is RLS-scoped (shows only assigned clients)"
    status: failed
    reason: "rep/clients/page.tsx queries clients table using createClient() which is correct for RLS, but it does not filter by assigned_rep in code — relies entirely on RLS policy. This is actually correct. However the page also queries contact_name/contact_email on the detail page which do not exist in the schema."
    artifacts:
      - path: "src/app/(dashboard)/rep/clients/[id]/page.tsx"
        issue: "Selects contact_name and contact_email from clients table — neither column exists in the 0002 migration. At runtime Supabase returns null for unknown columns, so the page renders blank fields. Not a crash but data will never appear."
    missing:
      - "contact_name and contact_email columns in the clients table migration (or remove the select fields)"

  - truth: "Admin client list and new client form display rep names correctly"
    status: failed
    reason: "profiles table column is 'name' (per 0001_create_profiles.sql), but three files query 'full_name': admin/clients/page.tsx, admin/clients/new/page.tsx, and new-client-form.tsx. Supabase will return null for the missing column so rep names display as the rep's UUID fallback or as blank."
    artifacts:
      - path: "src/app/(dashboard)/admin/clients/page.tsx"
        issue: "Line 24: selects 'full_name' via join — column does not exist, rep name always renders as blank"
      - path: "src/app/(dashboard)/admin/clients/new/page.tsx"
        issue: "Line 8: .select('id, full_name') — column does not exist, rep dropdown shows UUID instead of name"
      - path: "src/app/(dashboard)/admin/clients/new/new-client-form.tsx"
        issue: "Line 62: renders r.full_name — will always be null, falls back to r.id (UUID shown in dropdown)"
    missing:
      - "Rename all 'full_name' references to 'name' to match the profiles schema"

  - truth: "Rep assignment Select component works (None option is selectable)"
    status: failed
    reason: "ClientEditForm in admin/clients/[id]/components.tsx renders <SelectItem value={null}>None</SelectItem>. Radix UI SelectItem requires a non-empty string value. Passing null will cause a runtime error or undefined behavior when the user tries to select 'None' to unassign a rep."
    artifacts:
      - path: "src/app/(dashboard)/admin/clients/[id]/components.tsx"
        issue: "Line 93: value={null} passed to SelectItem — should be value=\"\" or a sentinel string like \"__none__\""
    missing:
      - "Change value={null} to value=\"\" (empty string) or a sentinel, and handle that in updateClientAction to set assigned_rep to null"
---

# Phase 2: Client & Services Management — Verification Report

**Phase Goal:** Admins manage clients and service packages; reps see assigned clients; package assignment works
**Verified:** 2026-04-01T14:11:33Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                 | Status      | Evidence                                                                      |
|----|-----------------------------------------------------------------------|-------------|-------------------------------------------------------------------------------|
| 1  | Migration creates all 3 tables with RLS enabled                       | VERIFIED    | 0002_create_clients_services.sql — clients, service_packages, client_services all present with RLS + policies |
| 2  | shadcn table, dialog, select, form, label, badge all installed        | VERIFIED    | All found in src/components/ui/                                               |
| 3  | Sidebar has Phase 2 nav links for both roles                          | VERIFIED    | app-sidebar.tsx lines 39-42 — admin gets Clients+Services, rep gets Clients   |
| 4  | Service packages CRUD with checkRole('admin') guard                   | VERIFIED    | services/actions.ts — all 3 actions call checkRole('admin') before any DB op  |
| 5  | Client CRUD actions with checkRole('admin') guard                     | VERIFIED    | clients/actions.ts — createClientAction, updateClientAction, deleteClientAction all guarded |
| 6  | assignPackagesAction exists and is wired to detail page               | VERIFIED    | clients/actions.ts lines 74-109, wired via ServiceAssignmentForm in [id]/components.tsx |
| 7  | Admin client list and new client form display rep names correctly     | FAILED      | 3 files query 'full_name' but profiles schema column is 'name' — rep names always blank/UUID |
| 8  | Rep unassignment via Select component works                           | FAILED      | SelectItem value={null} — Radix requires a string; None option will malfunction at runtime |
| 9  | Rep client detail page renders correct data                           | FAILED      | Selects contact_name/contact_email which are not in the migration schema      |

**Score:** 6/9 truths verified

### Required Artifacts

| Artifact                                                        | Expected                              | Status     | Details                                               |
|-----------------------------------------------------------------|---------------------------------------|------------|-------------------------------------------------------|
| `supabase/migrations/0002_create_clients_services.sql`          | 3 tables + RLS                        | VERIFIED   | All 3 tables, RLS enabled, 6 policies present         |
| `src/components/ui/{table,dialog,select,form,label,badge}.tsx`  | shadcn components installed           | VERIFIED   | All 6 present                                         |
| `src/components/app-sidebar.tsx`                                | Phase 2 nav links                     | VERIFIED   | Clients+Services for admin, Clients for rep           |
| `src/app/(dashboard)/admin/services/actions.ts`                 | 3 package actions + checkRole         | VERIFIED   | createPackageAction, updatePackageAction, deletePackageAction |
| `src/app/(dashboard)/admin/services/page.tsx`                   | Service packages list page            | VERIFIED   | Queries DB, renders table, wires AddPackageDialog     |
| `src/app/(dashboard)/admin/clients/actions.ts`                  | 3 client actions + assignPackages     | VERIFIED   | All 4 actions present, all admin-gated                |
| `src/app/(dashboard)/admin/clients/page.tsx`                    | Client list                           | PARTIAL    | Page exists and renders; rep name join uses wrong column (full_name vs name) |
| `src/app/(dashboard)/admin/clients/new/page.tsx`                | New client form with rep dropdown     | PARTIAL    | createAdminClient() used correctly; rep dropdown fetches wrong column name    |
| `src/app/(dashboard)/admin/clients/[id]/page.tsx`               | Detail page: edit + rep + services    | VERIFIED   | notFound() guard, ClientEditForm + ServiceAssignmentForm wired                |
| `src/app/(dashboard)/admin/clients/[id]/components.tsx`         | Edit form + service assignment form   | PARTIAL    | Substantive, wired; SelectItem value={null} is a runtime bug                  |
| `src/app/(dashboard)/rep/clients/page.tsx`                      | RLS-scoped rep client list            | VERIFIED   | Uses createClient() — RLS enforced server-side; renders correctly             |
| `src/app/(dashboard)/rep/clients/[id]/page.tsx`                 | Rep client detail with notFound guard | PARTIAL    | notFound() guard present; queries contact_name/contact_email which don't exist |

### Key Link Verification

| From                                   | To                           | Via                                | Status   | Details                                                        |
|----------------------------------------|------------------------------|------------------------------------|----------|----------------------------------------------------------------|
| services/components.tsx                | services/actions.ts          | useActionState(createPackageAction)| WIRED    | All 3 dialogs/buttons wire to correct actions                  |
| admin/clients/[id]/components.tsx      | clients/actions.ts           | useActionState(updateClientAction) | WIRED    | ClientEditForm → updateClientAction                            |
| admin/clients/[id]/components.tsx      | clients/actions.ts           | useActionState(assignPackagesAction)| WIRED   | ServiceAssignmentForm → assignPackagesAction                   |
| admin/clients/new/new-client-form.tsx  | clients/actions.ts           | useActionState(createClientAction) | WIRED    | NewClientForm → createClientAction                             |
| admin/clients/page.tsx                 | profiles (via join)          | .select('full_name')               | BROKEN   | Column is 'name' in schema; returns null at runtime            |
| rep/clients/[id]/page.tsx              | clients table                | .select('contact_name, contact_email') | BROKEN | Columns do not exist in migration; always returns null         |
| admin/clients/[id]/components.tsx      | SelectItem                   | value={null}                       | BROKEN   | Radix SelectItem requires string value; null causes malfunction |

### Requirements Coverage

| Requirement | Status   | Blocking Issue                                      |
|-------------|----------|-----------------------------------------------------|
| CLI-01      | PARTIAL  | Client list renders but rep name column always blank |
| CLI-02      | PARTIAL  | New client form works but rep dropdown shows UUIDs   |
| CLI-03      | VERIFIED | Client edit action + delete action both work         |
| CLI-04      | PARTIAL  | Rep unassign broken (SelectItem null value bug)      |
| CLI-05      | VERIFIED | Rep client list correctly RLS-scoped                 |
| SVC-01      | VERIFIED | Service packages list renders                        |
| SVC-02      | VERIFIED | Add package action works                             |
| SVC-03      | VERIFIED | Edit package action works                            |
| SVC-04      | VERIFIED | Delete package action works                          |
| SVC-05      | PARTIAL  | Service assignment form works; contact fields on rep detail pull non-existent columns |

### Anti-Patterns Found

| File                                          | Line | Pattern                          | Severity | Impact                                                          |
|-----------------------------------------------|------|----------------------------------|----------|-----------------------------------------------------------------|
| `admin/clients/page.tsx`                      | 24   | `.select('full_name')` mismatch  | Blocker  | Rep name always null in client list — wrong column name         |
| `admin/clients/new/page.tsx`                  | 8    | `.select('id, full_name')` mismatch | Blocker | Rep dropdown renders UUID instead of name                       |
| `admin/clients/[id]/components.tsx`           | 93   | `value={null}` on SelectItem     | Blocker  | None/unassign option malfunctions at runtime                    |
| `rep/clients/[id]/page.tsx`                   | 16   | Selects non-existent columns     | Warning  | contact_name and contact_email always render as "—" placeholder |

### Human Verification Required

None — all critical checks can be determined structurally.

### Gaps Summary

Three gaps block full goal achievement. They are all data-layer mismatches introduced during implementation:

**Gap 1 — `full_name` column mismatch (affects CLI-01, CLI-02):** The `profiles` table defines the column as `name`, but three files in the admin clients section query `full_name`. This causes rep names to silently return as null from Supabase. The client list shows "Unassigned" for all clients and the new client rep dropdown shows raw UUIDs. Fix: rename `full_name` to `name` in `admin/clients/page.tsx` (line 24, 89), `admin/clients/new/page.tsx` (lines 8, 10), and `new-client-form.tsx` (lines 18, 62).

**Gap 2 — `SelectItem value={null}` (affects CLI-04):** The "None" option in the rep assignment dropdown in the client edit form passes `value={null}` to Radix UI's SelectItem, which requires a string. This will cause a runtime error or silent failure when an admin attempts to unassign a rep. Fix: change to `value=""` and update `updateClientAction` to treat empty string as `null` for `assigned_rep`.

**Gap 3 — Non-existent `contact_name`/`contact_email` columns (affects rep detail):** The rep client detail page selects `contact_name` and `contact_email` from the `clients` table. These columns were not included in the `0002_create_clients_services.sql` migration. Fields will always render as "—". This is a schema/code mismatch — either add the columns to the migration or remove them from the select query.

---

_Verified: 2026-04-01T14:11:33Z_
_Verifier: Claude (gsd-verifier)_
