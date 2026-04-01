---
phase: "02"
plan: "02-01"
title: "Database migration + shadcn installs + sidebar nav"
subsystem: "database-ui-foundation"
tags: ["supabase", "postgresql", "rls", "shadcn", "sidebar", "navigation"]

dependency-graph:
  requires: ["01-02"]
  provides: ["clients-table", "service-packages-table", "client-services-table", "shadcn-form-table-dialog-select-label-badge", "phase2-sidebar-nav"]
  affects: ["02-02", "02-03", "02-04"]

tech-stack:
  added: ["react-hook-form", "@hookform/resolvers", "zod"]
  patterns: ["RLS role-scoped policies", "moddatetime trigger for updated_at"]

key-files:
  created:
    - "supabase/migrations/0002_create_clients_services.sql"
    - "src/components/ui/table.tsx"
    - "src/components/ui/dialog.tsx"
    - "src/components/ui/select.tsx"
    - "src/components/ui/label.tsx"
    - "src/components/ui/badge.tsx"
    - "src/components/ui/form.tsx"
  modified:
    - "src/components/app-sidebar.tsx"
    - "package.json"

decisions:
  - id: "form-manual"
    summary: "form.tsx written manually — base-nova registry has no form entry"
    rationale: "shadcn CLI silently skips form for base-nova style; wrote standard react-hook-form wrapper manually"

metrics:
  duration: "3 minutes"
  tasks-completed: 2
  tasks-total: 2
  completed: "2026-04-01"
---

# Phase 2 Plan 01: Database Migration + shadcn Installs + Sidebar Nav Summary

**One-liner:** Postgres migration creating `clients`, `service_packages`, `client_services` with RLS and moddatetime trigger; shadcn table/dialog/select/form/label/badge installed; sidebar updated with Phase 2 nav links.

## What Was Built

### Task 1 — Database Migration

Created `supabase/migrations/0002_create_clients_services.sql` containing:

- `moddatetime` extension enabled in `extensions` schema
- `clients` table (id, name, website, assigned_rep FK → profiles, created_at, updated_at)
- `handle_updated_at` trigger on `clients` using `extensions.moddatetime`
- `service_packages` table (id, name, description, created_at)
- `client_services` junction table (client_id + service_package_id composite PK, both cascade on delete)
- RLS enabled on all three tables
- Admin full-access policies on all three tables
- Rep SELECT-only policy on `clients` scoped to `assigned_rep = auth.uid()`
- Rep SELECT-only policy on `client_services` via EXISTS subquery to `clients`
- Authenticated SELECT policy on `service_packages` (reps need to read package names)

### Task 2 — shadcn Components + Sidebar

Installed via shadcn CLI: `table`, `dialog`, `select`, `label`, `badge`.

Wrote `form.tsx` manually (see deviations).

Installed npm dependencies: `react-hook-form`, `@hookform/resolvers`, `zod`.

Updated `app-sidebar.tsx`:
- Admin nav: Dashboard, Clients (`/admin/clients`), Services (`/admin/services` with Briefcase icon)
- Rep nav: Dashboard, Clients (`/rep/clients`)

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| form.tsx written manually | base-nova shadcn registry has no `form` component entry; CLI silently skips it |
| react-hook-form + zod installed as explicit deps | Required by form.tsx; not auto-installed since shadcn CLI never ran |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] form.tsx not available in base-nova shadcn registry**

- **Found during:** Task 2 shadcn install
- **Issue:** `npx shadcn@latest add form` silently completed with no files created; base-nova registry returns 404 for the form component
- **Fix:** Installed `react-hook-form`, `@hookform/resolvers`, `zod` via npm; wrote `src/components/ui/form.tsx` manually following standard shadcn form pattern (FormProvider, FormField with Controller, FormItem, FormLabel, FormControl, FormDescription, FormMessage)
- **Files modified:** `src/components/ui/form.tsx` (created), `package.json`
- **Commit:** 30bff30

## Verification Results

- [x] `supabase/migrations/0002_create_clients_services.sql` exists with all 3 tables
- [x] RLS enabled on `clients`, `service_packages`, `client_services`
- [x] Admin policies grant full access on all tables
- [x] Rep policy on `clients` scopes to `assigned_rep = auth.uid()`
- [x] `updated_at` trigger created on `clients` using moddatetime
- [x] shadcn `table`, `dialog`, `select`, `form`, `label`, `badge` exist in `src/components/ui/`
- [x] Sidebar shows Clients + Services for admin; Clients for rep
- [x] `npm run build` passes (TypeScript clean, 9 pages compiled)

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 5e3766d | chore | add migration for clients, service_packages, client_services tables |
| 30bff30 | feat | install shadcn components and add Phase 2 sidebar nav links |

## Next Phase Readiness

Phase 02-02 (Clients CRUD) can proceed immediately. The `clients` table, RLS policies, and all required UI components (table, dialog, form, select, badge) are in place. The migration needs to be run in Supabase dashboard SQL editor before the app can interact with the new tables.

**Blockers for next plan:**
- Migration `0002_create_clients_services.sql` must be run in Supabase dashboard before clients CRUD will work
