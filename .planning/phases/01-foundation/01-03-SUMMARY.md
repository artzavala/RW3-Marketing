---
phase: 01-foundation
plan: "03"
subsystem: auth
tags: [clerk, nextjs, middleware, webhooks, drizzle, roles, jwt]

# Dependency graph
requires:
  - phase: 01-02
    provides: Drizzle schema with users table and clerkId field

provides:
  - Clerk middleware (proxy.ts) protecting all non-public routes
  - Role-based redirect for /admin routes
  - ClerkProvider in root layout
  - Sign-in and sign-up catch-all pages
  - Webhook handler syncing Clerk user events to users table
  - checkRole() utility reading role from JWT session claims
  - Roles type and CustomJwtSessionClaims global type augmentation

affects: [02-client-services, 04-ai-scanning, 05-signals-dashboard, 07-production-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Clerk Core 3: ClerkProvider inside body (not wrapping html)"
    - "Next.js 16: middleware renamed to proxy.ts in src/"
    - "Role enforcement via JWT session claims metadata.role"
    - "Clerk webhook verification via verifyWebhook from @clerk/nextjs/server"
    - "User upsert pattern: onConflictDoUpdate on clerkId"

key-files:
  created:
    - src/proxy.ts
    - src/app/(auth)/sign-in/[[...sign-in]]/page.tsx
    - src/app/(auth)/sign-up/[[...sign-up]]/page.tsx
    - src/app/api/webhooks/clerk/route.ts
    - src/lib/roles.ts
    - src/types/globals.d.ts
  modified:
    - src/app/layout.tsx

key-decisions:
  - "ClerkProvider placed inside body tag per Core 3 requirement (not wrapping html)"
  - "proxy.ts used instead of middleware.ts per Next.js 16 convention"
  - "verifyWebhook used for webhook signature verification (not svix directly)"
  - "Role defaults to 'rep' when not set in Clerk public_metadata"

patterns-established:
  - "Auth pages: catch-all routes under (auth) route group"
  - "Role check: checkRole() async helper returning boolean"
  - "Webhook upsert: onConflictDoUpdate on clerkId for idempotent sync"

# Metrics
duration: 11min
completed: 2026-04-01
---

# Phase 1 Plan 03: Auth Layer Summary

**Clerk Core 3 auth with proxy.ts middleware, role-based route protection, user webhook sync to Neon via Drizzle upsert, and checkRole() utility**

## Performance

- **Duration:** 11 min
- **Started:** 2026-04-01T04:15:15Z
- **Completed:** 2026-04-01T04:26:38Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Clerk middleware in proxy.ts protects all routes except /sign-in, /sign-up, and /api/webhooks
- Admin route guard redirects non-admin users to /rep via session claims check
- ClerkProvider wraps app content inside body (Core 3 pattern)
- Webhook handler upserts users to Neon database on create/update, deletes on user.deleted
- checkRole() utility enables server-side role authorization throughout the app

## Task Commits

Each task was committed atomically:

1. **Task 1: Create proxy.ts, ClerkProvider layout, auth pages, and role utils** - `6f588f1` (feat)
2. **Task 2: Create Clerk webhook handler for user sync** - `507d481` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/proxy.ts` - Clerk middleware with public route allow-list and admin role redirect
- `src/app/layout.tsx` - Root layout updated with ClerkProvider inside body
- `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx` - Sign-in catch-all page
- `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx` - Sign-up catch-all page
- `src/app/api/webhooks/clerk/route.ts` - POST handler syncing Clerk events to users table
- `src/lib/roles.ts` - checkRole() async utility reading from session claims
- `src/types/globals.d.ts` - Roles type and CustomJwtSessionClaims global augmentation

## Decisions Made

- ClerkProvider placed inside `<body>` not wrapping `<html>` — required by Clerk Core 3
- proxy.ts used instead of middleware.ts — Next.js 16 renamed the file
- verifyWebhook imported from @clerk/nextjs/server — abstracts svix verification
- Role defaults to 'rep' when public_metadata.role is absent — safe default for new users

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - both tasks executed cleanly. Plan 02 db artifacts (src/db/index.ts, src/db/schema.ts) were already present from wave 2 parallel execution.

## User Setup Required

None - no external service configuration required in this plan. (Clerk API keys and webhook secret must be set in .env.local before end-to-end auth works — tracked in STATE.md blockers from Plan 01.)

## Next Phase Readiness

- Auth infrastructure complete: routing protection, sign-in/up pages, webhook sync, role utilities all in place
- Remaining blocker: real Clerk keys and CLERK_WEBHOOK_SECRET must be added to .env.local before testing
- Plans 04 (seed data) and 05 (admin dashboard) can now build on top of authenticated routes and checkRole()

---
*Phase: 01-foundation*
*Completed: 2026-04-01*
