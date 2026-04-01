# Project State — Client Intelligence Platform

**Last Updated:** 2026-04-01
**Milestone:** v1
**Status:** In Progress — Phase 2 active (1/4 plans complete)

---

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
| 1 | Foundation | Complete |
| 2 | Client & Services Management | In Progress (1/4 plans complete) |
| 3 | Google Sheets Import | Pending |
| 4 | AI Scanning Engine | Pending |
| 5 | Signals Dashboard | Pending |
| 6 | Analytics & Trends | Pending |
| 7 | Production Hardening | Pending |

Progress: ████░░░░░░░░░░░░░░░░ 20% (4/20 plans estimated)

---

## Current Work

**Phase 2, Plan 02-02** — Clients CRUD pages

---

## Completed Work

| Plan | Name | Completed | Commit |
|------|------|-----------|--------|
| 01-01 | Scaffold Next.js 16 app with dependencies | 2026-04-01 | 0f7b3e1 |
| 01-02 | Database layer: Supabase client utils + profiles migration | 2026-04-01 | (pending commit) |
| 01-03 | Auth layer: proxy.ts with @supabase/ssr, sign-in/up pages, role utils | 2026-04-01 | (pending commit) |
| 02-01 | Database migration + shadcn installs + sidebar nav | 2026-04-01 | 30bff30 |

---

## Accumulated Decisions

| Decision | Rationale | Plan |
|----------|-----------|------|
| Scaffolded in /tmp due to RW-3 npm name restriction | Directory name has capital letters; workaround: scaffold to /tmp then rsync | 01-01 |
| .gitignore uses .env*.local not .env* | Allows .env.example to be committed as onboarding template | 01-01 |
| shadcn/ui New York style with neutral color + CSS variables | Standard defaults via -d flag | 01-01 |
| proxy.ts instead of middleware.ts | Next.js 16 renamed the middleware file | 01-03 |
| Switched from Clerk+Neon to full Supabase stack | User preference for unified Auth+DB; no external services had been provisioned yet | 01-02/03 |
| Supabase Auth with @supabase/ssr | Cookie-based sessions, SSR-compatible, no provider wrapper needed | 01-03 |
| profiles table with Postgres trigger on auth.users insert | No webhook needed; trigger auto-creates profile row on signup | 01-02 |
| Role stored in profiles.role enum column | FK to auth.users.id, populated via trigger from raw_user_meta_data | 01-02 |
| Supabase client utils split into server.ts / client.ts / admin.ts | Separates anon key (user session) from service role (admin ops) | 01-02 |
| No Drizzle ORM — using Supabase JS client directly | Cleaner integration with RLS and Supabase Auth; Drizzle removed | 01-02 |
| form.tsx written manually | base-nova shadcn registry has no form component; CLI silently skips it | 02-01 |

---

## Blockers / Concerns

- Migration `0001_create_profiles.sql` must be run in Supabase dashboard (SQL editor) before auth will work
- Migration `0002_create_clients_services.sql` must be run in Supabase dashboard before Phase 2 CRUD will work
- Need to create first admin user manually in Supabase dashboard with `role: admin` in user metadata

---

## Session Continuity

**Last session:** 2026-04-01
**Stopped at:** Completed 02-01 — Database migration + shadcn installs + sidebar nav
**Resume file:** None

---

## Notes

- Project initialized from approved plan
- Google Sheets replaces HubSpot for v1 client import
- Single daily cron for all clients (not per-client schedules)
- Two roles: Admin + Client Service Rep
- Supabase project: RW3-Marketing2026 (ref: kzwftaroausfajejaqfg)
