# Galerie Réalisations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin CRUD for réalisations (with multi-photo upload) and upgrade the public gallery with a lightbox carousel.

**Architecture:** Four tasks in dependency order — data layer first, then server actions, then admin UI, then public gallery. The admin mirrors `app/admin/produits/` exactly. The public gallery wraps the existing server component in a client `RealisationsGallery` that holds lightbox state; no new routes needed.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind CSS, Supabase Storage (`realisation-photos` bucket), Vitest + testing-library

**Spec:** `docs/superpowers/specs/2026-10-29-galerie-realisations-design.md`

## Global Constraints

- TypeScript strict — no `any`, no `@ts-ignore`
- `'use server'` on all server actions; `'use client'` on all client components
- `createAdminClient()` from `@/lib/supabase/admin` for mutations; `createClient()` from `@/lib/supabase/server` for reads in server components
- Storage bucket name: `realisation-photos` (mirrors `product-photos` pattern)
- Tailwind classes follow the project palette: `stone-900`, `stone-700`, `stone-500`, `stone-300`, `stone-100` for admin UI
- All server actions call `revalidatePath('/realisations')` and `revalidatePath('/admin/realisations')` after mutations
- `requireAdmin()` (copy of the one in `app/admin/produits/actions.ts`) guards every server action

## Review Focus

1. **deleteRealisation with photos in storage** — DB cascade removes `realisation_photos` rows, but storage files remain orphaned unless explicitly deleted. `deleteRealisation` must fetch all photo URLs, delete storage files, then delete the realisation row.
2. **Lightbox opened on a réalisation with 0 photos** — `onClose()` must be called immediately or the overlay must render with no image and show only the close button; must not crash.
3. **uploadPhoto with an empty file** — `uploadRealisationPhoto` throws "Fichier vide"; the action must catch and return `{ ok: false, error: 'Fichier vide' }` and the page must redirect with the error query param.
4. **Lightbox navigation at boundaries** — pressing ArrowLeft on the first photo or ArrowRight on the last must do nothing (no wrap-around, no crash).
5. **getAdminRealisationById with unknown id** — must return `null`, not throw; the edit page calls `notFound()` on null.

---

## Task 1: Data layer + storage helper

**Files:**
- Modify: `lib/data/realisations.ts`
- Create: `lib/storage/upload-realisation-photo.ts`
- Create: `lib/storage/__tests__/upload-realisation-photo.test.ts`

**Interfaces:**
- Consumes: existing `RealisationWithPhotos` type, `createAdminClient` from `@/lib/supabase/admin`
- Produces:
  - `getAdminRealisations(): Promise<RealisationWithPhotos[]>` — all realisations ordered `created_at DESC`, with photos ordered `position ASC`
  - `getAdminRealisationById(id: string): Promise<RealisationWithPhotos | null>`
  - `uploadRealisationPhoto(realisationId: string, file: File): Promise<{ path: string; url: string }>` — throws on invalid input

---

- [ ] **Step 1: Write failing tests for `uploadRealisationPhoto`**

```ts
// lib/storage/__tests__/upload-realisation-photo.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpload = vi.hoisted(() => vi.fn())
const mockGetPublicUrl = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    storage: { from: () => ({ upload: mockUpload, getPublicUrl: mockGetPublicUrl }) },
  }),
}))

import { uploadRealisationPhoto } from '../upload-realisation-photo'

const makeFile = (type: string, size: number) =>
  new File(['x'.repeat(size)], 'img.jpg', { type })

describe('uploadRealisationPhoto', () => {
  beforeEach(() => {
    mockUpload.mockReset()
    mockGetPublicUrl.mockReset()
    mockUpload.mockResolvedValue({ data: {}, error: null })
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/r1/uuid.jpg' } })
  })

  it('throws when MIME type is not allowed', async () => {
    await expect(uploadRealisationPhoto('r1', makeFile('image/gif', 100))).rejects.toThrow(
      'Format non supporté (JPEG, PNG, WebP, AVIF)'
    )
  })

  it('throws when file is empty', async () => {
    await expect(uploadRealisationPhoto('r1', makeFile('image/jpeg', 0))).rejects.toThrow(
      'Fichier vide'
    )
  })

  it('throws when file exceeds 10 MB', async () => {
    await expect(
      uploadRealisationPhoto('r1', makeFile('image/jpeg', 11 * 1024 * 1024))
    ).rejects.toThrow('Fichier trop volumineux (10 Mo max)')
  })

  it('throws when storage upload fails', async () => {
    mockUpload.mockResolvedValue({ data: null, error: new Error('storage fail') })
    await expect(uploadRealisationPhoto('r1', makeFile('image/jpeg', 500))).rejects.toThrow(
      "Erreur lors de l'upload"
    )
  })

  it('returns path and url on success', async () => {
    const result = await uploadRealisationPhoto('r1', makeFile('image/jpeg', 500))
    expect(result.url).toBe('https://cdn.example.com/r1/uuid.jpg')
    expect(result.path).toMatch(/^r1\/[0-9a-f-]+\.jpg$/)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run lib/storage/__tests__/upload-realisation-photo.test.ts
```
Expected: 5 failures — `uploadRealisationPhoto` not found.

- [ ] **Step 3: Create `lib/storage/upload-realisation-photo.ts`**

Copy `lib/storage/upload-product-photo.ts` verbatim, replacing:
- `BUCKET = 'product-photos'` → `BUCKET = 'realisation-photos'`
- function name: `uploadProductPhoto` → `uploadRealisationPhoto`
- parameter name: `productId` → `realisationId`
- path pattern: `` `${productId}/...` `` → `` `${realisationId}/...` ``

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run lib/storage/__tests__/upload-realisation-photo.test.ts
```
Expected: 5 passing.

- [ ] **Step 5: Add admin helpers to `lib/data/realisations.ts`**

Add after `getRealisations()`:

```ts
export async function getAdminRealisations(): Promise<RealisationWithPhotos[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('realisations')
    .select('*, realisation_photos(*)')
    .order('created_at', { ascending: false })
  if (error) console.error('[data:realisations] getAdminRealisations', error)
  return (data as RealisationWithPhotos[] | null) ?? []
}

export async function getAdminRealisationById(id: string): Promise<RealisationWithPhotos | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('realisations')
    .select('*, realisation_photos(*)')
    .eq('id', id)
    .order('position', { ascending: true, referencedTable: 'realisation_photos' })
    .single()
  if (error) {
    if (error.code !== 'PGRST116') console.error('[data:realisations] getAdminRealisationById', error)
    return null
  }
  return data as RealisationWithPhotos
}
```

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run
```
Expected: all tests passing, no regressions.

- [ ] **Step 7: Commit**

```bash
git add lib/data/realisations.ts lib/storage/upload-realisation-photo.ts lib/storage/__tests__/upload-realisation-photo.test.ts
git commit -m "feat(realisations): data helpers + storage upload"
```

---

## Task 2: Server actions

**Files:**
- Create: `app/admin/realisations/actions.ts`

**Interfaces:**
- Consumes: `getAdminRealisationById` from Task 1; `uploadRealisationPhoto` from Task 1; `createAdminClient`
- Produces:
  - `createRealisation(formData: FormData): Promise<void>` — inserts, then `redirect('/admin/realisations/[newId]/edit')`
  - `updateRealisation(id: string, formData: FormData): Promise<{ ok: boolean; error?: string }>`
  - `deleteRealisation(id: string): Promise<{ ok: boolean; error?: string }>` — deletes storage files then DB row
  - `uploadPhoto(realisationId: string, formData: FormData): Promise<{ ok: boolean; error?: string }>`
  - `deletePhoto(photoId: string, realisationId: string): Promise<{ ok: boolean; error?: string }>`

---

- [ ] **Step 1: Create `app/admin/realisations/actions.ts`**

Add `'use server'` directive. Copy the `requireAdmin()` helper from `app/admin/produits/actions.ts` verbatim.

Implement `createRealisation(formData: FormData): Promise<void>`:
- Extract `title` (required string), `description` (optional string or null)
- Insert into `realisations` via `createAdminClient()`
- On error: `redirect('/admin/realisations/new?error=' + encodeURIComponent('Erreur lors de la création'))`
- On success: `revalidatePath('/realisations')`, `revalidatePath('/admin/realisations')`, `redirect('/admin/realisations/' + data.id + '/edit')`

Implement `updateRealisation(id: string, formData: FormData): Promise<{ ok: boolean; error?: string }>`:
- Extract `title`, `description`
- Update `realisations` row
- `revalidatePath('/realisations')`, `revalidatePath('/admin/realisations')`, `revalidatePath('/admin/realisations/' + id + '/edit')`
- Return `{ ok: true }` or `{ ok: false, error: 'Erreur lors de la mise à jour' }`

Implement `deleteRealisation(id: string): Promise<{ ok: boolean; error?: string }>`:
- Fetch all `realisation_photos` for the id (select `id, url`)
- Extract the storage path from each URL: the path segment after `/realisation-photos/` in the public URL (use `new URL(photo.url).pathname.split('/realisation-photos/')[1]`)
- Delete storage files via `createAdminClient().storage.from('realisation-photos').remove([...paths])`
- Delete realisation row (cascade removes photo rows)
- `revalidatePath('/realisations')`, `revalidatePath('/admin/realisations')`
- Return `{ ok: true }` or `{ ok: false, error: 'Erreur lors de la suppression' }`

Implement `uploadPhoto(realisationId: string, formData: FormData): Promise<{ ok: boolean; error?: string }>`:
- Extract `file = formData.get('file') as File`
- Call `uploadRealisationPhoto(realisationId, file)` — catch throws, return `{ ok: false, error: err.message }`
- Query max position from `realisation_photos` where `realisation_id = realisationId`
- Insert `{ realisation_id: realisationId, url, position: maxPos + 1 }` — on insert error, remove storage file and return error
- `revalidatePath('/admin/realisations/' + realisationId + '/edit')`
- Return `{ ok: true }`

Implement `deletePhoto(photoId: string, realisationId: string): Promise<{ ok: boolean; error?: string }>`:
- Delete `realisation_photos` row by id
- `revalidatePath('/admin/realisations/' + realisationId + '/edit')`
- Return `{ ok: true }` or error

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run
```
Expected: all passing (actions are not unit-tested; coverage comes from the integration path in Task 3).

- [ ] **Step 3: Commit**

```bash
git add app/admin/realisations/actions.ts
git commit -m "feat(realisations): server actions CRUD + photo upload"
```

---

## Task 3: Admin UI

**Files:**
- Modify: `app/admin/layout.tsx`
- Create: `app/admin/realisations/page.tsx`
- Create: `app/admin/realisations/new/page.tsx`
- Create: `app/admin/realisations/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `getAdminRealisations`, `getAdminRealisationById` from Task 1; all actions from Task 2

---

- [ ] **Step 1: Add Réalisations link to admin nav**

In `app/admin/layout.tsx`, add alongside existing links:
```tsx
<Link href="/admin/realisations" className="text-stone-700 hover:text-stone-900">
  Réalisations
</Link>
```

- [ ] **Step 2: Create `app/admin/realisations/page.tsx`**

Server component. Fetches `getAdminRealisations()`. Renders:
- Header row: `<h1>Réalisations</h1>` + `<Link href="/admin/realisations/new">Nouvelle réalisation</Link>`
- Table with columns: photo (40×40 thumbnail, first photo or placeholder), Titre, Nb photos, Date, Modifier link
- Delete button per row — inline form with action calling `deleteRealisation(realisation.id)`, redirecting to `/admin/realisations` on success/error

- [ ] **Step 3: Create `app/admin/realisations/new/page.tsx`**

Server component. Reads `searchParams.error`. Renders a form with `action={createRealisation}`:
- `Titre` input (required)
- `Description` textarea (optional)
- Submit button "Enregistrer"
- Error banner if `searchParams.error` present

- [ ] **Step 4: Create `app/admin/realisations/[id]/edit/page.tsx`**

Server component. Calls `getAdminRealisationById(params.id)` — calls `notFound()` if null.

Renders:
- Back link `← Retour à la liste`
- Title heading `{realisation.title}`
- Error banner if `searchParams.error` present
- **Edit form** (action calls `updateRealisation(params.id, fd)`): Titre (required, defaultValue), Description (textarea, defaultValue), Submit "Enregistrer"
- **Photos section**:
  - List of existing photos: thumbnail (80×80), delete button (form → `deletePhoto(photo.id, params.id)`)
  - Upload form: file input (`accept="image/*"`), Submit "Ajouter une photo" (action calls `uploadPhoto(params.id, fd)`)
- **Delete réalisation** section: red-border button, form → `deleteRealisation(params.id)`, redirects to `/admin/realisations`

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```
Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add app/admin/layout.tsx app/admin/realisations/
git commit -m "feat(realisations): admin UI — list, create, edit pages"
```

---

## Task 4: Public gallery + lightbox

**Files:**
- Create: `components/realisations/lightbox.tsx`
- Create: `components/realisations/realisations-gallery.tsx`
- Create: `components/realisations/__tests__/lightbox.test.tsx`
- Modify: `app/realisations/page.tsx`

**Interfaces:**
- Consumes: `RealisationWithPhotos` from `@/lib/data/realisations`
- Produces:
  - `Lightbox({ realisation: RealisationWithPhotos; onClose: () => void }): JSX.Element`
  - `RealisationsGallery({ realisations: RealisationWithPhotos[] }): JSX.Element`

---

- [ ] **Step 1: Write failing tests for Lightbox keyboard navigation**

```tsx
// components/realisations/__tests__/lightbox.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import Lightbox from '../lightbox'
import type { RealisationWithPhotos } from '@/lib/data/realisations'

const makeRealisation = (photoCount: number): RealisationWithPhotos => ({
  id: 'r1',
  title: 'Chantier test',
  description: null,
  created_at: '2026-01-01T00:00:00Z',
  realisation_photos: Array.from({ length: photoCount }, (_, i) => ({
    id: `p${i}`,
    realisation_id: 'r1',
    url: `https://cdn.example.com/photo${i}.jpg`,
    position: i,
  })),
})

describe('Lightbox', () => {
  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(<Lightbox realisation={makeRealisation(2)} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('navigates to next photo on ArrowRight', () => {
    const { getByRole } = render(
      <Lightbox realisation={makeRealisation(3)} onClose={vi.fn()} />
    )
    const counter = getByRole('status')
    expect(counter.textContent).toBe('1 / 3')
    fireEvent.keyDown(document, { key: 'ArrowRight' })
    expect(counter.textContent).toBe('2 / 3')
  })

  it('does not go past last photo on ArrowRight', () => {
    const { getByRole } = render(
      <Lightbox realisation={makeRealisation(2)} onClose={vi.fn()} />
    )
    fireEvent.keyDown(document, { key: 'ArrowRight' })
    fireEvent.keyDown(document, { key: 'ArrowRight' })
    expect(getByRole('status').textContent).toBe('2 / 2')
  })

  it('does not go before first photo on ArrowLeft', () => {
    const { getByRole } = render(
      <Lightbox realisation={makeRealisation(2)} onClose={vi.fn()} />
    )
    fireEvent.keyDown(document, { key: 'ArrowLeft' })
    expect(getByRole('status').textContent).toBe('1 / 2')
  })

  it('calls onClose immediately when realisation has no photos', () => {
    const onClose = vi.fn()
    render(<Lightbox realisation={makeRealisation(0)} onClose={onClose} />)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run components/realisations/__tests__/lightbox.test.tsx
```
Expected: 5 failures — `Lightbox` not found.

- [ ] **Step 3: Create `components/realisations/lightbox.tsx`**

`'use client'`. Props: `{ realisation: RealisationWithPhotos; onClose: () => void }`.

- If `realisation.realisation_photos.length === 0`, call `onClose()` in a `useEffect(onClose, [])` and return `null`
- `useState(0)` for current index
- `useEffect` registering `keydown` listener on `document` for `Escape` (call `onClose`), `ArrowRight` (increment index clamped to `photos.length - 1`), `ArrowLeft` (decrement clamped to 0); cleanup on unmount
- Render: fixed overlay `inset-0 z-50 bg-black/80 flex items-center justify-center` — clicking the overlay background calls `onClose`
- Inside: centered image `max-h-[90vh] max-w-[90vw] object-contain` wrapped in a `div` with `onClick` stopPropagation
- Close button (top-right `×`) calls `onClose`
- Prev/Next arrow buttons when `photos.length > 1`; prev disabled/hidden at index 0, next at last index
- Counter `<span role="status">{index + 1} / {photos.length}</span>`

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run components/realisations/__tests__/lightbox.test.tsx
```
Expected: 5 passing.

- [ ] **Step 5: Create `components/realisations/realisations-gallery.tsx`**

`'use client'`. Props: `{ realisations: RealisationWithPhotos[] }`.

- `useState<RealisationWithPhotos | null>(null)` for `selected`
- Renders the masonry grid (CSS columns, same classes as existing `app/realisations/page.tsx`)
- Each card: cover photo (first photo ordered by position, or stone-200 placeholder), title — `onClick={() => setSelected(realisation)}`
- When `selected !== null`, renders `<Lightbox realisation={selected} onClose={() => setSelected(null)} />`

- [ ] **Step 6: Update `app/realisations/page.tsx`**

Replace the current masonry grid JSX with:
```tsx
import RealisationsGallery from '@/components/realisations/realisations-gallery'

export default async function RealisationsPage() {
  const realisations = await getRealisations()
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="font-serif text-4xl text-stone-800">Réalisations</h1>
      {realisations.length === 0 ? (
        <p className="mt-16 text-center font-sans text-stone-600">Bientôt disponible.</p>
      ) : (
        <RealisationsGallery realisations={realisations} />
      )}
    </div>
  )
}
```

- [ ] **Step 7: Run full test suite**

```bash
npx vitest run
```
Expected: all passing.

- [ ] **Step 8: Commit**

```bash
git add components/realisations/ app/realisations/page.tsx
git commit -m "feat(realisations): public gallery with lightbox carousel"
```

---

## Final push

```bash
git push -u origin claude/keen-clarke-6b4ggw
```
