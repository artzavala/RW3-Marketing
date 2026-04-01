---
phase: 01-foundation
plan: 02
subsystem: database
tags: [drizzle-orm, neon, postgres, drizzle-kit, schema]

# Dependency graph
requires:
  - phase: 01-01
    provides: Next.js 16 scaffold with drizzle-orm and @neondatabase/serverless installed
provides:
  - Drizzle schema with users table and role enum (admin | rep)
  - Neon HTTP database client exported as db
  - drizzle-kit migration config using unpooled connection URL
  - npm scripts for generate, migrate, push, studio
affects:
  - 01-03 (auth webhooks write to users table)
  - 02 (client/services management queries users)
  - all phases that need to query or mutate users

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Drizzle ORM with Neon HTTP driver for serverless Postgres"
    - "DATABASE_URL_UNPOOLED for DDL migrations, DATABASE_URL for runtime queries"

key-files:
  created:
    - src/db/schema.ts
    - src/db/index.ts
    - drizzle.config.ts
  modified:
    - package.json

key-decisions:
  - "Use DATABASE_URL_UNPOOLED in drizzle.config.ts — Neon pooler is incompatible with DDL operations"
  - "generatedAlwaysAsIdentity for PK — avoids serial type, aligns with Postgres 16 identity columns"

patterns-established:
  - "All DB access via src/db/index.ts db export"
  - "Schema defined in src/db/schema.ts, migrations output to drizzle/"

# Metrics
duration: 1min
completed: 2026-04-01
---

# Phase 1 Plan 02: Database Schema Summary

**Drizzle ORM with Neon HTTP driver, users table with pgEnum role (admin | rep), and drizzle-kit migration config using unpooled URL**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-04-01T04:14:34Z
- **Completed:** 2026-04-01T04:15:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Users table schema with id (identity PK), clerkId (unique), email, name, role enum, createdAt
- Database client using Neon HTTP driver, exports `db` with schema for type-safe queries
- drizzle.config.ts wired to DATABASE_URL_UNPOOLED preventing DDL errors on pooled connections
- db:generate, db:migrate, db:push, db:studio npm scripts ready for use

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Drizzle schema with users table and role enum** - `9aab32f` (feat)
2. **Task 2: Create database client, drizzle config, and npm scripts** - `4787012` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/db/schema.ts` - pgEnum role, users table definition
- `src/db/index.ts` - Neon HTTP driver, drizzle client, exports db
- `drizzle.config.ts` - Migration config pointing at DATABASE_URL_UNPOOLED
- `package.json` - Added db:generate, db:migrate, db:push, db:studio scripts

## Decisions Made
- Used `DATABASE_URL_UNPOOLED` in drizzle.config.ts — the Neon connection pooler does not support DDL statements, so migrations must use the direct (unpooled) URL.
- Used `generatedAlwaysAsIdentity()` for the primary key — this is the modern Postgres 16 identity column syntax, preferred over `serial`.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required beyond what was documented in 01-01. DATABASE_URL and DATABASE_URL_UNPOOLED placeholders already exist in .env.local from Plan 01.

## Next Phase Readiness
- Database layer is complete and ready for Plan 03 (Clerk auth webhooks)
- Plan 03 will import `db` and `users` from src/db/index.ts and src/db/schema.ts
- Actual database connection requires real Neon credentials in .env.local before end-to-end testing

---
*Phase: 01-foundation*
*Completed: 2026-04-01*
