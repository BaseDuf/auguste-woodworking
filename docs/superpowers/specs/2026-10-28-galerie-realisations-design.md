# Galerie Réalisations — Design Spec

**Date:** 2026-10-28  
**Author:** Basile Dufloux  
**Status:** Approved

---

## Overview

Add full admin management for the réalisations portfolio gallery, plus a public detail page per réalisation. The DB schema (`realisations` + `realisation_photos`) already exists; the public list page (`/realisations`) already exists. This spec covers everything missing.

**Success criteria:**
- Admin can create, edit, delete réalisations with title / slug / description
- Admin can upload, reorder (↑↓), and delete photos per réalisation
- Public gallery list page links each card to its detail page
- Detail page shows all photos for a réalisation at `/realisations/[slug]`

---

## 1. Database Migration

File: `supabase/migrations/20261028000001_realisations_slug_storage.sql`

```sql
-- Add slug column to realisations
ALTER TABLE public.realisations ADD COLUMN IF NOT EXISTS slug text NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS realisations_slug_key ON public.realisations(slug);

-- Storage bucket for realisation photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('realisation-photos', 'realisation-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Service role can manage realisation photos"
  ON storage.objects FOR ALL
  USING (bucket_id = 'realisation-photos' AND auth.role() = 'service_role');

CREATE POLICY "Public can read realisation photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'realisation-photos');
```

---

## 2. Data Layer

File: `lib/data/realisations.ts` — extend existing file

**New admin functions** (use `createAdminClient()` to bypass RLS):
- `getAdminRealisations(): Promise<RealisationWithPhotos[]>` — all réalisations ordered `created_at desc`, with `realisation_photos` joined ordered by `position asc`
- `getAdminRealisationById(id: string): Promise<RealisationWithPhotos | null>`

**New public function** (use `createClient()`):
- `getRealisationBySlug(slug: string): Promise<RealisationWithPhotos | null>` — all photos joined, ordered by `position asc`

Type `RealisationWithPhotos` already exported from this file; reuse it.

---

## 3. Storage Helper

File: `lib/storage/upload-realisation-photo.ts`

Exact mirror of `lib/storage/upload-product-photo.ts`:
- Bucket: `realisation-photos`
- Max size: 10MB
- Accepted formats: JPEG, PNG, WebP, AVIF
- French error messages (same strings)
- Returns `{ path: string; url: string }`
- Rolls back storage upload if DB insert fails (handled at action layer)

---

## 4. Server Actions

File: `app/admin/realisations/actions.ts`

All actions:
1. Start with `'use server'`
2. Call `requireAdmin()` (same implementation as produits)
3. Return `{ ok: boolean; error?: string }` except navigation actions which `redirect()`

### Actions

| Action | Signature | Behaviour |
|--------|-----------|-----------|
| `createRealisation` | `(formData: FormData) => Promise<void>` | Insert → `redirect('/admin/realisations/[id]/edit')` |
| `updateRealisation` | `(id: string, formData: FormData) => Promise<{ ok: boolean; error?: string }>` | Update title/slug/description → `revalidatePath` |
| `deleteRealisation` | `(id: string) => Promise<void>` | Delete from DB (cascade photos+storage keys first) → `redirect('/admin/realisations')` |
| `uploadRealisationPhoto` | `(realisationId: string, formData: FormData) => Promise<{ ok: boolean; error?: string }>` | Validate → upload storage → insert photo row → revalidatePath |
| `deleteRealisationPhoto` | `(photoId: string, storageKey: string) => Promise<{ ok: boolean; error?: string }>` | Delete from storage → delete photo row → revalidatePath |
| `reorderRealisationPhoto` | `(photoId: string, realisationId: string, direction: 'up' \| 'down') => Promise<{ ok: boolean; error?: string }>` | Fetch all photos sorted by position → find neighbor → swap positions atomically → revalidatePath; rollback first UPDATE on second UPDATE failure |

`deleteRealisation` extracts storage keys from `realisation_photos` before deleting the DB row, then deletes each from storage (best-effort; DB delete proceeds regardless).

---

## 5. Admin Pages

### 5.1 List — `app/admin/realisations/page.tsx`

RSC. Calls `getAdminRealisations()`.

Table columns:
- Titre
- Slug
- Photos (count, numeric)
- Actions → "Modifier" link to `/admin/realisations/[id]/edit`

Header row: `<Link href="/admin/realisations/new">Nouvelle réalisation</Link>` button.

Empty state: "Aucune réalisation pour le moment."

### 5.2 New — `app/admin/realisations/new/page.tsx`

RSC form, `action={createRealisation}`.

Fields:
- Titre (`name="title"`, required)
- Slug (`name="slug"`, required, hint: "URL: /realisations/[slug]")
- Description (`name="description"`, textarea, optional)

Error banner from `searchParams.error`.

### 5.3 Edit — `app/admin/realisations/[id]/edit/page.tsx`

RSC. Calls `getAdminRealisationById(params.id)`, calls `notFound()` if null.

**Metadata section** — pre-filled fields (title, slug, description). Inline server action calls `updateRealisation(params.id, fd)`. Checks `r.ok`, redirects with `?error=` on failure, redirects without error param on success.

**Photo management section** — identical to produits edit page:
- Current photos listed with position, ↑ / ↓ buttons, "Supprimer" button
- Upload form (file input, "Ajouter une photo" submit)
- Each inline action checks `r.ok`, redirects with `?error=` on failure

**Danger zone** — "Supprimer la réalisation" form calls `deleteRealisation(params.id)`.

Error banner from `searchParams.error`.

---

## 6. Admin Layout

File: `app/admin/layout.tsx`

Add `<Link href="/admin/realisations">Réalisations</Link>` to the nav, after "Produits".

---

## 7. Public Pages

### 7.1 Gallery list update — `app/realisations/page.tsx`

Wrap each `<article>` in `<Link href={/realisations/${realisation.slug}}>`. No other layout changes.

### 7.2 Detail page — `app/realisations/[slug]/page.tsx`

RSC. Calls `getRealisationBySlug(params.slug)`. Calls `notFound()` if null.

Layout:
- Back link `← Réalisations` → `/realisations`
- `<h1>` title (serif)
- Description paragraph if present
- First photo full-width
- Remaining photos in 2-column grid on sm+, 1-column on mobile
- `<img>` tags, `alt={realisation.title}`, same `eslint-disable` comment as existing page

---

## 8. Tests

Each new module gets a `__tests__/` file:

| File | Tests |
|------|-------|
| `lib/storage/__tests__/upload-realisation-photo.test.ts` | Same 5 cases as upload-product-photo tests |
| `app/admin/realisations/__tests__/actions.test.ts` | All 6 actions, rollback on reorder failure, already-deleted guard |
| `app/admin/realisations/__tests__/list.test.tsx` | Renders titles, photo counts, empty state |
| `app/realisations/__tests__/detail.test.tsx` | Renders all photos, notFound on null |

All tests use `vi.hoisted` for mocks. Existing `app/realisations/__tests__/realisations.test.tsx` updated to mock the new `getRealisationBySlug` export (which it doesn't call, but the module shape changes).

---

## 9. File Checklist

```
supabase/migrations/20261028000001_realisations_slug_storage.sql  [new]
lib/data/realisations.ts                                           [extend]
lib/storage/upload-realisation-photo.ts                           [new]
app/admin/realisations/actions.ts                                  [new]
app/admin/realisations/page.tsx                                    [new]
app/admin/realisations/new/page.tsx                                [new]
app/admin/realisations/[id]/edit/page.tsx                         [new]
app/admin/layout.tsx                                               [extend — add nav link]
app/realisations/page.tsx                                          [extend — add Link wrapper]
app/realisations/[slug]/page.tsx                                   [new]
lib/storage/__tests__/upload-realisation-photo.test.ts            [new]
app/admin/realisations/__tests__/actions.test.ts                   [new]
app/admin/realisations/__tests__/list.test.tsx                     [new]
app/realisations/__tests__/detail.test.tsx                         [new]
app/realisations/__tests__/realisations.test.tsx                   [update mock shape]
```

---

## 10. Out of Scope

- Publishing/unpublishing réalisations (all réalisations are public)
- Category filtering on the gallery
- Lightbox / full-screen photo viewer on detail page
- SEO metadata (`<title>`, OpenGraph) on detail page
