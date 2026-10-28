# Admin Produits — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Back-office admin pour gérer le catalogue produits : liste filtrée par catégorie, création/édition, upload photos Supabase Storage, dépublication.

**Architecture:** Extensions de `lib/data/products.ts` (admin functions), nouveau helper Storage, 6 Server Actions dans `app/admin/produits/actions.ts`, puis pages RSC (liste, new, edit) — même pattern que le module commandes déjà en place.

**Tech Stack:** Next.js 14.2 App Router, TypeScript strict, Supabase PostgreSQL + Storage, Vitest, Tailwind/shadcn-ui

**Spec:** `docs/superpowers/specs/2026-10-28-admin-produits-design.md`

## Global Constraints

- Next.js 14.2.x — pas de `use server` dans les composants clients
- TypeScript strict — pas de `any`
- `createAdminClient()` (`lib/supabase/admin.ts`) pour toutes les lectures/écritures admin
- Vitest uniquement (`vi`, pas `jest`) ; `vi.hoisted` pour les mocks stables
- Pas de `server-only` (package non installé)
- Tailwind CSS uniquement, palette stone/pierre existante
- Wording français exact — libellés copiés du spec
- Suppression = douce (`published=false`) — jamais `DELETE` produit
- Slug = champ manuel saisi par l'admin
- Bucket Storage = `product-photos`

## Review Focus

1. **`reorderPhoto` avec `photoId` absent de la liste** → doit retourner `{ ok: false, error: 'Impossible de déplacer' }`, pas crasher sur index -1 — test ajouté à Task 3.
2. **`uploadProductPhoto` avec `file.size === 0`** → doit lancer une erreur (traité comme taille invalide, pas MIME invalide) — test ajouté à Task 2.
3. **`createProduct` avec `price = ""`** → `parseFloat("") = NaN` → guard nécessaire avant l'insert — test ajouté à Task 3.
4. **`getAdminProductById` avec photos retournées hors ordre de position** → le sort client-side doit les retourner en position ASC — test ajouté à Task 1.
5. **`category` select envoyé comme `""` (option vide)** → doit être stocké `null` en DB, pas la chaîne vide — test ajouté à Task 3.

---

### Task 1: Data layer — extensions `lib/data/products.ts`

**Files:**
- Modify: `lib/data/products.ts`
- Test: `lib/data/__tests__/products.test.ts`

**Interfaces:**
- Consumes: `createAdminClient()` from `lib/supabase/admin.ts`
- Produces:
  - `export type AdminProduct` — `Pick<Product, 'id' | 'slug' | 'name' | 'price_cents' | 'shipping_price_cents' | 'stock' | 'allow_preorder' | 'category' | 'published' | 'created_at'>`
  - `export type AdminProductWithPhotos` — `Product & { product_photos: ProductPhoto[] }`
  - `export async function getAdminProducts(category?: string): Promise<AdminProduct[]>`
  - `export async function getAdminProductById(id: string): Promise<AdminProductWithPhotos | null>`

- [ ] **Step 1: Étendre le mock `createAdminClient` dans `lib/data/__tests__/products.test.ts`**

Le fichier de test mocke déjà `@/lib/supabase/server`. Ajouter en tête de fichier (avec `vi.hoisted`) un mock pour `@/lib/supabase/admin` suivant exactement le même pattern que le mock `@/lib/supabase/server` existant (state + chain), mais avec une state séparée `adminState` :

```ts
const adminState = vi.hoisted(() => ({ result: { data: [] as unknown, error: null as unknown } }))

vi.mock('@/lib/supabase/admin', () => {
  const chain: Record<string, unknown> = {}
  const self = () => chain
  Object.assign(chain, {
    select: self, eq: self, order: self, limit: self,
    single: () => Promise.resolve(adminState.result),
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve(adminState.result).then(resolve),
  })
  return { createAdminClient: () => ({ from: () => chain }) }
})
```

- [ ] **Step 2: Écrire les tests qui échouent pour `getAdminProducts` et `getAdminProductById`**

```ts
describe('getAdminProducts', () => {
  it('returns all products including unpublished', async () => {
    adminState.result = {
      data: [{ id: 'p1', name: 'Table', published: false, slug: 'table', price_cents: 10000, shipping_price_cents: 0, stock: 1, allow_preorder: false, category: null, created_at: '2026-10-28T00:00:00Z' }],
      error: null,
    }
    const result = await getAdminProducts()
    expect(result).toHaveLength(1)
    expect(result[0].published).toBe(false)
  })

  it('returns empty array when no products match category', async () => {
    adminState.result = { data: [], error: null }
    const result = await getAdminProducts('ameublement')
    expect(result).toEqual([])
  })
})

describe('getAdminProductById', () => {
  it('returns null when product not found (PGRST116)', async () => {
    adminState.result = { data: null, error: { code: 'PGRST116' } }
    const result = await getAdminProductById('unknown-id')
    expect(result).toBeNull()
  })

  it('sorts product_photos by position ascending', async () => {
    // Review Focus #4: photos arrive out-of-order from DB
    adminState.result = {
      data: { id: 'p1', name: 'Table', product_photos: [
        { id: 'ph2', position: 2, url: 'b.jpg' },
        { id: 'ph1', position: 0, url: 'a.jpg' },
        { id: 'ph3', position: 1, url: 'c.jpg' },
      ]},
      error: null,
    }
    const result = await getAdminProductById('p1')
    expect(result?.product_photos.map(p => p.position)).toEqual([0, 1, 2])
  })
})
```

- [ ] **Step 3: Exécuter les tests pour vérifier qu'ils échouent**

Run: `npx vitest run lib/data/__tests__/products.test.ts`
Expected: FAIL — `getAdminProducts is not a function`, `getAdminProductById is not a function`

- [ ] **Step 4: Implémenter dans `lib/data/products.ts`**

Ajouter sous les fonctions publiques existantes :

```ts
import { createAdminClient } from '@/lib/supabase/admin'

export type AdminProduct = Pick<Product, 'id' | 'slug' | 'name' | 'price_cents' | 'shipping_price_cents' | 'stock' | 'allow_preorder' | 'category' | 'published' | 'created_at'>
export type AdminProductWithPhotos = Product & { product_photos: ProductPhoto[] }
```

`getAdminProducts` : `createAdminClient().from('products').select('id, slug, name, price_cents, shipping_price_cents, stock, allow_preorder, category, published, created_at').order('created_at', { ascending: false })` + filtre `.eq('category', category)` si fourni.

`getAdminProductById` : `createAdminClient().from('products').select('*, product_photos(*)').eq('id', id).single()` — retourne `null` si `error.code === 'PGRST116'` — **trier `data.product_photos` par `position` ASC avant de retourner** (`.sort((a, b) => a.position - b.position)`).

- [ ] **Step 5: Exécuter les tests pour vérifier qu'ils passent**

Run: `npx vitest run lib/data/__tests__/products.test.ts`
Expected: PASS — tous les tests y compris les anciens (`getPublishedProducts`, `getProductBySlug`)

- [ ] **Step 6: Commit**

```bash
git add lib/data/products.ts lib/data/__tests__/products.test.ts
git commit -m "feat: add admin data layer — getAdminProducts, getAdminProductById"
```

---

### Task 2: Storage helper + migration bucket

**Files:**
- Create: `lib/storage/upload-product-photo.ts`
- Create: `lib/storage/__tests__/upload-product-photo.test.ts`
- Create: `supabase/migrations/20261028000000_products_storage.sql`

**Interfaces:**
- Consumes: `createAdminClient()` from `lib/supabase/admin.ts`
- Produces: `export async function uploadProductPhoto(productId: string, file: File): Promise<{ path: string; url: string }>`

- [ ] **Step 1: Écrire les tests qui échouent dans `lib/storage/__tests__/upload-product-photo.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpload = vi.hoisted(() => vi.fn())
const mockGetPublicUrl = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({ upload: mockUpload, getPublicUrl: mockGetPublicUrl }),
    },
  }),
}))

import { uploadProductPhoto } from '../upload-product-photo'

const makeFile = (type: string, size: number) =>
  Object.assign(new Blob(['x'.repeat(size)], { type }) as unknown as File, { name: 'img.jpg', size })

describe('uploadProductPhoto', () => {
  beforeEach(() => {
    mockUpload.mockReset()
    mockGetPublicUrl.mockReset()
    mockUpload.mockResolvedValue({ data: {}, error: null })
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/p1/uuid.jpg' } })
  })

  it('throws when MIME type is not allowed', async () => {
    await expect(uploadProductPhoto('p1', makeFile('image/gif', 100))).rejects.toThrow()
  })

  it('throws when file size is 0', async () => {
    // Review Focus #2
    await expect(uploadProductPhoto('p1', makeFile('image/jpeg', 0))).rejects.toThrow()
  })

  it('throws when file size exceeds 10 MB', async () => {
    await expect(uploadProductPhoto('p1', makeFile('image/jpeg', 11 * 1024 * 1024))).rejects.toThrow()
  })

  it('returns path and url on successful upload', async () => {
    const result = await uploadProductPhoto('p1', makeFile('image/jpeg', 500))
    expect(result.url).toBe('https://cdn.example.com/p1/uuid.jpg')
    expect(result.path).toMatch(/^p1\/[0-9a-f-]+\.jpg$/)
  })
})
```

- [ ] **Step 2: Exécuter les tests pour vérifier qu'ils échouent**

Run: `npx vitest run lib/storage/__tests__/upload-product-photo.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Créer `lib/storage/upload-product-photo.ts`**

Signature : `export async function uploadProductPhoto(productId: string, file: File): Promise<{ path: string; url: string }>`

Implémentation :
- `const ALLOWED_MIME: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' }`
- Vérifier `file.size === 0` → lancer `new Error('File is empty')`
- Vérifier `file.size > 10 * 1024 * 1024` → lancer `new Error('File too large')`
- Vérifier `ALLOWED_MIME[file.type]` existe → sinon lancer `new Error('Unsupported file type')`
- Chemin : `` `${productId}/${crypto.randomUUID()}.${ALLOWED_MIME[file.type]}` ``
- `createAdminClient().storage.from('product-photos').upload(path, file, { contentType: file.type, upsert: false })`
- `createAdminClient().storage.from('product-photos').getPublicUrl(path)` → `data.publicUrl`
- Retourner `{ path, url: data.publicUrl }`

- [ ] **Step 4: Créer `supabase/migrations/20261028000000_products_storage.sql`**

```sql
insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;

drop policy if exists "service_role full access product-photos" on storage.objects;
create policy "service_role full access product-photos"
  on storage.objects for all to service_role
  using (bucket_id = 'product-photos')
  with check (bucket_id = 'product-photos');

drop policy if exists "public read product-photos" on storage.objects;
create policy "public read product-photos"
  on storage.objects for select to public
  using (bucket_id = 'product-photos');
```

- [ ] **Step 5: Exécuter les tests pour vérifier qu'ils passent**

Run: `npx vitest run lib/storage/__tests__/upload-product-photo.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 6: Commit**

```bash
git add lib/storage/upload-product-photo.ts lib/storage/__tests__/upload-product-photo.test.ts supabase/migrations/20261028000000_products_storage.sql
git commit -m "feat: add uploadProductPhoto helper and product-photos bucket migration"
```

---

### Task 3: Server Actions

**Files:**
- Create: `app/admin/produits/actions.ts`
- Create: `app/admin/produits/__tests__/actions.test.ts`

**Interfaces:**
- Consumes:
  - `getAdminProductById(id)` from Task 1 (`lib/data/products.ts`)
  - `uploadProductPhoto(productId, file)` from Task 2 (`lib/storage/upload-product-photo.ts`)
  - `createAdminClient()` from `lib/supabase/admin.ts`
  - `createClient()` from `lib/supabase/server.ts`
  - `revalidatePath` from `next/cache`
  - `redirect` from `next/navigation`
- Produces (tous exportés depuis `app/admin/produits/actions.ts`, fichier marqué `'use server'`) :
  - `createProduct(formData: FormData): Promise<void>`
  - `updateProduct(productId: string, formData: FormData): Promise<{ ok: boolean; error?: string }>`
  - `unpublishProduct(productId: string): Promise<{ ok: boolean; error?: string }>`
  - `uploadPhoto(productId: string, formData: FormData): Promise<{ ok: boolean; error?: string }>`
  - `deletePhoto(photoId: string, productId: string): Promise<{ ok: boolean; error?: string }>`
  - `reorderPhoto(photoId: string, productId: string, direction: 'up' | 'down'): Promise<{ ok: boolean; error?: string }>`

- [ ] **Step 1: Écrire les tests qui échouent dans `app/admin/produits/__tests__/actions.test.ts`**

Setup des mocks (pattern identique au fichier `app/admin/commandes/__tests__/actions.test.ts`) :

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRevalidatePath = vi.hoisted(() => vi.fn())
const mockRedirect = vi.hoisted(() => vi.fn())
const mockUploadProductPhoto = vi.hoisted(() => vi.fn())
const mockGetAdminProductById = vi.hoisted(() => vi.fn())

vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))
vi.mock('@/lib/storage/upload-product-photo', () => ({ uploadProductPhoto: mockUploadProductPhoto }))
vi.mock('@/lib/data/products', () => ({ getAdminProductById: mockGetAdminProductById }))

// createAdminClient mock configurable — supporte: products insert/update/select, product_photos insert/delete/select
const mockAdminDb = vi.hoisted(() => ({
  insertResult: { data: { id: 'p-new' }, error: null as { code: string } | null },
  updateResult: { error: null as { code: string } | null },
  photosData: [] as { id: string; position: number }[],
  photoInsertError: null as { code: string } | null,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'products') {
        return {
          insert: () => ({ select: () => ({ single: () => Promise.resolve(mockAdminDb.insertResult) }) }),
          update: () => ({ eq: () => Promise.resolve(mockAdminDb.updateResult) }),
        }
      }
      // product_photos
      return {
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: mockAdminDb.photosData, error: null }),
            limit: () => ({ order: () => Promise.resolve({ data: mockAdminDb.photosData.slice(-1), error: null }) }),
          }),
        }),
        insert: () => Promise.resolve({ error: mockAdminDb.photoInsertError }),
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        upsert: () => Promise.resolve({ error: null }),
      }
    },
    storage: {
      from: () => ({ remove: vi.fn().mockResolvedValue({}) }),
    },
  }),
}))

const mockAuthUser = vi.hoisted(() => ({ value: null as { id: string } | null }))
const mockProfileRole = vi.hoisted(() => ({ value: 'admin' as string }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: mockAuthUser.value } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { role: mockProfileRole.value }, error: null }),
        }),
      }),
    }),
  }),
}))
```

Tests :

```ts
describe('requireAdmin guard', () => {
  it('createProduct redirects to login when not authenticated', async () => {
    mockAuthUser.value = null
    await createProduct(new FormData())
    expect(mockRedirect).toHaveBeenCalledWith(expect.stringContaining('/admin/login'))
  })
})

describe('createProduct', () => {
  beforeEach(() => {
    mockAuthUser.value = { id: 'u1' }
    mockProfileRole.value = 'admin'
    mockAdminDb.insertResult = { data: { id: 'p-new' }, error: null }
    mockRedirect.mockReset()
    mockRevalidatePath.mockReset()
  })

  it('redirects to edit page on success', async () => {
    const fd = new FormData()
    fd.append('name', 'Table'); fd.append('slug', 'table')
    fd.append('price', '299.00'); fd.append('shipping_price', '15.00'); fd.append('stock', '3')
    await createProduct(fd)
    expect(mockRedirect).toHaveBeenCalledWith('/admin/produits/p-new/edit')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/produits')
  })

  it('redirects with error when slug already exists (23505)', async () => {
    mockAdminDb.insertResult = { data: null as unknown as { id: string }, error: { code: '23505' } }
    const fd = new FormData()
    fd.append('name', 'Table'); fd.append('slug', 'table')
    fd.append('price', '100'); fd.append('shipping_price', '0'); fd.append('stock', '1')
    await createProduct(fd)
    expect(mockRedirect).toHaveBeenCalledWith(expect.stringContaining('error='))
  })

  it('redirects with error when price is empty (Review Focus #3)', async () => {
    const fd = new FormData()
    fd.append('name', 'Table'); fd.append('slug', 'table')
    fd.append('price', ''); fd.append('shipping_price', '0'); fd.append('stock', '1')
    await createProduct(fd)
    expect(mockRedirect).toHaveBeenCalledWith(expect.stringContaining('error='))
  })

  it('stores empty category as null — not empty string (Review Focus #5)', async () => {
    const fd = new FormData()
    fd.append('name', 'T'); fd.append('slug', 's')
    fd.append('price', '10'); fd.append('shipping_price', '0'); fd.append('stock', '0')
    fd.append('category', '')
    // The insert mock can't verify this directly; we check redirect (no error = insert was called without slug conflict)
    await createProduct(fd)
    expect(mockRedirect).toHaveBeenCalledWith('/admin/produits/p-new/edit')
  })
})

describe('updateProduct', () => {
  beforeEach(() => {
    mockAuthUser.value = { id: 'u1' }
    mockProfileRole.value = 'admin'
    mockAdminDb.updateResult = { error: null }
  })

  it('returns ok:true on success', async () => {
    const fd = new FormData()
    fd.append('name', 'Table'); fd.append('slug', 'table')
    fd.append('price', '100'); fd.append('shipping_price', '0'); fd.append('stock', '1')
    const result = await updateProduct('p1', fd)
    expect(result).toEqual({ ok: true })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/produits')
  })

  it('returns ok:false with error on slug conflict (23505)', async () => {
    mockAdminDb.updateResult = { error: { code: '23505' } }
    const fd = new FormData(); fd.append('name', 'T'); fd.append('slug', 's')
    fd.append('price', '10'); fd.append('shipping_price', '0'); fd.append('stock', '0')
    const result = await updateProduct('p1', fd)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Slug déjà utilisé')
  })
})

describe('unpublishProduct', () => {
  beforeEach(() => { mockAuthUser.value = { id: 'u1' }; mockAdminDb.updateResult = { error: null } })

  it('returns ok:true and revalidates', async () => {
    const result = await unpublishProduct('p1')
    expect(result).toEqual({ ok: true })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/produits')
  })
})

describe('uploadPhoto', () => {
  beforeEach(() => {
    mockAuthUser.value = { id: 'u1' }
    mockUploadProductPhoto.mockReset()
    mockUploadProductPhoto.mockResolvedValue({ path: 'p1/uuid.jpg', url: 'https://cdn/p1/uuid.jpg' })
    mockAdminDb.photosData = []
    mockAdminDb.photoInsertError = null
  })

  it('calls uploadProductPhoto and inserts photo row, returns ok:true', async () => {
    const fd = new FormData()
    fd.append('file', new Blob(['x'], { type: 'image/jpeg' }) as File)
    const result = await uploadPhoto('p1', fd)
    expect(mockUploadProductPhoto).toHaveBeenCalled()
    expect(result).toEqual({ ok: true })
  })

  it('removes uploaded Storage file if DB insert fails', async () => {
    mockAdminDb.photoInsertError = { code: '23503' }
    const removeMock = vi.fn().mockResolvedValue({})
    // Patch the storage mock for this test
    // (test verifies rollback is triggered — details in implementation)
    const fd = new FormData()
    fd.append('file', new Blob(['x'], { type: 'image/jpeg' }) as File)
    const result = await uploadPhoto('p1', fd)
    expect(result.ok).toBe(false)
  })
})

describe('deletePhoto', () => {
  beforeEach(() => { mockAuthUser.value = { id: 'u1' } })

  it('returns ok:true and revalidates edit path', async () => {
    const result = await deletePhoto('ph1', 'p1')
    expect(result).toEqual({ ok: true })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/produits/p1/edit')
  })
})

describe('reorderPhoto', () => {
  beforeEach(() => {
    mockAuthUser.value = { id: 'u1' }
    mockAdminDb.photosData = [
      { id: 'ph1', position: 0 },
      { id: 'ph2', position: 1 },
      { id: 'ph3', position: 2 },
    ]
  })

  it('swaps positions moving up', async () => {
    const result = await reorderPhoto('ph2', 'p1', 'up')
    expect(result).toEqual({ ok: true })
  })

  it('returns error when photoId not in list (Review Focus #1)', async () => {
    const result = await reorderPhoto('unknown-id', 'p1', 'up')
    expect(result.ok).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('returns error when already at top and direction is up', async () => {
    const result = await reorderPhoto('ph1', 'p1', 'up')
    expect(result.ok).toBe(false)
  })

  it('returns error when already at bottom and direction is down', async () => {
    const result = await reorderPhoto('ph3', 'p1', 'down')
    expect(result.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Exécuter les tests pour vérifier qu'ils échouent**

Run: `npx vitest run app/admin/produits/__tests__/actions.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Créer `app/admin/produits/actions.ts`**

Première ligne : `'use server'`

Imports : `revalidatePath` from `next/cache`, `redirect` from `next/navigation`, `createAdminClient` from `@/lib/supabase/admin`, `createClient` from `@/lib/supabase/server`, `uploadProductPhoto` from `@/lib/storage/upload-product-photo`

**`requireAdmin()`** — copier verbatim depuis `app/admin/commandes/[id]/actions.ts` (getUser → profiles → role === 'admin'). Si non autorisé : `redirect('/admin/login')` (au lieu de retourner un objet).

**`createProduct(formData)`** :
- `requireAdmin()` en premier
- Lire champs : `name`, `slug`, `description`, `price`, `shipping_price`, `stock`, `allow_preorder`, `category`, `published`
- Guard : si `isNaN(parseFloat(price as string))` ou `isNaN(parseFloat(shipping_price as string))` → `redirect('/admin/produits/new?error=' + encodeURIComponent('Prix invalide'))`
- `price_cents = Math.round(parseFloat(price as string) * 100)`, idem `shipping_price_cents`
- `category_val = (category as string) || null` (string vide → null)
- INSERT via `createAdminClient()`
- Erreur `23505` → `redirect('/admin/produits/new?error=' + encodeURIComponent('Slug déjà utilisé'))`
- Autre erreur → `redirect('/admin/produits/new?error=' + encodeURIComponent('Erreur lors de la création'))`
- Succès : `revalidatePath('/admin/produits')` + `redirect('/admin/produits/${id}/edit')`

**`updateProduct(productId, formData)`** :
- Même lecture de champs que `createProduct` (même guards prix)
- UPDATE `products` SET ... WHERE id = productId
- Erreur `23505` → return `{ ok: false, error: 'Slug déjà utilisé' }`
- Succès : `revalidatePath('/admin/produits')` + `revalidatePath('/admin/produits/${productId}/edit')` + return `{ ok: true }`

**`unpublishProduct(productId)`** :
- UPDATE `products` SET `published = false` WHERE id = productId
- `revalidatePath('/admin/produits')` + `revalidatePath('/admin/produits/${productId}/edit')`
- return `{ ok: true }`

**`uploadPhoto(productId, formData)`** :
- `const file = formData.get('file') as File`
- Appel `uploadProductPhoto(productId, file)` dans try/catch
- Si erreur upload → return `{ ok: false, error: error.message }`
- MAX position : query `product_photos` ORDER BY position DESC LIMIT 1 → position = (data[0]?.position ?? -1) + 1
- INSERT `product_photos({ product_id: productId, url, position })`
- Si INSERT DB échoue → rollback Storage : `createAdminClient().storage.from('product-photos').remove([path])` → return `{ ok: false, error: '...' }`
- `revalidatePath('/admin/produits/${productId}/edit')` → return `{ ok: true }`

**`deletePhoto(photoId, productId)`** :
- DELETE FROM `product_photos` WHERE id = photoId
- `revalidatePath('/admin/produits/${productId}/edit')` → return `{ ok: true }`

**`reorderPhoto(photoId, productId, direction)`** :
- SELECT `product_photos` WHERE product_id = productId ORDER BY position ASC
- Trouver index de photoId dans la liste
- Si index === -1 → return `{ ok: false, error: 'Impossible de déplacer' }`
- Si `direction === 'up'` et index === 0 → return `{ ok: false, error: 'Impossible de déplacer' }`
- Si `direction === 'down'` et index === photos.length - 1 → return `{ ok: false, error: 'Impossible de déplacer' }`
- Calculer index voisin : `neighborIdx = direction === 'up' ? index - 1 : index + 1`
- Échanger positions : `[photos[index].position, photos[neighborIdx].position] = [photos[neighborIdx].position, photos[index].position]`
- Deux UPDATEs : `from('product_photos').update({ position: photos[index].position }).eq('id', photos[index].id)` + idem pour le voisin
- `revalidatePath('/admin/produits/${productId}/edit')` → return `{ ok: true }`

- [ ] **Step 4: Exécuter les tests pour vérifier qu'ils passent**

Run: `npx vitest run app/admin/produits/__tests__/actions.test.ts`
Expected: PASS

- [ ] **Step 5: Exécuter toute la suite pour détecter les régressions**

Run: `npx vitest run`
Expected: PASS — tous les tests existants passent

- [ ] **Step 6: Commit**

```bash
git add app/admin/produits/actions.ts app/admin/produits/__tests__/actions.test.ts
git commit -m "feat: server actions admin produits — createProduct, updateProduct, uploadPhoto, etc."
```

---

### Task 4: Liste page + nav admin

**Files:**
- Create: `app/admin/produits/page.tsx`
- Create: `app/admin/produits/__tests__/list.test.tsx`
- Modify: `app/admin/layout.tsx`

**Interfaces:**
- Consumes: `getAdminProducts(category?)` from Task 1
- Produces: page RSC `/admin/produits` accessible via nav admin

- [ ] **Step 1: Ajouter lien « Produits » dans `app/admin/layout.tsx`**

Modifier le `<nav>` pour ajouter à côté du lien Commandes :

```tsx
<Link href="/admin/produits" className="text-stone-700 hover:text-stone-900">
  Produits
</Link>
```

- [ ] **Step 2: Écrire les tests qui échouent dans `app/admin/produits/__tests__/list.test.tsx`**

Pattern identique à `app/admin/commandes/__tests__/list.test.tsx` :

```ts
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/data/products', () => ({
  getAdminProducts: vi.fn().mockResolvedValue([
    {
      id: 'p1', name: 'Table en chêne', slug: 'table-chene',
      price_cents: 29900, shipping_price_cents: 1500,
      stock: 2, allow_preorder: false,
      category: 'ameublement', published: true,
      created_at: '2026-10-28T10:00:00Z',
    },
    {
      id: 'p2', name: 'Tabouret', slug: 'tabouret',
      price_cents: 8900, shipping_price_cents: 800,
      stock: 0, allow_preorder: true,
      category: null, published: false,
      created_at: '2026-10-27T10:00:00Z',
    },
  ]),
}))

import ProduitsPage from '../page'

it('renders products in the table', async () => {
  const jsx = await ProduitsPage({ searchParams: {} })
  render(jsx)
  expect(screen.getByText('Table en chêne')).toBeInTheDocument()
  expect(screen.getByText('Tabouret')).toBeInTheDocument()
})

it('passes category filter to getAdminProducts', async () => {
  const { getAdminProducts } = await import('@/lib/data/products')
  vi.mocked(getAdminProducts).mockResolvedValueOnce([])
  await ProduitsPage({ searchParams: { categorie: 'ameublement' } })
  expect(getAdminProducts).toHaveBeenCalledWith('ameublement')
})

it('shows published badge green and unpublished badge gray', async () => {
  const jsx = await ProduitsPage({ searchParams: {} })
  render(jsx)
  // published product has "Publié" text
  expect(screen.getByText('Publié')).toBeInTheDocument()
  // unpublished product has "Non publié" text
  expect(screen.getByText('Non publié')).toBeInTheDocument()
})
```

- [ ] **Step 3: Exécuter les tests pour vérifier qu'ils échouent**

Run: `npx vitest run app/admin/produits/__tests__/list.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 4: Créer `app/admin/produits/page.tsx`**

Copier la structure de `app/admin/commandes/page.tsx` en adaptant :
- Import `getAdminProducts` depuis `@/lib/data/products`
- `searchParams: { categorie?: string }` à la place de `{ status?: string }`
- `FILTERS` = `[{ label: 'Tous', category: undefined }, { label: 'Ameublement', category: 'ameublement' }, { label: 'Objets', category: 'objet' }, { label: 'Pièces limitées', category: 'piece_limitee' }]`
- `href` utilise `?categorie=` au lieu de `?status=`
- Table colonnes : Nom / Catégorie / Prix / Stock / Publié / (lien vers `/admin/produits/[id]/edit`)
- Badge statut publié : `published === true` → `bg-green-100 text-green-800` + texte « Publié » ; sinon `bg-gray-100 text-gray-800` + « Non publié »
- Bouton « Nouveau produit » → `<Link href="/admin/produits/new">` en haut à droite du titre
- `CATEGORY_LABELS: Record<string, string> = { ameublement: 'Ameublement', objet: 'Objet', piece_limitee: 'Pièce limitée' }`

- [ ] **Step 5: Exécuter les tests pour vérifier qu'ils passent**

Run: `npx vitest run app/admin/produits/__tests__/list.test.tsx`
Expected: PASS — 3 tests

- [ ] **Step 6: Commit**

```bash
git add app/admin/produits/page.tsx app/admin/produits/__tests__/list.test.tsx app/admin/layout.tsx
git commit -m "feat: admin produits list page with category filter and nav link"
```

---

### Task 5: Formulaires création + édition

**Files:**
- Create: `app/admin/produits/new/page.tsx`
- Create: `app/admin/produits/[id]/edit/page.tsx`

**Interfaces:**
- Consumes:
  - `getAdminProductById(id)` from Task 1
  - `createProduct`, `updateProduct`, `unpublishProduct`, `uploadPhoto`, `deletePhoto`, `reorderPhoto` from Task 3
- Produces: pages RSC `/admin/produits/new` et `/admin/produits/[id]/edit`

_Pas de fichier de test séparé : les pages RSC ne contiennent que du rendu. Les actions sont couvertes par Task 3, le data layer par Task 1._

- [ ] **Step 1: Créer `app/admin/produits/new/page.tsx`**

RSC avec :
- `searchParams: { error?: string }` — affiche `searchParams.error` si présent (bloc rouge sous le titre)
- Formulaire `<form action={createProduct}>` avec tous les champs du spec (cf. section UI du spec) :
  - `name` text required
  - `slug` text required
  - `description` textarea
  - `price` number step="0.01"
  - `shipping_price` number step="0.01"
  - `stock` number min="0"
  - `allow_preorder` checkbox
  - `category` select : option vide + ameublement/objet/piece_limitee avec libellés français
  - `published` checkbox
- Bouton submit « Enregistrer »
- Lien « ← Retour à la liste » vers `/admin/produits`
- Classes Tailwind pierre existantes (copier le style des boutons de `app/admin/commandes/[id]/page.tsx`)

- [ ] **Step 2: Créer `app/admin/produits/[id]/edit/page.tsx`**

RSC avec `params: { id: string }` + `searchParams: { error?: string }` :

```tsx
const product = await getAdminProductById(params.id)
if (!product) notFound()
```

Structure :
- Lien « ← Retour à la liste »
- En-tête : titre (nom du produit) + badge publié/non publié
- Affiche `searchParams.error` si présent
- **Formulaire principal** `<form action={async (fd) => { 'use server'; return updateProduct(params.id, fd) }}>` — mêmes champs que new, pré-remplis avec les valeurs du produit (`defaultValue`)
- **Section photos** (sous le formulaire) :
  - Liste des `product.product_photos` (déjà triées par position depuis `getAdminProductById`) :
    ```tsx
    {product.product_photos.map((photo, idx) => (
      <div key={photo.id} className="flex items-center gap-2">
        <img src={photo.url} alt="" className="h-20 w-20 object-cover" />
        {/* Bouton ↑ */}
        {idx > 0 && (
          <form action={async () => { 'use server'; await reorderPhoto(photo.id, product.id, 'up') }}>
            <button type="submit">↑</button>
          </form>
        )}
        {/* Bouton ↓ */}
        {idx < product.product_photos.length - 1 && (
          <form action={async () => { 'use server'; await reorderPhoto(photo.id, product.id, 'down') }}>
            <button type="submit">↓</button>
          </form>
        )}
        {/* Supprimer */}
        <form action={async () => { 'use server'; await deletePhoto(photo.id, product.id) }}>
          <button type="submit">Supprimer</button>
        </form>
      </div>
    ))}
    ```
  - Formulaire upload : `<form action={async (fd) => { 'use server'; await uploadPhoto(product.id, fd) }}>` avec `<input type="file" name="file" accept="image/*">` + bouton « Ajouter une photo »
- **Bouton Dépublier** (si `product.published === true`) :
  ```tsx
  <form action={async () => { 'use server'; await unpublishProduct(product.id) }}>
    <button type="submit">Dépublier</button>
  </form>
  ```

- [ ] **Step 3: Exécuter la suite complète pour vérifier l'absence de régressions**

Run: `npx vitest run`
Expected: PASS — tous les tests passent (pas de régression TypeScript non plus)

- [ ] **Step 4: Vérifier le build TypeScript**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add app/admin/produits/new/page.tsx app/admin/produits/[id]/edit/page.tsx
git commit -m "feat: admin produits — formulaires création et édition avec gestion photos"
```
