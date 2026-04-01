# Phase 1: Foundation - Research

**Researched:** 2026-03-31
**Domain:** Next.js 16 + Clerk (Core 3) + Neon Postgres + shadcn/ui
**Confidence:** HIGH

---

## Summary

This phase scaffolds a Next.js 16 App Router application with role-based authentication (Clerk), a Neon Postgres database (via Vercel Marketplace), and a navigation shell powered by shadcn/ui. All of these are well-documented, actively maintained, and have strong integration stories together.

Three simultaneous major versions are in play as of March 2026: Next.js 16 (renamed `middleware.ts` to `proxy.ts`, fully async request APIs), Clerk Core 3 / `@clerk/nextjs` v7 (async `auth()`, `clerkMiddleware()` replaces `authMiddleware()`, `ClerkProvider` placement change), and shadcn/ui CLI v4 (new template-based init). Each has breaking changes from what most online tutorials show — use the patterns documented here, not older blog posts.

Drizzle ORM with the Neon serverless HTTP driver is the standard pairing for Neon on Vercel. Role enforcement is best done via Clerk `publicMetadata` embedded in the session JWT — this avoids a database roundtrip on every request.

**Primary recommendation:** Scaffold with `create-next-app@latest`, install shadcn/ui via `shadcn@latest init -t next`, wire Clerk into `proxy.ts` using `clerkMiddleware()`, provision Neon via the Vercel Marketplace integration (auto-injects `DATABASE_URL`), define schema with Drizzle, and sync users via a Clerk webhook route at `/api/webhooks/clerk`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.x (latest) | Framework | Required by project spec; Turbopack default, App Router |
| `@clerk/nextjs` | v7+ (Core 3, March 2026) | Auth UI, client hooks, server auth, webhooks | Official Clerk Next.js SDK; single package covers all auth needs in Core 3 |
| `drizzle-orm` | latest | Type-safe ORM | Standard Neon/serverless pairing; no connection pool overhead |
| `@neondatabase/serverless` | latest | Neon HTTP driver | Required for serverless/edge environments on Vercel |
| `drizzle-kit` | latest (devDep) | Schema generation + migrations | Pairs with drizzle-orm |

**Note on `@clerk/backend`:** In Clerk Core 3, `@clerk/nextjs` re-exports everything including `verifyWebhook`. No separate `@clerk/backend` install required.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `shadcn/ui` (CLI) | v4 (March 2026) | Component scaffolding | Use `shadcn@latest init -t next` |
| Tailwind CSS | v4 (bundled by shadcn) | Styling | Auto-configured by shadcn init |
| `next/font/google` (Geist) | built-in | Typography | Already bundled in Next.js; use `Geist` and `Geist_Mono` |
| `tsx` | latest (devDep) | Run migration scripts | Used to execute `src/db/migrate.ts` |
| `dotenv` | latest | Load `.env` in migration scripts | Needed when running drizzle-kit outside Next.js context |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `drizzle-orm` | Prisma | Prisma uses a long-running query engine process — incompatible with Vercel serverless without a connection pooler add-on |
| `drizzle-orm` | raw `pg` / `postgres.js` | No type safety, no migration tooling |
| `@neondatabase/serverless` | `pg` node driver | `pg` opens persistent TCP connections — will exhaust Neon's connection limit at scale |

### Installation

```bash
# Step 1: Scaffold Next.js 16
npx create-next-app@latest client-intelligence --typescript --tailwind --eslint --app --src-dir

# Step 2: Install Clerk (Core 3 — single package)
npm install @clerk/nextjs

# Step 3: Install Drizzle + Neon driver
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit tsx dotenv

# Step 4: Install shadcn/ui (run from project root)
npx shadcn@latest init -t next
# Follow prompts; chooses "New York" style and zinc color by default.
# Accepts all defaults — this configures components.json, Tailwind, and CSS vars.

# Step 5: Add sidebar component
npx shadcn@latest add sidebar button avatar dropdown-menu
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── sign-in/[[...sign-in]]/page.tsx   # Clerk hosted sign-in
│   │   └── sign-up/[[...sign-up]]/page.tsx   # Clerk hosted sign-up (optional)
│   ├── (dashboard)/
│   │   ├── layout.tsx                         # SidebarProvider + AppSidebar wrapper
│   │   ├── admin/
│   │   │   └── page.tsx                       # Admin landing (empty state)
│   │   └── rep/
│   │       └── page.tsx                       # Rep landing (empty state)
│   ├── api/
│   │   └── webhooks/
│   │       └── clerk/
│   │           └── route.ts                   # Clerk user sync webhook
│   └── layout.tsx                             # Root layout with ClerkProvider
├── components/
│   ├── ui/                                    # shadcn/ui output (auto-generated)
│   └── app-sidebar.tsx                        # Role-aware sidebar
├── db/
│   ├── index.ts                               # Drizzle client
│   ├── schema.ts                              # Table + enum definitions
│   └── migrate.ts                             # Migration runner script
├── lib/
│   └── roles.ts                               # checkRole() server utility
├── types/
│   └── globals.d.ts                           # Clerk CustomJwtSessionClaims type
└── proxy.ts                                   # clerkMiddleware (project root or src/)
drizzle/                                       # Generated migration files (gitcommit)
drizzle.config.ts                              # Drizzle Kit config
```

### Pattern 1: proxy.ts with clerkMiddleware + Role Guards

**What:** Single proxy file that (a) requires authentication on all non-public routes and (b) redirects non-admins away from `/admin/*`.

**When to use:** Always in Next.js 16; this replaces `middleware.ts`.

```typescript
// src/proxy.ts  (or proxy.ts at project root)
// Source: https://clerk.com/docs/reference/nextjs/clerk-middleware
//         https://clerk.com/docs/guides/secure/basic-rbac
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/(.*)',   // webhook must be publicly reachable
])

const isAdminRoute = createRouteMatcher(['/admin(.*)'])

export default clerkMiddleware(async (auth, req) => {
  // Allow webhook and auth pages through unauthenticated
  if (isPublicRoute(req)) return

  // Require authentication for all other routes (Core 3: auth.protect() not auth().protect())
  await auth.protect()

  // Admin-only guard: redirect non-admins
  if (
    isAdminRoute(req) &&
    (await auth()).sessionClaims?.metadata?.role !== 'admin'
  ) {
    return NextResponse.redirect(new URL('/rep', req.url))
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
```

**Critical detail:** The exported function must be a default export in Next.js 16. The Clerk helper `clerkMiddleware` wraps it, so the default export from Clerk IS the proxy — this is fine. In Core 3, `auth.protect()` is called directly as a method on the `auth` parameter, not on the return value of `auth()`.

### Pattern 2: Session Token Customization for Roles

**What:** Embed `publicMetadata` in the Clerk JWT so the proxy can read it without a database call.

**Setup (Clerk Dashboard only — no code):**
1. Clerk Dashboard → Configure → Sessions → Customize session token
2. Add to Claims editor:
```json
{
  "metadata": "{{user.public_metadata}}"
}
```

**TypeScript declaration (`src/types/globals.d.ts`):**
```typescript
// Source: https://clerk.com/docs/guides/secure/basic-rbac
export type Roles = 'admin' | 'rep'

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      role?: Roles
    }
  }
}
```

**Server utility (`src/lib/roles.ts`):**
```typescript
import { auth } from '@clerk/nextjs/server'
import type { Roles } from '@/types/globals'

export async function checkRole(role: Roles): Promise<boolean> {
  const { sessionClaims } = await auth()
  return sessionClaims?.metadata?.role === role
}
```

### Pattern 3: Clerk Webhook for User Sync

**What:** Route handler that verifies Clerk webhook signatures and upserts user records into Neon.

**When to use:** Required to keep the `users` table in sync with Clerk.

```typescript
// src/app/api/webhooks/clerk/route.ts
// Source: https://clerk.com/docs/reference/backend/verify-webhook
// In Core 3, verifyWebhook is exported from @clerk/nextjs/server
import { verifyWebhook } from '@clerk/nextjs/server'
import type { NextRequest } from 'next/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  try {
    const evt = await verifyWebhook(req)

    if (evt.type === 'user.created' || evt.type === 'user.updated') {
      const { id, email_addresses, first_name, last_name, public_metadata } = evt.data
      const email = email_addresses[0]?.email_address ?? ''
      const name = [first_name, last_name].filter(Boolean).join(' ')
      const role = (public_metadata?.role as 'admin' | 'rep') ?? 'rep'

      await db
        .insert(users)
        .values({ clerkId: id, email, name, role })
        .onConflictDoUpdate({
          target: users.clerkId,
          set: { email, name, role },
        })
    }

    if (evt.type === 'user.deleted') {
      await db.delete(users).where(eq(users.clerkId, evt.data.id!))
    }

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response('Webhook verification failed', { status: 400 })
  }
}
```

**Environment variable required:** `CLERK_WEBHOOK_SIGNING_SECRET` (obtained from Clerk Dashboard → Webhooks → your endpoint → Signing Secret).

**Fallback:** If `verifyWebhook` is not available from `@clerk/nextjs/server` at install time, import from `@clerk/backend/webhooks` instead. Check package exports with `node -e "console.log(require('@clerk/nextjs/server'))"` after install.

### Pattern 4: Drizzle Schema with pgEnum

```typescript
// src/db/schema.ts
// Source: https://orm.drizzle.team/docs/sql-schema-declaration
import {
  pgTable,
  pgEnum,
  varchar,
  timestamp,
  integer,
} from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('role', ['admin', 'rep'])

export const users = pgTable('users', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  clerkId: varchar('clerk_id', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  role: roleEnum('role').notNull().default('rep'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
```

```typescript
// src/db/index.ts
import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql)
```

```typescript
// drizzle.config.ts
import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED!, // Use direct (non-pooled) for migrations
  },
})
```

**Important:** Use `DATABASE_URL_UNPOOLED` (direct connection) for `drizzle-kit migrate`. Use `DATABASE_URL` (pooled) in the app's `db/index.ts`.

### Pattern 5: Role-Aware Navigation Shell

**What:** Server Component layout that reads the current user's role and filters nav items before rendering.

```typescript
// src/components/app-sidebar.tsx
import { auth } from '@clerk/nextjs/server'
import { SidebarContent, SidebarGroup, SidebarMenu, SidebarMenuItem } from '@/components/ui/sidebar'

const adminNav = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/clients', label: 'Clients' },
]

const repNav = [
  { href: '/rep', label: 'My Clients' },
]

export async function AppSidebar() {
  const { sessionClaims } = await auth()
  const role = sessionClaims?.metadata?.role
  const navItems = role === 'admin' ? adminNav : repNav

  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <a href={item.href}>{item.label}</a>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
    </SidebarContent>
  )
}
```

```typescript
// src/app/(dashboard)/layout.tsx
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1">
        <SidebarTrigger />
        {children}
      </main>
    </SidebarProvider>
  )
}
```

### Anti-Patterns to Avoid

- **Synchronous cookies()/headers() in Next.js 16:** Will throw at runtime. Always `await cookies()`, `await headers()`, `await params`. This is a hard breaking change in v16.
- **Checking roles only on the client:** `publicMetadata` is readable client-side but can be spoofed via devtools. Enforce in `proxy.ts` and in Server Components.
- **Using `DATABASE_URL` (pooled) for drizzle-kit migrate:** Neon's pooled connection string doesn't support all Postgres features needed by migrations. Use `DATABASE_URL_UNPOOLED` for migration scripts.
- **Protecting the webhook route in clerkMiddleware:** The `/api/webhooks/clerk` route must be public — Clerk's servers have no session cookie. Add it to `isPublicRoute`.
- **Using `middleware.ts` in Next.js 16:** Still works (deprecated) but will be removed in a future version. Start with `proxy.ts`.
- **Wrapping `<html>` with `<ClerkProvider>` (Clerk Core 3 change):** In Core 3, `<ClerkProvider>` must be placed inside `<body>`, not wrapping the entire `<html>` element. See Root Layout example below.
- **Using `authMiddleware()` (removed in Core 3):** This was the old Clerk middleware helper. In Core 3, only `clerkMiddleware()` is supported.
- **Calling `auth()` synchronously (Clerk Core 3):** `auth()` is always async in Core 3. Always `await auth()`. Same applies to `currentUser()` and `clerkClient()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webhook signature verification | Custom HMAC-SHA256 | `verifyWebhook()` from `@clerk/nextjs/server` | Handles replay attack prevention, timing safety, and header parsing |
| Session JWT parsing | Custom JWT decode | `auth()` from `@clerk/nextjs/server` | Handles key rotation, caching, clock skew |
| Role checking logic | Custom DB lookup per request | Session claims via `sessionClaims?.metadata?.role` | Embedded in JWT — zero DB roundtrip |
| Database migrations | Raw `ALTER TABLE` SQL | `drizzle-kit generate` + `drizzle-kit migrate` | Type-safe, tracked, reversible |
| Collapsible sidebar | Custom CSS/state | `shadcn/ui sidebar` component | Handles mobile sheet, keyboard shortcuts, cookie persistence |
| Sign-in page UI | Custom form | Clerk `<SignIn />` component or `/sign-in/[[...sign-in]]` | MFA, social login, account lockout all handled |

**Key insight:** Clerk's session token mechanism (via customized JWT claims) means role data is available in the proxy without any database query — this is the correct pattern for this scale.

---

## Common Pitfalls

### Pitfall 1: Async Request APIs (Next.js 16 Breaking Change)

**What goes wrong:** Code that does `const cookieStore = cookies()` (synchronous) throws a runtime error in Next.js 16 because synchronous access is fully removed (not just deprecated).

**Why it happens:** Next.js 15 added async versions with deprecation warnings; Next.js 16 removes the sync versions entirely.

**How to avoid:** Always write `const cookieStore = await cookies()`. Same applies to `headers()`, `draftMode()`, route `params`, and page `searchParams`.

**Warning signs:** `TypeError: cookies() should be called with await` in dev console.

### Pitfall 2: Webhook Route Must Be Public

**What goes wrong:** Clerk webhook deliveries to `/api/webhooks/clerk` return 401 because `clerkMiddleware` requires auth.

**Why it happens:** The route is matched by the API matcher in `proxy.ts`, but Clerk's servers send requests without a session cookie.

**How to avoid:** Add `/api/webhooks/(.*)` to `isPublicRoute` in `proxy.ts`. The `verifyWebhook()` call provides security instead.

**Warning signs:** Clerk Dashboard shows webhook delivery failures with status 401 or 403.

### Pitfall 3: Session Claims Not Populated Until After Login

**What goes wrong:** A user who existed before you added the session token customization in the Clerk Dashboard has no `metadata` in their session claims — the role check returns `undefined`.

**Why it happens:** Session tokens are generated at sign-in time. Existing sessions (from before the customization) don't include the new claims until the user signs in again.

**How to avoid:** After setting up the session token customization, require existing users to sign in again (or issue a fresh session). In development, just sign out and back in.

**Warning signs:** `sessionClaims?.metadata?.role` is `undefined` even for users you've assigned a role to.

### Pitfall 4: Migration Connection String Mismatch

**What goes wrong:** `drizzle-kit migrate` fails with `prepared statement already exists` or SSL errors when pointed at the pooled `DATABASE_URL`.

**Why it happens:** Neon's connection pooler (PgBouncer in transaction mode) doesn't support prepared statements used by migration tooling.

**How to avoid:** Always set `dbCredentials.url` in `drizzle.config.ts` to `DATABASE_URL_UNPOOLED`. The Vercel Marketplace integration injects both variables.

**Warning signs:** Migration command exits with a Postgres error mentioning prepared statements or `ERROR: prepared statement "s0" already exists`.

### Pitfall 5: `publicMetadata.role` Not Set On Newly Created Users

**What goes wrong:** New users sign up via Clerk but have no role, so they can't access any dashboard routes.

**Why it happens:** Clerk doesn't auto-assign `publicMetadata.role`; it must be set via the Clerk Dashboard, the Clerk API, or an onboarding flow.

**How to avoid for v1 (internal team only):** Manually set `role` in Clerk Dashboard for each user. Or create a simple admin script using the Clerk Backend API to bulk-set roles. Default to `'rep'` in the schema so users have some access while waiting for role assignment.

**Warning signs:** Users land on a route they can access (proxy allows it) but the page shows wrong data because the role is `undefined`.

### Pitfall 6: Clerk Core 3 `ClerkProvider` Placement

**What goes wrong:** App throws a hydration error or caching error because `<ClerkProvider>` wraps `<html>` in the root layout.

**Why it happens:** Core 3 changed `<ClerkProvider>` to no longer force dynamic rendering, but it must be placed inside `<body>` when using Next.js cache components. Placing it outside `<html>` causes issues with the new caching model.

**How to avoid:** Place `<ClerkProvider>` as the first child of `<body>`, not wrapping `<html>`. See the Root Layout code example.

**Warning signs:** Build warnings about `ClerkProvider` and dynamic rendering; or hydration mismatches in the browser.

### Pitfall 7: Old Clerk Import Patterns From Pre-Core-3 Tutorials

**What goes wrong:** Code copied from tutorials uses `authMiddleware()`, synchronous `auth()`, or imports from `@clerk/clerk-sdk-node` — all removed or changed in Core 3.

**Why it happens:** Most tutorials online were written before March 2026 (Core 3 release).

**How to avoid:** Only use patterns from this document and the official Clerk docs. Run `npx @clerk/upgrade` to auto-migrate any legacy code. Key replacements: `authMiddleware` → `clerkMiddleware`, sync `auth()` → `await auth()`, `getAuth(req)` in route handlers → `await auth()`.

---

## Code Examples

Verified patterns from official sources:

### Complete proxy.ts with Clerk + Role Guard

```typescript
// src/proxy.ts
// Source: https://clerk.com/docs/reference/nextjs/clerk-middleware
//         https://nextjs.org/docs/app/getting-started/proxy
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/(.*)',
])

const isAdminRoute = createRouteMatcher(['/admin(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return

  await auth.protect()

  if (
    isAdminRoute(req) &&
    (await auth()).sessionClaims?.metadata?.role !== 'admin'
  ) {
    return NextResponse.redirect(new URL('/rep', req.url))
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
```

### Root Layout with ClerkProvider (Core 3 placement)

```typescript
// src/app/layout.tsx
// Core 3: ClerkProvider goes INSIDE <body>, not wrapping <html>
import { ClerkProvider } from '@clerk/nextjs'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ClerkProvider>
          {children}
        </ClerkProvider>
      </body>
    </html>
  )
}
```

### Sign-In Page

```typescript
// src/app/(auth)/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from '@clerk/nextjs'

export default function Page() {
  return <SignIn />
}
```

### Drizzle Migration Runner

```typescript
// src/db/migrate.ts
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import { migrate } from 'drizzle-orm/neon-http/migrator'

async function main() {
  const sql = neon(process.env.DATABASE_URL_UNPOOLED!)
  const db = drizzle(sql)
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log('Migrations complete')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

### package.json Scripts for DB

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/db/migrate.ts",
    "db:studio": "drizzle-kit studio"
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` | `proxy.ts` | Next.js 16 (Oct 2025) | File rename + function rename; logic identical |
| Sync `cookies()` | `await cookies()` | Next.js 15 (deprecated) → v16 (removed) | Must await all request APIs |
| `experimental.turbopack` | top-level `turbopack` | Next.js 16 | Config location changed |
| Webpack default | Turbopack default | Next.js 16 | Faster builds, no `--turbopack` flag needed |
| `serial()` primary key | `.generatedAlwaysAsIdentity()` | Drizzle 2025 | Better Postgres identity columns |
| Svix manual HMAC | `verifyWebhook()` from `@clerk/nextjs/server` | Clerk Core 3 (March 2026) | Single package, no separate svix install |
| `authMiddleware()` | `clerkMiddleware()` | Clerk Core 3 (March 2026) | Old API removed entirely |
| Sync `auth()` in Clerk | `await auth()` always async | Clerk Core 3 (March 2026) | Runtime error if called synchronously |
| `ClerkProvider` wrapping `<html>` | `ClerkProvider` inside `<body>` | Clerk Core 3 (March 2026) | Required placement change for Next.js cache components compat |

**Deprecated/outdated:**
- `serverRuntimeConfig` / `publicRuntimeConfig`: Removed in Next.js 16. Use `process.env` directly.
- `next lint` command: Removed in Next.js 16. Run ESLint directly.
- `images.domains`: Deprecated. Use `images.remotePatterns`.
- `next/legacy/image`: Deprecated. Use `next/image`.
- `authMiddleware()` from Clerk: Removed in Core 3. Use `clerkMiddleware()`.
- `@clerk/types` package: Deprecated in Core 3. Import types from SDK subpath exports.

---

## Open Questions

1. **Neon Marketplace auto-provisioning timing**
   - What we know: Vercel Marketplace integration injects `DATABASE_URL` and `DATABASE_URL_UNPOOLED` for production and development. Preview deployments get isolated branches.
   - What's unclear: Whether `db:migrate` needs to run as a Vercel build step or is handled manually on first deploy.
   - Recommendation: Add `npm run db:migrate` as part of the build command in Vercel project settings (e.g., `npm run build && npm run db:migrate`) to run migrations automatically on every deploy. This is idempotent with drizzle-kit.

2. **Assigning initial admin user**
   - What we know: Clerk doesn't auto-assign `publicMetadata.role`.
   - What's unclear: Whether the team wants a manual process via Clerk Dashboard or a seed script.
   - Recommendation: Plan a task to manually set `publicMetadata.role` to `'admin'` for the first user via Clerk Dashboard. Document this as a deployment step. For v1 with a small internal team, the manual Clerk Dashboard approach is sufficient.

---

## Environment Variables Reference

### Required in `.env.local` (development)

```bash
# Clerk (from Clerk Dashboard > API Keys)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Clerk sign-in/up routing
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/

# Clerk webhook (from Clerk Dashboard > Webhooks > your endpoint)
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...

# Neon (injected by Vercel Marketplace, or from Neon Dashboard)
DATABASE_URL=postgresql://...@...neon.tech/...?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://...@...neon.tech/...?sslmode=require
```

### Required in Vercel (production)

All of the above, plus swap `pk_test_` → `pk_live_` and `sk_test_` → `sk_live_` for production Clerk keys. `DATABASE_URL` and `DATABASE_URL_UNPOOLED` are auto-injected by the Vercel Neon integration.

---

## Vercel First-Deploy Checklist

1. Connect GitHub repo to Vercel project
2. Add Neon via Vercel Marketplace (auto-injects `DATABASE_URL` and `DATABASE_URL_UNPOOLED`)
3. Add Clerk via Vercel Marketplace OR manually add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY`
4. Add `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` and `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
5. Deploy; after successful build, run `npm run db:migrate`
6. In Clerk Dashboard: configure Session Token customization (add `metadata` claim: `{"metadata": "{{user.public_metadata}}"}`)
7. In Clerk Dashboard: add Webhook endpoint pointing to `https://your-domain/api/webhooks/clerk` with events: `user.created`, `user.updated`, `user.deleted`
8. Copy the Webhook Signing Secret → add `CLERK_WEBHOOK_SIGNING_SECRET` to Vercel env vars
9. Redeploy to pick up the new env var
10. Manually set `publicMetadata.role` to `'admin'` for the first admin user in Clerk Dashboard

---

## Sources

### Primary (HIGH confidence)
- Next.js 16 blog post — https://nextjs.org/blog/next-16 — proxy.ts, breaking changes, Turbopack default
- Next.js 16 upgrade guide — https://nextjs.org/docs/app/guides/upgrading/version-16 — all breaking changes
- Next.js proxy docs — https://nextjs.org/docs/app/getting-started/proxy — proxy.ts file convention (version 16.2.2, fetched 2026-03-31)
- Clerk RBAC guide — https://clerk.com/docs/guides/secure/basic-rbac — publicMetadata + session claims pattern
- Clerk middleware reference — https://clerk.com/docs/reference/nextjs/clerk-middleware — clerkMiddleware + createRouteMatcher
- Clerk verifyWebhook reference — https://clerk.com/docs/reference/backend/verify-webhook — verifyWebhook signature
- Clerk Next.js quickstart — https://clerk.com/docs/quickstarts/nextjs — Core 3 install + proxy.ts pattern
- Clerk env vars — https://clerk.com/docs/guides/development/clerk-environment-variables — all variable names
- Clerk Core 3 breaking changes — injected auth skill (March 2026) — authMiddleware removal, async auth(), ClerkProvider placement
- Neon + Drizzle guide — https://neon.com/docs/guides/drizzle — connection setup, drizzle.config.ts
- Drizzle schema docs — https://orm.drizzle.team/docs/sql-schema-declaration — pgEnum, pgTable API
- shadcn/ui Next.js install — https://ui.shadcn.com/docs/installation/next — init command, component adding
- shadcn/ui Sidebar — https://ui.shadcn.com/docs/components/radix/sidebar — SidebarProvider, sub-components
- shadcn/ui CLI v4 changelog — https://ui.shadcn.com/docs/changelog/2026-03-cli-v4 — new init template flags

### Secondary (MEDIUM confidence)
- Neon Drizzle migrations guide — https://neon.com/docs/guides/drizzle-migrations — migration runner pattern
- Clerk webhook sync guide — https://clerk.com/docs/guides/development/webhooks/syncing — route handler pattern

### Tertiary (LOW confidence)
- Medium article on Next.js 16 proxy rename — community confirmation of rename behavior
- DEV Community article on Clerk webhooks — supplementary upsert pattern detail

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against official docs and release notes
- Architecture: HIGH — patterns sourced directly from Clerk and Next.js official docs
- Breaking changes: HIGH — sourced from official Next.js 16 upgrade guide and Clerk Core 3 release notes
- Pitfalls: HIGH — derived directly from documented breaking changes and official guidance
- Webhook `verifyWebhook` import: MEDIUM — confirmed as `@clerk/nextjs/server` in Core 3 from quickstart; fallback to `@clerk/backend/webhooks` if not found at install time

**Research date:** 2026-03-31
**Valid until:** 2026-05-01 (stable stack; Clerk and Next.js minor versions may add features but breaking changes are unlikely within 30 days)
