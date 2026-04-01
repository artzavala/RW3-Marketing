# Project State — Client Intelligence Platform

**Last Updated:** 2026-04-01
**Milestone:** v1
**Status:** In Progress — Phase 1 active (3/5 plans complete)

---

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
| 1 | Foundation | 🔄 In Progress (3/5 plans complete) |
| 2 | Client & Services Management | 🔲 Pending |
| 3 | Google Sheets Import | 🔲 Pending |
| 4 | AI Scanning Engine | 🔲 Pending |
| 5 | Signals Dashboard | 🔲 Pending |
| 6 | Analytics & Trends | 🔲 Pending |
| 7 | Production Hardening | 🔲 Pending |

Progress: ███░░░░░░░░░░░░░░░░░ 15% (3/20 plans estimated)

---

## Current Work

**Phase 1, Plan 04** — Seed data / admin scaffold (next to execute)

---

## Completed Work

| Plan | Name | Completed | Commit |
|------|------|-----------|--------|
| 01-01 | Scaffold Next.js 16 app with dependencies | 2026-04-01 | 0f7b3e1 |
| 01-02 | Database schema and Drizzle ORM configuration | 2026-04-01 | 4787012 |
| 01-03 | Auth layer: Clerk middleware, pages, webhook, role utils | 2026-04-01 | 507d481 |

---

## Accumulated Decisions

| Decision | Rationale | Plan |
|----------|-----------|------|
| Scaffolded in /tmp due to RW-3 npm name restriction | Directory name has capital letters; workaround: scaffold to /tmp then rsync | 01-01 |
| .gitignore uses .env*.local not .env* | Allows .env.example to be committed as onboarding template | 01-01 |
| shadcn/ui New York style with neutral color + CSS variables | Standard defaults via -d flag | 01-01 |
| DATABASE_URL_UNPOOLED for drizzle.config.ts migrations | Neon connection pooler is incompatible with DDL operations | 01-02 |
| generatedAlwaysAsIdentity() for users.id PK | Modern Postgres 16 identity columns preferred over serial | 01-02 |
| ClerkProvider inside body tag (not wrapping html) | Required by Clerk Core 3 architecture | 01-03 |
| proxy.ts instead of middleware.ts | Next.js 16 renamed the middleware file | 01-03 |
| verifyWebhook from @clerk/nextjs/server | Abstracts svix webhook verification cleanly | 01-03 |
| Role defaults to 'rep' when public_metadata.role absent | Safe default for new Clerk users | 01-03 |

---

## Blockers / Concerns

- `.env.local` has placeholder values — real Clerk keys (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, CLERK_WEBHOOK_SECRET) and Neon DATABASE_URL needed before auth/database plans can be tested end-to-end

---

## Session Continuity

**Last session:** 2026-04-01T04:26:38Z
**Stopped at:** Completed 01-03-PLAN.md
**Resume file:** None

---

## Notes

- Project initialized from approved plan
- Google Sheets replaces HubSpot for v1 client import
- Single daily cron for all clients (not per-client schedules)
- Two roles: Admin + Client Service Rep
