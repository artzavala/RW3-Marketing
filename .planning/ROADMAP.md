# Roadmap — Client Intelligence Platform

## Phase 1 — Foundation

**Goal:** Running app with role-based auth, database, and navigation shell

**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05

**Stack:** Next.js 16 + Supabase (Auth + Postgres) + shadcn/ui

**Plans:** 5 plans

Plans:
- [x] 01-01-PLAN.md — Scaffold Next.js 16 app, install deps, configure shadcn/ui
- [x] 01-02-PLAN.md — Database layer (Supabase client utils, profiles table migration)
- [x] 01-03-PLAN.md — Auth layer (proxy.ts with @supabase/ssr, sign-in/up pages, role utils)
- [ ] 01-04-PLAN.md — Manual setup (Supabase project provisioning, run migration, create admin user)
- [x] 01-05-PLAN.md — Navigation shell with role-aware sidebar and landing pages

**Deliverables:**
- Next.js 16 app scaffolded and deployed to Vercel
- Supabase auth integrated (email/password login, session persistence, logout)
- `profiles` table with role enum: `admin` | `rep`
- Supabase Postgres connected, migration applied
- Auto-profile creation via Postgres trigger on auth.users insert
- Navigation shell with role-aware routing
- Admin and Rep landing pages (empty states)

---

## Phase 2 — Client & Services Management ✓

**Goal:** Admins manage clients and service packages; reps see assigned clients; package assignment works

**Requirements:** CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, SVC-01, SVC-02, SVC-03, SVC-04, SVC-05

**Completed:** 2026-04-01

**Plans:** 5 plans

Plans:
- [x] 02-01-PLAN.md — Database migration (clients, service_packages, client_services) + shadcn installs + sidebar nav
- [x] 02-02-PLAN.md — Service packages admin CRUD (list, add, edit, delete)
- [x] 02-03-PLAN.md — Client list page and CRUD actions (admin)
- [x] 02-04-PLAN.md — Client detail page with edit, rep assignment, and service assignment
- [x] 02-05-PLAN.md — Rep client list and detail pages (read-only)

**Deliverables:**
- `clients` table and CRUD (admin only for write, role-scoped for read)
- `service_packages` table and CRUD (admin only)
- `client_services` junction table
- Client list page (role-scoped)
- Client detail page (basic info + service assignment UI)
- Admin: assign/reassign rep on client

---

## Phase 3 — Google Sheets Import

**Goal:** Admin configures a Sheet URL; system syncs client rows into the database

**Requirements:** GS-01, GS-02, GS-03, GS-04

**Plans:** 3 plans

Plans:
- [ ] 03-01-PLAN.md — Database migration (sheets_config table, sheets_row_id on clients) + Google Sheets API client utility
- [ ] 03-02-PLAN.md — Sync logic server actions (save settings, sync from sheet with upsert + rep resolution)
- [ ] 03-03-PLAN.md — Admin settings page UI (save/sync forms, status display, sidebar nav link)

**Deliverables:**
- `sheets_config` table
- Google Sheets API v4 integration (service account)
- Admin settings page: enter Sheet URL + tab name
- Manual sync trigger (server action)
- Upsert logic: match by `sheets_row_id`, create or update clients
- Rep email → `users.email` resolution for `assigned_rep_id`
- Sync status display (last synced, rows imported)

---

## Phase 4 — AI Scanning Engine

**Goal:** Daily cron + manual scan trigger; Serper.dev search + Gemini analysis pipeline

**Requirements:** SCN-01, SCN-02, SCN-03, SCN-04, SCN-05

**Deliverables:**
- `scan_runs` and `signals` tables
- Serper.dev integration: search `"{clientName}" news` (last 30 days, top 10)
- Gemini Flash analysis via Vercel AI Gateway: summary + score + signal_type + opportunity flag
- Deduplication by `source_url`
- `/api/cron/scan` endpoint (vercel.json cron: `0 6 * * *`)
- Manual "scan now" button on client detail page
- `scan_runs` record created/updated per run

---

## Phase 5 — Signals Dashboard

**Goal:** Full signal feed (role-scoped), filtering, status workflow, notes

**Requirements:** SIG-01, SIG-02, SIG-03, SIG-04, SIG-05

**Deliverables:**
- `signal_actions` table
- Global signals feed (admin) and scoped feed (rep)
- Filter bar: client, score, signal_type, status
- Signal card: headline, source, summary, score badge, signal type tag, status
- Status workflow actions: Reviewed / Actioned / Dismissed
- Note input on Actioned / Dismissed
- `signal_actions` records created on status change

---

## Phase 6 — Analytics & Trends

**Goal:** Client score trend charts and aggregate stats

**Requirements:** ANL-01, ANL-02

**Deliverables:**
- Score trend chart on client detail page (last 90 days, shadcn/ui Recharts)
- Aggregate signal volume by week on dashboard
- Data queries optimized for chart rendering

---

## Phase 7 — Production Hardening

**Goal:** Error handling, loading/empty states, rate limiting, deploy to prod

**Deliverables:**
- Loading skeletons on all data-fetching views
- Empty states for zero clients, zero signals
- Error boundaries and user-facing error messages
- Rate limiting on scan endpoint (prevent abuse)
- Cron secret verification (`CRON_SECRET` header)
- Environment variables documented
- Production deployment verified

---

## Requirement Coverage

| Req ID | Phase |
|--------|-------|
| AUTH-01–05 | Phase 1 |
| CLI-01–05 | Phase 2 |
| SVC-01–05 | Phase 2 |
| GS-01–04 | Phase 3 |
| SCN-01–05 | Phase 4 |
| SIG-01–05 | Phase 5 |
| ANL-01–02 | Phase 6 |
