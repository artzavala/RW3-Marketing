# Client Intelligence Platform

## What This Is

An internal web app for a marketing agency that monitors news about clients daily using AI, scores signals as opportunities or risks, maps them to the agency's service packages, and presents findings to the right people. Admins see all clients; client service reps see only their assigned accounts. Client data is imported from Google Sheets.

## Core Value

Account managers always know when a client situation creates an opportunity to grow revenue or risk losing existing services — before the competitor does.

## Active Requirements (v1)

- Role-based auth: Admin (all clients) + Client Service Rep (assigned clients only)
- Client management (add/remove, assign to a rep, link to Google Sheet row)
- Google Sheets import: sync client list from a designated spreadsheet
- Services knowledge base (packages with names + descriptions)
- Per-client service assignment (using / not using each package)
- Global daily scan (all clients, runs once per day via cron)
- Manual "scan now" trigger per client (ad-hoc)
- Web news search via Serper.dev for each client (last 30 days)
- Gemini AI analysis: news summary + opportunity/risk score (1–5) + signal type
- Signal type tagging: Leadership Change, Funding/M&A, Campaign/Award, Bad Press
- Signal dashboard: reps see their clients, admins see all
- Signal status workflow: New → Reviewed → Actioned / Dismissed
- Note on signal action (free text)
- In-app trend charts: signal score history per client over time
- Aggregate dashboard stats: signal volume by week

## Out of Scope (v1)

- HubSpot integration (deferred to v2 after Google Sheets test)
- External notifications (Slack, email) — dashboard-only
- Client portal / external access
- Competitor tracking
- AI-drafted outreach emails
- Mobile app

## Constraints

- Tech: Vercel deployment, Supabase (Auth + Postgres)
- AI: Google-primary (Gemini via Vercel AI Gateway)
- Data import: Google Sheets (not direct CRM)
- Users: Internal team only, two roles

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 16 (App Router) | SSR, server actions, cron-friendly |
| UI | shadcn/ui + Tailwind + Geist | Consistent, fast to build |
| Deployment | Vercel | Native cron, edge functions, zero ops |
| Database | Supabase Postgres | Auth + DB in one, RLS, triggers |
| Auth | Supabase Auth (@supabase/ssr) | Email/password, session via cookies |
| AI Analysis | Vercel AI Gateway → Gemini 1.5 Flash | Google-primary, cost tracking, failover |
| Web Search | Serper.dev (Google Search API) | Best Google news results for agents |
| Scheduling | Vercel Cron Jobs | Native daily cron, no extra infra |
| Client Import | Google Sheets API v4 | Import/sync client list from a Sheet |
| Charts | shadcn/ui charts (Recharts) | In-app trend history |
| AI SDK | Vercel AI SDK v6 | Standard, AI Gateway integration |

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Google Sheets over HubSpot | Lower friction for testing; HubSpot integration planned for v2 |
| Single daily cron (all clients) | Simpler than per-client schedules; ad-hoc scan fills gap |
| Serper.dev for search | Best Google news results, simple API, affordable |
| Gemini Flash for batch | Cost-effective for scanning many clients on a schedule |
| Dashboard-only notifications | Keeps v1 scope tight; add Slack/email in v2 |

## Database Schema

```sql
users (id, clerk_id, email, name, role ENUM('admin','rep'), created_at)

clients (id, name, website, assigned_rep_id FK users,
         sheets_row_id TEXT, created_at, updated_at)

service_packages (id, name, description, created_at)
client_services (client_id, package_id, assigned_at)  -- junction

scan_runs (id, triggered_by ENUM('cron','manual'), started_at,
           completed_at, clients_scanned INT, status)

signals (id, client_id FK clients, headline, source_url, published_at,
         summary TEXT, score INT, signal_type ENUM, status ENUM,
         scan_run_id FK scan_runs, created_at)

signal_actions (id, signal_id FK signals, user_id FK users,
                action ENUM('reviewed','actioned','dismissed'),
                note TEXT, created_at)

sheets_config (id, sheet_url, sheet_tab, last_synced_at, created_at)
```
