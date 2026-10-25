# Catalogue Public Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build all read-only public pages — homepage, boutique, product detail, réalisations gallery, and atelier — fetching live data from Supabase.

**Architecture:** Server Components fetch data directly via the Supabase server client. A thin data layer (`lib/data/`) wraps the queries so pages stay simple. Client Components are used only for the photo carousel and the "Ajouter au panier" button placeholder (wired up in Plan 3). Layout and typography are set globally; Nav and Footer are shared components.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, `next/font/google` (Cormorant Garamond + Inter), Supabase SSR.

**Spec:** `docs/superpowers/specs/2026-10-25-auguste-woodworking-design.md`

## Global Constraints

- Next.js 14.2.x, TypeScript strict mode — no `any`
- Tailwind only for styling — no extra CSS-in-JS libraries
- Server Components by default; `'use client'` only when interactivity requires it
- French copy for all UI labels (spec §2)
- Categories: `'ameublement' | 'objet' | 'piece_limitee'` (migration 20261025000002)
- "Ajouter au panier" button is a placeholder in this plan — no cart logic (Plan 3)
- Photos: `<Image>` from `next/image`, placeholder if no photos
- `notFound()` from `next/navigation` for unknown slugs

## Review Focus

- **Product with no photos:** product detail page must render without crashing — use a neutral placeholder, never throw on empty array
- **Unknown slug:** `/boutique/[slug]` must call `notFound()`, not throw a 500 — test with a non-existent slug
- **Stock 0, allow_preorder false:** "Ajouter au panier" disabled + "Rupture de stock" label; test the two branches
- **Stock 0, allow_preorder true:** button enabled with "Précommander" label; test this branch
- **Empty boutique:** no published products → empty state "Aucun produit disponible pour l'instant" instead of blank grid

---

### Task 1: Design system — fonts, root layout, Nav, Footer

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Create: `components/nav.tsx`
- Create: `components/footer.tsx`
- Test: `components/__tests__/nav.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces:
  - `<Nav />` — renders site navigation, exported from `components/nav.tsx`
  - `<Footer />` — renders footer with nav links, exported from `components/footer.tsx`

- [ ] **Step 1: Write failing test for Nav**

```tsx
// components/__tests__/nav.test.tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
vi.mock('next/navigation', () => ({ usePathname: () => '/' }))
import Nav from '../nav'

test('nav contains Boutique and Réalisations links', () => {
  render(<Nav />)
  expect(screen.getByRole('link', { name: /boutique/i })).toHaveAttribute('href', '/boutique')
  expect(screen.getByRole('link', { name: /réalisations/i })).toHaveAttribute('href', '/realisations')
})
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm test -- --run components/__tests__/nav.test.tsx`
Expected: FAIL — `Nav` module not found

- [ ] **Step 3: Implement `app/layout.tsx`**

Replace scaffold layout with:
- `next/font/google`: `Cormorant_Garamond` (weights 400, 600, variable `--font-serif`) and `Inter` (variable `--font-sans`)
- `<html lang="fr">`
- `metadata`: `title: 'Auguste Woodworking'`, `description: 'Objets en bois faits à la main'`
- Render `<Nav />` above `{children}` and `<Footer />` below, inside `<body>`

- [ ] **Step 4: Implement `app/globals.css`**

Add CSS variables on `:root`:
```css
:root {
  --background: #faf9f7;
  --foreground: #2c2420;
}
body {
  background-color: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans), sans-serif;
}
h1, h2, h3 { font-family: var(--font-serif), serif; }
```

- [ ] **Step 5: Implement `components/nav.tsx`**

`'use client'` — uses `usePathname` to mark active link.
Links: `Auguste Woodworking` (logo/home, href `/`), `Boutique` (href `/boutique`), `Réalisations` (href `/realisations`), `L'atelier` (href `/atelier`).
Tailwind: sticky top, white/cream background, border-bottom, flex layout, mobile-friendly.

- [ ] **Step 6: Implement `components/footer.tsx`**

Server Component. Links: `Boutique`, `Réalisations`, `L'atelier`, `Mentions légales` (`/mentions-legales`), `CGV` (`/cgv`). Email de contact placeholder `contact@auguste-woodworking.fr`. Copyright line with year.

- [ ] **Step 7: Run test — verify it passes**

Run: `npm test -- --run components/__tests__/nav.test.tsx`
Expected: PASS 1/1

- [ ] **Step 8: Run full suite**

Run: `npm test -- --run`
Expected: all tests pass

- [ ] **Step 9: Commit**

```bash
git add app/layout.tsx app/globals.css components/nav.tsx components/footer.tsx components/__tests__/nav.test.tsx
git commit -m "feat: design system — fonts, layout, Nav, Footer"
```

---

### Task 2: Data fetching layer

**Files:**
- Create: `lib/data/products.ts`
- Create: `lib/data/realisations.ts`
- Test: `lib/data/__tests__/products.test.ts`

**Interfaces:**
- Consumes:
  - `createClient` from `@/lib/supabase/server`
  - `Database` from `@/lib/types/database.types`
- Produces:
  - `type ProductWithPhotos` — `Database['public']['Tables']['products']['Row'] & { product_photos: Database['public']['Tables']['product_photos']['Row'][] }`
  - `type RealisationWithPhotos` — `Database['public']['Tables']['realisations']['Row'] & { realisation_photos: Database['public']['Tables']['realisation_photos']['Row'][] }`
  - `getPublishedProducts(category?: 'ameublement' | 'objet' | 'piece_limitee'): Promise<ProductWithPhotos[]>` — returns published products, optionally filtered by category, ordered by `created_at desc`
  - `getProductBySlug(slug: string): Promise<ProductWithPhotos | null>` — returns a single published product with its photos, or null
  - `getFeaturedProducts(): Promise<ProductWithPhotos[]>` — returns the 4 most recent published products
  - `getRealisations(): Promise<RealisationWithPhotos[]>` — returns all realisations with photos, ordered by `created_at desc`

- [ ] **Step 1: Write failing tests**

```ts
// lib/data/__tests__/products.test.ts
import { describe, it, expect, vi } from 'vitest'

const makeChain = (resolved: unknown) => ({
  select: () => makeChain(resolved),
  eq: () => makeChain(resolved),
  order: () => makeChain(resolved),
  limit: () => Promise.resolve(resolved),
  single: () => Promise.resolve(resolved),
  then: (fn: (v: unknown) => unknown) => Promise.resolve(resolved).then(fn),
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ from: (_table: string) => makeChain({ data: [], error: null }) }),
}))

describe('getPublishedProducts', () => {
  it('returns empty array when no products', async () => {
    const { getPublishedProducts } = await import('../products')
    const result = await getPublishedProducts()
    expect(result).toEqual([])
  })
})

describe('getProductBySlug', () => {
  it('returns null when product not found', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: () => ({ from: (_table: string) => makeChain({ data: null, error: { code: 'PGRST116' } }) }),
    }))
    const { getProductBySlug } = await import('../products?null')
    const result = await getProductBySlug('unknown-slug')
    expect(result).toBeNull()
  })
})
```

Note: the `vi.doMock` / virtual import trick may be tricky; if it doesn't work, simplify to a single mock and test only the empty-array path — the null-return branch is covered by the Review Focus test in Task 4.

- [ ] **Step 2: Run tests — verify they fail**

Run: `npm test -- --run lib/data/__tests__/products.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `lib/data/products.ts`**

Export `ProductWithPhotos` type and the three functions. Each function calls `createClient()`, queries `products` with `.select('*, product_photos(*)')` and appropriate `.eq('published', true)` / `.eq('slug', slug)` / `.order('created_at', { ascending: false })` / `.limit(4)` / `.single()` filters. Return `data ?? []` or `data ?? null`. On error from `.single()`, return `null`.

- [ ] **Step 4: Implement `lib/data/realisations.ts`**

Export `RealisationWithPhotos` type and `getRealisations()`. Query `.select('*, realisation_photos(*)')`, order by `created_at desc`. Return `data ?? []`.

- [ ] **Step 5: Run tests — verify they pass**

Run: `npm test -- --run lib/data/__tests__/products.test.ts`
Expected: PASS 2/2

- [ ] **Step 6: Run full suite**

Run: `npm test -- --run`
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add lib/data/products.ts lib/data/realisations.ts lib/data/__tests__/products.test.ts
git commit -m "feat: data fetching layer — products and realisations"
```

---

### Task 3: Homepage

**Files:**
- Modify: `app/page.tsx`
- Test: `app/__tests__/home.test.tsx`

**Interfaces:**
- Consumes:
  - `getFeaturedProducts` from `@/lib/data/products`
  - `getRealisations` from `@/lib/data/realisations`
  - `ProductWithPhotos`, `RealisationWithPhotos` types

- [ ] **Step 1: Write failing test**

```tsx
// app/__tests__/home.test.tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('@/lib/data/products', () => ({
  getFeaturedProducts: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/data/realisations', () => ({
  getRealisations: vi.fn().mockResolvedValue([]),
}))

// Next.js server components render async — test the rendered output
import Home from '../page'

test('homepage renders boutique and atelier CTAs', async () => {
  const jsx = await Home()
  render(jsx)
  expect(screen.getByRole('link', { name: /voir la boutique/i })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /découvrir l'atelier/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm test -- --run app/__tests__/home.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `app/page.tsx`**

Async Server Component. Fetches `getFeaturedProducts()` and `getRealisations()` in parallel with `Promise.all`. Renders:
1. **Hero** — full-width section, `<h1>Auguste Woodworking</h1>`, subtitle "Objets en bois faits à la main", two `<Link>` CTAs: "Voir la boutique" → `/boutique`, "Découvrir l'atelier" → `/atelier`. Placeholder background `bg-stone-200`.
2. **Produits vedettes** — section label "Boutique", grid of up to 4 products (photo, name, price formatted `(price_cents / 100).toFixed(2) + ' €'`), "Voir tous les produits" link → `/boutique`. If no products, render nothing for this section.
3. **Réalisations** — section label "Réalisations", up to 3 realisations photos, "Voir toutes les réalisations" link → `/realisations`. If empty, render nothing.
4. **À propos court** — static text placeholder + link "En savoir plus" → `/atelier`.

- [ ] **Step 4: Run test — verify it passes**

Run: `npm test -- --run app/__tests__/home.test.tsx`
Expected: PASS 1/1

- [ ] **Step 5: Run full suite**

Run: `npm test -- --run`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/__tests__/home.test.tsx
git commit -m "feat: homepage — hero, featured products, realisations preview"
```

---

### Task 4: Boutique page + product detail

**Files:**
- Create: `app/boutique/page.tsx`
- Create: `app/boutique/[slug]/page.tsx`
- Create: `components/add-to-cart-button.tsx`
- Create: `components/photo-carousel.tsx`
- Test: `app/boutique/__tests__/boutique.test.tsx`
- Test: `components/__tests__/add-to-cart-button.test.tsx`

**Interfaces:**
- Consumes:
  - `getPublishedProducts` from `@/lib/data/products`
  - `getProductBySlug` from `@/lib/data/products`
  - `ProductWithPhotos` type
- Produces:
  - `<AddToCartButton product={ProductWithPhotos} />` — `'use client'`, exported from `components/add-to-cart-button.tsx`. Placeholder: logs to console. Disabled + "Rupture de stock" when `stock === 0 && !allow_preorder`. Shows "Précommander" when `stock === 0 && allow_preorder`.
  - `<PhotoCarousel photos={ProductPhoto[]} />` — `'use client'`, simple prev/next carousel

- [ ] **Step 1: Write failing tests**

```tsx
// components/__tests__/photo-carousel.test.tsx
import { render, screen } from '@testing-library/react'
import PhotoCarousel from '../photo-carousel'

test('carousel renders placeholder when no photos', () => {
  render(<PhotoCarousel photos={[]} />)
  expect(screen.getByTestId('photo-placeholder')).toBeInTheDocument()
})
```

```tsx
// components/__tests__/add-to-cart-button.test.tsx
import { render, screen } from '@testing-library/react'
import AddToCartButton from '../add-to-cart-button'
import type { ProductWithPhotos } from '@/lib/data/products'

const base: ProductWithPhotos = {
  id: '1', slug: 'table', name: 'Table', description: null,
  price_cents: 50000, shipping_price_cents: 1500,
  stock: 1, allow_preorder: false,
  category: 'ameublement', published: true, created_at: '',
  product_photos: [],
}

test('button enabled when stock > 0', () => {
  render(<AddToCartButton product={base} />)
  expect(screen.getByRole('button', { name: /ajouter au panier/i })).not.toBeDisabled()
})

test('button disabled when stock 0 and no preorder', () => {
  render(<AddToCartButton product={{ ...base, stock: 0 }} />)
  const btn = screen.getByRole('button')
  expect(btn).toBeDisabled()
  expect(btn).toHaveTextContent(/rupture de stock/i)
})

test('button enabled with Précommander when stock 0 and allow_preorder', () => {
  render(<AddToCartButton product={{ ...base, stock: 0, allow_preorder: true }} />)
  const btn = screen.getByRole('button', { name: /précommander/i })
  expect(btn).not.toBeDisabled()
})
```

```tsx
// app/boutique/__tests__/boutique.test.tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('@/lib/data/products', () => ({
  getPublishedProducts: vi.fn().mockResolvedValue([]),
}))

import BoutiquePage from '../page'

test('boutique shows empty state when no products', async () => {
  const jsx = await BoutiquePage({ searchParams: {} })
  render(jsx)
  expect(screen.getByText(/aucun produit disponible/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npm test -- --run components/__tests__/photo-carousel.test.tsx components/__tests__/add-to-cart-button.test.tsx app/boutique/__tests__/boutique.test.tsx`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement `components/photo-carousel.tsx`**

`'use client'`. Props: `photos: { url: string; position: number }[]`. If `photos.length === 0`, render `<div data-testid="photo-placeholder" className="bg-stone-100 ...">`. Otherwise render current photo with prev/next buttons, track `currentIndex` with `useState`.

- [ ] **Step 4: Implement `components/add-to-cart-button.tsx`**

`'use client'`. Props: `product: ProductWithPhotos`. Button label logic:
- `stock === 0 && !allow_preorder` → disabled, label "Rupture de stock"
- `stock === 0 && allow_preorder` → enabled, label "Précommander"
- otherwise → enabled, label "Ajouter au panier"
`onClick` logs `'[Cart] Add:', product.id` (wired to real cart in Plan 3).

- [ ] **Step 5: Implement `app/boutique/page.tsx`**

Async Server Component. Accepts optional `searchParams: { categorie?: string }`. Calls `getPublishedProducts(categorie as Category | undefined)`. Renders product grid (photo, name, price, category badge, link to `/boutique/[slug]`). If empty: `<p>Aucun produit disponible pour l'instant.</p>`. Category filter links at top (Tous / Ameublement / Objets / Pièces limitées) using `<Link href="/boutique?categorie=...">`.

- [ ] **Step 6: Implement `app/boutique/[slug]/page.tsx`**

Async Server Component. Calls `getProductBySlug(params.slug)`. If null: `notFound()`. Renders `<PhotoCarousel photos={product.product_photos} />`, name, price, description, `<AddToCartButton product={product} />`. Add `generateMetadata` that returns `{ title: product.name }` or `{ title: 'Produit introuvable' }` if null.

- [ ] **Step 7: Run tests — verify they pass**

Run: `npm test -- --run components/__tests__/photo-carousel.test.tsx components/__tests__/add-to-cart-button.test.tsx app/boutique/__tests__/boutique.test.tsx`
Expected: PASS 5/5

- [ ] **Step 8: Run full suite**

Run: `npm test -- --run`
Expected: all tests pass

- [ ] **Step 9: Commit**

```bash
git add app/boutique/ components/add-to-cart-button.tsx components/photo-carousel.tsx components/__tests__/add-to-cart-button.test.tsx components/__tests__/photo-carousel.test.tsx
git commit -m "feat: boutique page, product detail, add-to-cart placeholder"
```

---

### Task 5: Réalisations gallery + Atelier page

**Files:**
- Create: `app/realisations/page.tsx`
- Create: `app/atelier/page.tsx`
- Test: `app/realisations/__tests__/realisations.test.tsx`

**Interfaces:**
- Consumes:
  - `getRealisations` from `@/lib/data/realisations`
  - `RealisationWithPhotos` type

- [ ] **Step 1: Write failing test**

```tsx
// app/realisations/__tests__/realisations.test.tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('@/lib/data/realisations', () => ({
  getRealisations: vi.fn().mockResolvedValue([
    { id: '1', title: 'Table sur-mesure', description: 'Une belle table',
      created_at: '', realisation_photos: [{ id: 'p1', url: '/photo.jpg', position: 0, realisation_id: '1' }] }
  ]),
}))

import RealisationsPage from '../page'

test('realisations page renders realisation titles', async () => {
  const jsx = await RealisationsPage()
  render(jsx)
  expect(screen.getByText('Table sur-mesure')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm test -- --run app/realisations/__tests__/realisations.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `app/realisations/page.tsx`**

Async Server Component. Calls `getRealisations()`. Renders a masonry-style grid (CSS columns). Each realisation: first photo (or placeholder), title, description. If no realisations: "Bientôt disponible."

- [ ] **Step 4: Implement `app/atelier/page.tsx`**

Static Server Component (no data fetch). Sections: "L'histoire d'Auguste" (placeholder text), "La démarche" (placeholder), "Les matériaux" (placeholder). CTA "Voir la boutique" → `/boutique`. Static for now; content provided by Auguste before production.

- [ ] **Step 5: Run test — verify it passes**

Run: `npm test -- --run app/realisations/__tests__/realisations.test.tsx`
Expected: PASS 1/1

- [ ] **Step 6: Run full suite**

Run: `npm test -- --run`
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add app/realisations/ app/atelier/ app/realisations/__tests__/
git commit -m "feat: réalisations gallery and atelier page"
```
