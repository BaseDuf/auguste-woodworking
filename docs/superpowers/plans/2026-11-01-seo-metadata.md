# SEO & Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter metadata Next.js complète (OG, Twitter Card, canonical), JSON-LD Schema.org, sitemap dynamique et robots.txt au site Auguste Woodworking.

**Architecture:** Un fichier de config partagé (`lib/seo/config.ts`) centralise l'URL et les valeurs par défaut. Un composant serveur `JsonLd` rend les données structurées sans hydratation. Les pages statiques exportent `metadata`, les pages dynamiques utilisent `generateMetadata`. Sitemap et robots via les conventions Next.js App Router natives.

**Tech Stack:** Next.js 14.2 App Router, TypeScript strict, API `Metadata` native Next.js, Schema.org JSON-LD, Vitest + testing-library.

**Spec:** `docs/superpowers/specs/2026-11-01-seo-metadata-design.md`

## Global Constraints

- Next.js 14.2 App Router — API `Metadata` et `generateMetadata` natives uniquement, zéro dépendance supplémentaire
- TypeScript strict — pas de `any`
- `NEXT_PUBLIC_SITE_URL` est la seule variable d'env ajoutée ; fallback `'https://auguste-woodworking.fr'`
- Vitest uniquement (`vi`, pas `jest`), `vi.hoisted` pour les mocks stables
- Pas de `server-only` (package non installé)

## Review Focus

1. **Produit sans photos** → `generateMetadata` doit utiliser `DEFAULT_OG_IMAGE`, pas `undefined` dans les balises OG — testé T3 step 1.
2. **Produit sans description** → `generateMetadata` doit utiliser le fallback `'Objet en bois fait à la main par Auguste Woodworking.'`, pas `undefined` — testé T3 step 1.
3. **`NEXT_PUBLIC_SITE_URL` absent** → toutes les URLs doivent utiliser le fallback `'https://auguste-woodworking.fr'`, pas planter — testé T1 step 1.
4. **`getPublishedProducts()` erreur dans le sitemap** → le sitemap doit retourner les routes statiques uniquement sans throw — testé T4 step 1.
5. **Produit introuvable (`notFound`)** → `generateMetadata` doit retourner un titre fallback propre sans crash — testé T3 step 1.

---

### Task 1: Config SEO + composant JsonLd

**Files:**
- Create: `lib/seo/config.ts`
- Create: `components/seo/json-ld.tsx`
- Create: `public/og-default.jpg` (placeholder)
- Test: `components/seo/__tests__/json-ld.test.tsx`

**Interfaces:**
- Produces:
  - `SITE_URL: string` — `process.env.NEXT_PUBLIC_SITE_URL ?? 'https://auguste-woodworking.fr'`
  - `SITE_NAME: string` — `'Auguste Woodworking'`
  - `SITE_DESCRIPTION: string` — `'Objets en bois faits à la main par un menuisier artisan en Allier.'`
  - `DEFAULT_OG_IMAGE: string` — `` `${SITE_URL}/og-default.jpg` ``
  - `JsonLd({ data }: { data: Record<string, unknown> }): JSX.Element`

- [ ] **Step 1: Écrire le test échouant**

```tsx
// components/seo/__tests__/json-ld.test.tsx
import { render } from '@testing-library/react'
import { it, expect } from 'vitest'
import { JsonLd } from '../json-ld'

it('renders a script tag with type application/ld+json containing the data', () => {
  const data = { '@context': 'https://schema.org', '@type': 'Organization', name: 'Test' }
  const { container } = render(<JsonLd data={data} />)
  const script = container.querySelector('script[type="application/ld+json"]')
  expect(script).not.toBeNull()
  expect(JSON.parse(script!.textContent!)).toEqual(data)
})

it('SITE_URL falls back to https://auguste-woodworking.fr when env var is absent', async () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL
  delete process.env.NEXT_PUBLIC_SITE_URL
  // Re-import after env change — use a dynamic import inside the test
  const { SITE_URL } = await import('../../lib/seo/config')
  expect(SITE_URL).toBe('https://auguste-woodworking.fr')
  if (original) process.env.NEXT_PUBLIC_SITE_URL = original
})
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npx vitest run components/seo/__tests__/json-ld.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Créer `lib/seo/config.ts`**

Exporter les quatre constantes nommées dans Interfaces ci-dessus. Pas de logique.

- [ ] **Step 4: Créer `components/seo/json-ld.tsx`**

Composant serveur (pas de `'use client'`). Props: `{ data: Record<string, unknown> }`. Rend `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />`.

- [ ] **Step 5: Créer `public/og-default.jpg`**

Créer un JPEG 1200×630 blanc (placeholder) : `convert -size 1200x630 xc:white public/og-default.jpg`. Si ImageMagick n'est pas disponible, copier n'importe quelle image JPG existante du repo vers `public/og-default.jpg`.

- [ ] **Step 6: Lancer les tests pour vérifier le passage**

Run: `npx vitest run components/seo/__tests__/json-ld.test.tsx`
Expected: PASS — 2 tests

- [ ] **Step 7: Commit**

```bash
git add lib/seo/config.ts components/seo/json-ld.tsx components/seo/__tests__/json-ld.test.tsx public/og-default.jpg
git commit -m "feat(seo): add seo config and JsonLd component"
```

---

### Task 2: Metadata racine + pages statiques

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Modify: `app/boutique/page.tsx`
- Modify: `app/realisations/page.tsx`
- Modify: `app/atelier/page.tsx`
- Modify: `app/cgv/page.tsx`
- Modify: `app/mentions-legales/page.tsx`
- Modify: `app/politique-de-confidentialite/page.tsx`

**Interfaces:**
- Consumes: `SITE_URL`, `SITE_NAME`, `SITE_DESCRIPTION`, `DEFAULT_OG_IMAGE` from T1
- Consumes: `JsonLd` from T1
- Produces: metadata complète sur toutes les pages statiques publiques ; `noindex` sur les 3 pages légales

- [ ] **Step 1: Modifier `app/layout.tsx`**

Remplacer le `metadata` existant par :
```ts
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/lib/seo/config'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: { siteName: SITE_NAME, locale: 'fr_FR', type: 'website' },
}
```

- [ ] **Step 2: Modifier `app/page.tsx`**

Ajouter l'export `metadata` et le composant `<JsonLd>` Organization. Valeurs exactes :
- `title`: `'Auguste Woodworking | Menuisier artisan en Allier'`
- `description`: `'Objets en bois faits à la main par un menuisier artisan en Allier.'`
- `openGraph`: `{ title, description, url: SITE_URL, images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }] }`
- `twitter`: `{ card: 'summary_large_image', title, description, images: [DEFAULT_OG_IMAGE] }`
- `alternates`: `{ canonical: SITE_URL }`

Dans le JSX retourné, ajouter avant le premier `<section>` :
```tsx
<JsonLd data={{
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
}} />
```

- [ ] **Step 3: Modifier les 3 pages publiques** (`/boutique`, `/realisations`, `/atelier`)

Ajouter `export const metadata: Metadata` sur chacune. Pas de `JsonLd` sur ces pages.

`app/boutique/page.tsx` :
- `title`: `'Boutique'` (le template layout ajoute `| Auguste Woodworking`)
- `description`: `'Découvrez nos objets en bois faits à la main.'`
- `openGraph`: `{ title: 'Boutique | Auguste Woodworking', description, url: \`${SITE_URL}/boutique\`, images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }] }`
- `twitter`: `{ card: 'summary_large_image', title: 'Boutique | Auguste Woodworking', description, images: [DEFAULT_OG_IMAGE] }`
- `alternates`: `{ canonical: \`${SITE_URL}/boutique\` }`

`app/realisations/page.tsx` :
- `title`: `'Réalisations'`
- `description`: `'Aménagements intérieurs, mobilier sur mesure — nos chantiers réalisés.'`
- OG/Twitter/canonical identiques au pattern boutique avec `/realisations`

`app/atelier/page.tsx` :
- `title`: `"L'Atelier"`
- `description`: `"Menuisier de formation, basé dans la vallée de la Sioule en Allier."`
- OG/Twitter/canonical identiques avec `/atelier`

- [ ] **Step 4: Modifier les 3 pages légales** (`/cgv`, `/mentions-legales`, `/politique-de-confidentialite`)

Remplacer leur `metadata` existant par un objet qui inclut `robots: { index: false, follow: false }`. Pas d'OG sur ces pages.

`app/cgv/page.tsx` : `title: 'Conditions générales de vente'`, `robots: { index: false, follow: false }`
`app/mentions-legales/page.tsx` : `title: 'Mentions légales'`, `robots: { index: false, follow: false }`
`app/politique-de-confidentialite/page.tsx` : `title: 'Politique de confidentialité'`, `robots: { index: false, follow: false }`

- [ ] **Step 5: Vérifier la compilation TypeScript**

Run: `npx tsc --noEmit`
Expected: 0 erreurs nouvelles (les 2 erreurs pré-existantes dans `app/admin/commandes` et `app/layout.tsx` Geist sont acceptables)

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx app/page.tsx app/boutique/page.tsx app/realisations/page.tsx app/atelier/page.tsx app/cgv/page.tsx app/mentions-legales/page.tsx app/politique-de-confidentialite/page.tsx
git commit -m "feat(seo): add metadata and JsonLd Organization to all static pages"
```

---

### Task 3: Page produit — metadata enrichie + JSON-LD

**Files:**
- Modify: `app/boutique/[slug]/page.tsx`
- Test: `app/boutique/__tests__/product-metadata.test.ts` (nouveau fichier — ne pas modifier `boutique.test.tsx`)

**Interfaces:**
- Consumes: `SITE_URL`, `SITE_NAME`, `DEFAULT_OG_IMAGE` from T1
- Consumes: `JsonLd` from T1
- Consumes: `getProductBySlug(slug: string): Promise<ProductWithPhotos | null>` — déjà importé dans la page
- Produces: `generateMetadata` enrichi, JSON-LD `Product` + `BreadcrumbList` dans le RSC

- [ ] **Step 1: Écrire les tests échouants**

```ts
// app/boutique/__tests__/product-metadata.test.ts
import { describe, it, expect, vi } from 'vitest'

const mockProduct = {
  id: '1', slug: 'table-basse', name: 'Table basse', description: 'Une belle table.',
  price_cents: 45000, shipping_price_cents: 2000,
  product_photos: [{ id: 'p1', url: 'https://example.com/photo.jpg', position: 0 }],
}

vi.mock('@/lib/data/products', () => ({
  getProductBySlug: vi.fn().mockResolvedValue(mockProduct),
}))
vi.mock('@/lib/seo/config', () => ({
  SITE_URL: 'https://auguste-woodworking.fr',
  SITE_NAME: 'Auguste Woodworking',
  DEFAULT_OG_IMAGE: 'https://auguste-woodworking.fr/og-default.jpg',
}))

import { generateMetadata } from '../[slug]/page'

describe('generateMetadata', () => {
  it('returns product title', async () => {
    const meta = await generateMetadata({ params: { slug: 'table-basse' } })
    expect(meta.title).toBe('Table basse')
  })

  it('uses product photo as OG image', async () => {
    const meta = await generateMetadata({ params: { slug: 'table-basse' } })
    const og = meta.openGraph as { images: { url: string }[] }
    expect(og.images[0].url).toBe('https://example.com/photo.jpg')
  })

  it('falls back to DEFAULT_OG_IMAGE when product has no photos', async () => {
    const { getProductBySlug } = await import('@/lib/data/products')
    vi.mocked(getProductBySlug).mockResolvedValueOnce({ ...mockProduct, product_photos: [] })
    const meta = await generateMetadata({ params: { slug: 'table-basse' } })
    const og = meta.openGraph as { images: { url: string }[] }
    expect(og.images[0].url).toBe('https://auguste-woodworking.fr/og-default.jpg')
  })

  it('falls back to default description when product has no description', async () => {
    const { getProductBySlug } = await import('@/lib/data/products')
    vi.mocked(getProductBySlug).mockResolvedValueOnce({ ...mockProduct, description: null })
    const meta = await generateMetadata({ params: { slug: 'table-basse' } })
    expect(meta.description).toBe('Objet en bois fait à la main par Auguste Woodworking.')
  })

  it('returns fallback title when product not found', async () => {
    const { getProductBySlug } = await import('@/lib/data/products')
    vi.mocked(getProductBySlug).mockResolvedValueOnce(null)
    const meta = await generateMetadata({ params: { slug: 'introuvable' } })
    expect(meta.title).toBe('Produit introuvable | Auguste Woodworking')
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npx vitest run app/boutique/__tests__/product-metadata.test.ts`
Expected: FAIL — les assertions OG échouent (le `generateMetadata` actuel ne retourne que `title`)

- [ ] **Step 3: Enrichir `generateMetadata` dans `app/boutique/[slug]/page.tsx`**

Remplacer le `generateMetadata` existant. Quand le produit est trouvé :
- `title`: `product.name`
- `description`: `product.description?.slice(0, 155) ?? 'Objet en bois fait à la main par Auguste Woodworking.'`
- `openGraph`: `{ title: \`${product.name} | ${SITE_NAME}\`, description, url: \`${SITE_URL}/boutique/${product.slug}\`, images: [{ url: product.product_photos[0]?.url ?? DEFAULT_OG_IMAGE, width: 1200, height: 630 }] }`
- `twitter`: `{ card: 'summary_large_image', title: \`${product.name} | ${SITE_NAME}\`, description, images: [product.product_photos[0]?.url ?? DEFAULT_OG_IMAGE] }`
- `alternates`: `{ canonical: \`${SITE_URL}/boutique/${product.slug}\` }`

Quand le produit est introuvable : `{ title: \`Produit introuvable | ${SITE_NAME}\` }`

- [ ] **Step 4: Ajouter les JSON-LD dans le RSC `ProductPage`**

Dans le JSX retourné (après le `notFound()`), ajouter deux `<JsonLd>` avant le `<div>` principal :

`Product` :
```ts
{
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: product.name,
  description: product.description ?? 'Objet en bois fait à la main par Auguste Woodworking.',
  image: product.product_photos[0]?.url ?? DEFAULT_OG_IMAGE,
  offers: {
    '@type': 'Offer',
    price: (product.price_cents / 100).toFixed(2),
    priceCurrency: 'EUR',
    availability: 'https://schema.org/InStock',
  },
}
```

`BreadcrumbList` :
```ts
{
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Boutique', item: `${SITE_URL}/boutique` },
    { '@type': 'ListItem', position: 3, name: product.name, item: `${SITE_URL}/boutique/${product.slug}` },
  ],
}
```

- [ ] **Step 5: Lancer les tests pour vérifier le passage**

Run: `npx vitest run app/boutique/__tests__/product-metadata.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 6: Commit**

```bash
git add app/boutique/[slug]/page.tsx app/boutique/__tests__/product-metadata.test.ts
git commit -m "feat(seo): enrich product page metadata and add JSON-LD Product + BreadcrumbList"
```

---

### Task 4: Sitemap + robots

**Files:**
- Create: `app/sitemap.ts`
- Create: `app/robots.ts`
- Test: `app/__tests__/sitemap.test.ts`

**Interfaces:**
- Consumes: `SITE_URL` from T1
- Consumes: `getPublishedProducts(): Promise<ProductWithPhotos[]>` from `@/lib/data/products`
- Produces: `/sitemap.xml` (Next.js `MetadataRoute.Sitemap`), `/robots.txt` (Next.js `MetadataRoute.Robots`)

- [ ] **Step 1: Écrire les tests échouants**

```ts
// app/__tests__/sitemap.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/seo/config', () => ({ SITE_URL: 'https://auguste-woodworking.fr' }))
vi.mock('@/lib/data/products', () => ({
  getPublishedProducts: vi.fn().mockResolvedValue([
    { slug: 'table-basse', product_photos: [] },
    { slug: 'etagere', product_photos: [] },
  ]),
}))

import sitemap from '../sitemap'

describe('sitemap', () => {
  it('includes all four static routes', async () => {
    const entries = await sitemap()
    const urls = entries.map((e) => e.url)
    expect(urls).toContain('https://auguste-woodworking.fr')
    expect(urls).toContain('https://auguste-woodworking.fr/boutique')
    expect(urls).toContain('https://auguste-woodworking.fr/realisations')
    expect(urls).toContain('https://auguste-woodworking.fr/atelier')
  })

  it('includes published product slugs', async () => {
    const entries = await sitemap()
    const urls = entries.map((e) => e.url)
    expect(urls).toContain('https://auguste-woodworking.fr/boutique/table-basse')
    expect(urls).toContain('https://auguste-woodworking.fr/boutique/etagere')
  })

  it('does not include admin or legal routes', async () => {
    const entries = await sitemap()
    const urls = entries.map((e) => e.url)
    expect(urls.every((u) => !u.includes('/admin'))).toBe(true)
    expect(urls.every((u) => !u.includes('/cgv'))).toBe(true)
  })

  it('returns static routes only when getPublishedProducts throws', async () => {
    const { getPublishedProducts } = await import('@/lib/data/products')
    vi.mocked(getPublishedProducts).mockRejectedValueOnce(new Error('db error'))
    const entries = await sitemap()
    const urls = entries.map((e) => e.url)
    expect(urls).toContain('https://auguste-woodworking.fr')
    expect(urls.length).toBeGreaterThanOrEqual(4)
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npx vitest run app/__tests__/sitemap.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implémenter `app/sitemap.ts`**

Signature : `export default async function sitemap(): Promise<MetadataRoute.Sitemap>`

Routes statiques (dans un tableau `const staticRoutes`) :
- `{ url: SITE_URL, priority: 1.0, changeFrequency: 'weekly' as const }`
- `{ url: \`${SITE_URL}/boutique\`, priority: 0.9, changeFrequency: 'weekly' as const }`
- `{ url: \`${SITE_URL}/realisations\`, priority: 0.8, changeFrequency: 'monthly' as const }`
- `{ url: \`${SITE_URL}/atelier\`, priority: 0.7, changeFrequency: 'monthly' as const }`

Routes dynamiques : appeler `getPublishedProducts()` dans un `try/catch` — en cas d'erreur, `console.error` et retourner `staticRoutes`. En cas de succès, mapper chaque produit vers `{ url: \`${SITE_URL}/boutique/${product.slug}\`, priority: 0.8, changeFrequency: 'weekly' as const }` et concaténer avec `staticRoutes`.

- [ ] **Step 4: Implémenter `app/robots.ts`**

Signature : `export default function robots(): MetadataRoute.Robots`

```ts
return {
  rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api'] }],
  sitemap: `${SITE_URL}/sitemap.xml`,
}
```

- [ ] **Step 5: Lancer les tests pour vérifier le passage**

Run: `npx vitest run app/__tests__/sitemap.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 6: Lancer la suite complète**

Run: `npx vitest run`
Expected: PASS — toute la suite sans régression

- [ ] **Step 7: Commit**

```bash
git add app/sitemap.ts app/robots.ts app/__tests__/sitemap.test.ts
git commit -m "feat(seo): add dynamic sitemap and robots.txt"
```
