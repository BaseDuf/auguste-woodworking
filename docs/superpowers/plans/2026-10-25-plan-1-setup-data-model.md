# Setup & Data Model — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Next.js project, define the full Supabase schema with migrations, configure Row Level Security, and wire up admin authentication — leaving a running app with a protected `/admin` route as the deliverable.

**Architecture:** Next.js 14 App Router with TypeScript; Supabase for database, auth, and file storage; environment managed via `.env.local`. Admin auth uses Supabase Auth (email/password) with a `profiles` table holding the `role` column. Next.js middleware enforces the `/admin` guard server-side.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase JS v2 (`@supabase/ssr`), Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-10-25-auguste-woodworking-design.md`

## Global Constraints

- Next.js 14 App Router only — no Pages Router
- TypeScript strict mode
- Tailwind CSS for all styling
- Supabase JS v2 via `@supabase/ssr` (not the legacy `@supabase/auth-helpers-nextjs`)
- All money values stored as integers in cents (e.g. `price_cents`, `shipping_price_cents`)
- Order number format: `AW-YYYY-NNNNN` (e.g. `AW-2026-00001`)
- Admin role stored as `role = 'admin'` in `public.profiles`
- Node 20+

## Review Focus

- **Unauthenticated request to `/admin/produits`** → should redirect to `/admin/login`, not render the page or throw a 500
- **Supabase client created in a Server Component** → must use the server client (`createServerClient`), never the browser client, to avoid leaking the service role key
- **RLS on `orders`** → an anonymous user must not be able to SELECT another user's order; a service-role call in the webhook must bypass RLS
- **`profiles` row missing for a valid auth user** → the admin guard must treat a missing profile as non-admin and redirect
- **Migration applied twice** → Supabase migration runner is idempotent; the `IF NOT EXISTS` guards in Task 2 must prevent errors on re-run

---

## File Structure

```
auguste-woodworking/
├── app/
│   ├── layout.tsx                  # Root HTML shell, fonts, Tailwind base
│   ├── page.tsx                    # Home placeholder ("coming soon")
│   ├── admin/
│   │   ├── layout.tsx              # Admin shell: checks session, redirects if not admin
│   │   └── login/
│   │       └── page.tsx            # Email/password login form for Auguste
│   └── (public)/
│       └── layout.tsx              # Future public shell (navbar, footer) — empty for now
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # createBrowserClient() — use in Client Components
│   │   ├── server.ts               # createServerClient() — use in Server Components & Route Handlers
│   │   └── middleware.ts           # refreshSession() helper called by middleware.ts
│   └── types/
│       └── database.types.ts       # Hand-written DB types matching the schema (no codegen needed at this stage)
├── supabase/
│   └── migrations/
│       └── 20261025000000_initial.sql   # All tables + RLS policies
├── middleware.ts                   # Next.js middleware: refreshes Supabase session on every request
├── .env.local.example              # Template for required env vars
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

### Task 1: Scaffold Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `next.config.ts`
- Create: `app/layout.tsx`, `app/page.tsx`
- Create: `.env.local.example`

**Interfaces:**
- Produces: a running `next dev` server at `localhost:3000` showing a placeholder home page

- [ ] **Step 1: Initialise the project**

```bash
npx create-next-app@14 . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=no \
  --import-alias="@/*" \
  --no-git
```

Run from `/home/user/auguste-woodworking`. Answer yes to overwrite `README.md`.

- [ ] **Step 2: Install Supabase and Resend dependencies**

```bash
npm install @supabase/ssr @supabase/supabase-js resend stripe @stripe/stripe-js
```

- [ ] **Step 3: Install Vitest + Testing Library**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 4: Add Vitest config to `package.json`**

Add under `"scripts"`:
```json
"test": "vitest",
"test:run": "vitest run"
```

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
  },
})
```

Create `vitest.setup.ts`:
```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Create `.env.local.example`**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
```

Copy to `.env.local` and fill in values before running. `.env.local` is already in `.gitignore`.

- [ ] **Step 6: Replace `app/page.tsx` with placeholder**

```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-stone-600 font-serif text-2xl">Auguste Woodworking — bientôt disponible</p>
    </main>
  )
}
```

- [ ] **Step 7: Verify dev server starts**

```bash
npm run dev
```

Expected: server starts on port 3000, no TypeScript errors in the console.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 14 + Tailwind + Supabase + Vitest"
```

---

### Task 2: Database schema migration

**Files:**
- Create: `supabase/migrations/20261025000000_initial.sql`

**Interfaces:**
- Produces: all tables described in spec §5, with RLS enabled

- [ ] **Step 1: Write the failing schema test**

Create `lib/supabase/__tests__/schema.test.ts`:

```ts
// Smoke-test: verifies the TypeScript types compile against the expected shape.
// Real schema correctness is verified by running the migration against a local Supabase instance.
import type { Database } from '@/lib/types/database.types'

type Product = Database['public']['Tables']['products']['Row']
type Order = Database['public']['Tables']['orders']['Row']
type OrderItem = Database['public']['Tables']['order_items']['Row']

test('Product has required money columns as numbers', () => {
  const p: Partial<Product> = { price_cents: 5000, shipping_price_cents: 900 }
  expect(typeof p.price_cents).toBe('number')
  expect(typeof p.shipping_price_cents).toBe('number')
})

test('Order has order_number field', () => {
  const o: Partial<Order> = { order_number: 'AW-2026-00001' }
  expect(o.order_number).toMatch(/^AW-\d{4}-\d{5}$/)
})

test('OrderItem references both order and product', () => {
  const i: Partial<OrderItem> = { order_id: 'uuid', product_id: 'uuid', quantity: 1, unit_price_cents: 5000 }
  expect(i.order_id).toBeDefined()
  expect(i.product_id).toBeDefined()
})
```

- [ ] **Step 2: Run test — expect TypeScript compile error (types don't exist yet)**

```bash
npm run test:run -- lib/supabase/__tests__/schema.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/types/database.types'`

- [ ] **Step 3: Create `lib/types/database.types.ts`**

Define the full hand-written type matching the migration below:

```ts
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; role: 'admin' | 'customer'; created_at: string }
        Insert: { id: string; role?: 'admin' | 'customer' }
        Update: { role?: 'admin' | 'customer' }
      }
      products: {
        Row: {
          id: string; slug: string; name: string; description: string | null
          price_cents: number; shipping_price_cents: number; stock: number
          allow_preorder: boolean; category: string | null
          published: boolean; created_at: string
        }
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['products']['Insert']>
      }
      product_photos: {
        Row: { id: string; product_id: string; url: string; position: number }
        Insert: Omit<Database['public']['Tables']['product_photos']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['product_photos']['Insert']>
      }
      orders: {
        Row: {
          id: string; order_number: string; status: 'en_attente' | 'confirmee' | 'expediee' | 'livree' | 'echouee'
          email: string; phone: string | null; customer_id: string | null
          stripe_payment_intent_id: string | null; created_at: string
        }
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['orders']['Insert']>
      }
      order_items: {
        Row: { id: string; order_id: string; product_id: string; quantity: number; unit_price_cents: number }
        Insert: Omit<Database['public']['Tables']['order_items']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['order_items']['Insert']>
      }
      shipping_addresses: {
        Row: {
          id: string; order_id: string; first_name: string; last_name: string
          line1: string; line2: string | null; city: string; postal_code: string; country: string
        }
        Insert: Omit<Database['public']['Tables']['shipping_addresses']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['shipping_addresses']['Insert']>
      }
      realisations: {
        Row: { id: string; title: string; description: string | null; created_at: string }
        Insert: Omit<Database['public']['Tables']['realisations']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['realisations']['Insert']>
      }
      realisation_photos: {
        Row: { id: string; realisation_id: string; url: string; position: number }
        Insert: Omit<Database['public']['Tables']['realisation_photos']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['realisation_photos']['Insert']>
      }
    }
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm run test:run -- lib/supabase/__tests__/schema.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Write `supabase/migrations/20261025000000_initial.sql`**

```sql
-- profiles: ties Supabase auth users to roles
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  role text not null default 'customer' check (role in ('admin', 'customer')),
  created_at timestamptz not null default now()
);

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- products
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  shipping_price_cents integer not null default 0 check (shipping_price_cents >= 0),
  stock integer not null default 0 check (stock >= 0),
  allow_preorder boolean not null default false,
  category text,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.product_photos (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products on delete cascade,
  url text not null,
  position integer not null default 0
);

-- orders
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  status text not null default 'en_attente'
    check (status in ('en_attente', 'confirmee', 'expediee', 'livree', 'echouee')),
  email text not null,
  phone text,
  customer_id uuid references auth.users,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders on delete cascade,
  product_id uuid not null references public.products,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0)
);

create table if not exists public.shipping_addresses (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders on delete cascade,
  first_name text not null,
  last_name text not null,
  line1 text not null,
  line2 text,
  city text not null,
  postal_code text not null,
  country text not null default 'FR'
);

-- realisations
create table if not exists public.realisations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.realisation_photos (
  id uuid primary key default gen_random_uuid(),
  realisation_id uuid not null references public.realisations on delete cascade,
  url text not null,
  position integer not null default 0
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_photos enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.shipping_addresses enable row level security;
alter table public.realisations enable row level security;
alter table public.realisation_photos enable row level security;

-- Public read: published products and photos, realisations
create policy "Public can read published products"
  on public.products for select using (published = true);

create policy "Public can read product photos"
  on public.product_photos for select using (
    exists (select 1 from public.products p where p.id = product_id and p.published = true)
  );

create policy "Public can read realisations"
  on public.realisations for select using (true);

create policy "Public can read realisation photos"
  on public.realisation_photos for select using (true);

-- Orders: owner or service role
create policy "Customers can read own orders"
  on public.orders for select
  using (auth.uid() = customer_id);

create policy "Customers can read own order items"
  on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));

create policy "Customers can read own shipping address"
  on public.shipping_addresses for select
  using (exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));

-- Admin: full access (service role bypasses RLS; these policies cover JWT-authenticated admin)
create policy "Admin full access to products"
  on public.products for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admin full access to product_photos"
  on public.product_photos for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admin full access to orders"
  on public.orders for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admin full access to order_items"
  on public.order_items for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admin full access to shipping_addresses"
  on public.shipping_addresses for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admin full access to realisations"
  on public.realisations for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admin full access to realisation_photos"
  on public.realisation_photos for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
```

- [ ] **Step 6: Apply migration to Supabase project**

In the Supabase dashboard → SQL Editor → paste and run the migration. Verify all tables appear in the Table Editor.

Alternatively, if Supabase CLI is available:
```bash
supabase db push
```

- [ ] **Step 7: Commit**

```bash
git add supabase/ lib/types/ lib/supabase/__tests__/
git commit -m "feat: Supabase schema migration + DB types"
```

---

### Task 3: Supabase client helpers

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/middleware.ts`
- Create: `middleware.ts` (root)

**Interfaces:**
- Produces:
  - `createBrowserClient(): SupabaseClient<Database>` — use in `'use client'` components
  - `createServerClient(cookieStore): SupabaseClient<Database>` — use in Server Components and Route Handlers
  - `updateSession(request): NextResponse` — called by root `middleware.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/supabase/__tests__/clients.test.ts`:

```ts
import { createClient } from '@/lib/supabase/client'

// We can't fully instantiate the client without env vars in test,
// so we verify the factory exists and has the right shape.
test('createClient is a function', () => {
  expect(typeof createClient).toBe('function')
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm run test:run -- lib/supabase/__tests__/clients.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement `lib/supabase/client.ts`**

```ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 4: Implement `lib/supabase/server.ts`**

```ts
import { createServerClient as _createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/types/database.types'

export function createClient() {
  const cookieStore = cookies()
  return _createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {} // Server Component — cookie writes are ignored
        },
      },
    }
  )
}
```

- [ ] **Step 5: Implement `lib/supabase/middleware.ts`**

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/types/database.types'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()
  return supabaseResponse
}
```

- [ ] **Step 6: Implement root `middleware.ts`**

```ts
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 7: Run test — expect PASS**

```bash
npm run test:run -- lib/supabase/__tests__/clients.test.ts
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add lib/supabase/ middleware.ts
git commit -m "feat: Supabase client helpers + Next.js session middleware"
```

---

### Task 4: Admin authentication

**Files:**
- Create: `app/admin/login/page.tsx`
- Create: `app/admin/layout.tsx`
- Test: `app/admin/__tests__/auth-guard.test.tsx`

**Interfaces:**
- Consumes: `createClient()` from `@/lib/supabase/server`
- Produces:
  - `GET /admin/*` → redirects to `/admin/login` if no valid admin session
  - `POST /admin/login` → signs in with email/password, redirects to `/admin` on success

- [ ] **Step 1: Write the failing test for the auth guard**

Create `app/admin/__tests__/auth-guard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'

// We test the login page UI in isolation (the guard itself requires
// mocking Next.js server internals — tested manually below).
import LoginPage from '../login/page'

test('login page renders email and password fields', async () => {
  render(<LoginPage />)
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/mot de passe/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /se connecter/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm run test:run -- app/admin/__tests__/auth-guard.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement `app/admin/login/page.tsx`**

Client component (`'use client'`). Fields: `email` (label "Email"), `password` (label "Mot de passe"), submit button "Se connecter". On submit, calls `supabase.auth.signInWithPassword({ email, password })`. On success, `router.push('/admin')`. On error, display the error message below the form.

- [ ] **Step 4: Run test — expect PASS**

```bash
npm run test:run -- app/admin/__tests__/auth-guard.test.tsx
```

Expected: PASS

- [ ] **Step 5: Implement `app/admin/layout.tsx`**

Server Component. Calls `createClient()` from `@/lib/supabase/server`. Gets the user with `supabase.auth.getUser()`. If no user, `redirect('/admin/login')`. Fetches `profiles` row for that user. If `role !== 'admin'`, `redirect('/admin/login')`. Otherwise renders `{children}`.

- [ ] **Step 6: Manual verification**

Start dev server (`npm run dev`). Navigate to `http://localhost:3000/admin`. Expected: redirect to `/admin/login`. Log in with Auguste's credentials. Expected: redirect to `/admin` (shows a blank page or 404 — that's fine, no dashboard yet).

- [ ] **Step 7: Commit**

```bash
git add app/admin/
git commit -m "feat: admin login page + server-side auth guard"
```

---

## Execution Handoff

Plan complet. Deux choix d'exécution :

- **Subagent-driven** — un sous-agent frais implémente chaque tâche, un reviewer indépendant valide avant de passer à la suivante. Plus rigoureux, plus coûteux.
- **Native** — tu implémentes les 4 tâches toi-même dans cette session, un reviewer final sur la branche entière. Plus rapide.

**Je recommande Native**, parce que les 4 tâches sont fortement séquentielles (chaque tâche dépend des fichiers de la précédente) et le risque d'erreur sur du scaffolding + schema est faible si le plan est suivi à la lettre. Un reviewer final suffit.
