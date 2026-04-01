---
plan: 01-05
status: complete
completed: 2026-04-01
commit: 7e15dfa
---

# Summary — 01-05: Navigation Shell

## What Was Built

- **`src/components/app-sidebar.tsx`** — Client component sidebar. Accepts `name`, `email`, `role` props from server layout. Renders role-specific nav links (admin: Dashboard + Clients; rep: Dashboard + My Clients). Sign-out button calls `supabase.auth.signOut()` and redirects to `/sign-in`.
- **`src/app/(dashboard)/layout.tsx`** — Server layout. Fetches user + profile from Supabase, passes to `AppSidebar`. Wraps all dashboard pages with `SidebarProvider`.
- **`src/app/(dashboard)/admin/page.tsx`** — Admin landing page with 3 empty-state cards. Server-side role guard redirects non-admins to `/rep`.
- **`src/app/(dashboard)/rep/page.tsx`** — Rep landing page with 2 empty-state cards.
- **`src/app/page.tsx`** — Root redirect: unauthenticated → `/sign-in`; admin → `/admin`; rep → `/rep`.

## Key Decisions

- `AppSidebar` takes props instead of fetching internally — keeps it a thin client component, avoids duplicate Supabase calls
- `SidebarMenuButton` uses Base UI `render` prop pattern (not `asChild`) — matches the installed shadcn/ui version
- Sign-out handled client-side via Supabase browser client + `router.refresh()` to clear server cache

## Deviations from Plan

- Plan referenced Clerk `UserButton` and `useUser()` — replaced with Supabase sign-out button and server-side prop drilling
- No `Settings` nav link for admin yet (deferred — no settings page planned until later phases)
