# Galerie Réalisations — Design Spec

**Date:** 2026-10-29  
**Author:** Basile Dufloux

---

## Context

Auguste Woodworking needs a way to showcase completed projects (chantiers) with photos. A minimal public page and DB schema already exist. This spec covers:

1. **Admin UI** — create/edit/delete réalisations with multi-photo upload
2. **Public gallery** — masonry grid + lightbox carousel

## Data Model

No schema migration needed. Existing tables are sufficient:

```sql
realisations (id, title, description, created_at)
realisation_photos (id, realisation_id, url, position)
```

Photos are ordered by `position ASC`. The photo with `position = 0` is the cover shown in the grid.

**Supabase Storage:** bucket `realisations` (public, mirrors the `products` bucket pattern).

## Admin Interface

### Route structure

```
/admin/realisations          — list page
/admin/realisations/new      — create form
/admin/realisations/[id]/edit — edit form
```

### Nav

Add "Réalisations" link to the existing admin nav (alongside Produits, Commandes).

### List page (`/admin/realisations`)

- Table: cover thumbnail (40×40px), title, photo count, created_at, Edit/Delete actions
- Delete triggers a server action with `confirm()` equivalent (JS confirm dialog or inline confirm state)
- Sorted by `created_at DESC`

### Create / Edit form

Fields:
- **Titre** (required, text)
- **Description** (optional, textarea)
- **Photos** — multi-file upload input; each uploaded file goes to Supabase Storage `realisations` bucket and inserts a row in `realisation_photos` with incrementing `position`
- On edit: existing photos shown with a delete button per photo; new uploads appended

Photo upload uses the existing `uploadFile` storage helper pattern from `lib/storage/upload.ts`.

### Server Actions (`lib/actions/realisations.ts`)

| Action | Description |
|--------|-------------|
| `createRealisation(formData)` | Insert realisation + upload + insert photos |
| `updateRealisation(id, formData)` | Update title/description; handle added/removed photos |
| `deleteRealisation(id)` | Delete realisation (cascade deletes photos rows); delete storage files |
| `deleteRealisationPhoto(photoId, url)` | Delete single photo row + storage file |

All actions call `revalidatePath('/realisations')` and `revalidatePath('/admin/realisations')`.

### Data helpers (`lib/data/realisations.ts`)

Add alongside existing `getRealisations()`:

```ts
getAdminRealisations(): Promise<RealisationWithPhotos[]>
getAdminRealisationById(id: string): Promise<RealisationWithPhotos | null>
```

## Public Gallery

### Page (`app/realisations/page.tsx`)

Server component. Fetches all réalisations with photos ordered `created_at DESC`.

Layout: CSS columns masonry, 1 col mobile → 2 col sm → 3 col lg (same as current).

Each card:
- Cover photo (`realisation_photos` where `position = 0`, or first photo if none at 0)
- Title below in `font-serif text-xl text-stone-800`
- Cursor pointer — clicking opens lightbox

State: a `selectedRealisation: RealisationWithPhotos | null` lives in a client wrapper component `RealisationsGallery`. When set, renders the lightbox.

### Lightbox (`components/realisations/lightbox.tsx`)

Client component. Props: `realisation: RealisationWithPhotos`, `onClose: () => void`.

- Fixed overlay (`inset-0 z-50 bg-black/80`)
- Centered image, max 90vw × 90vh
- Prev/Next arrow buttons (hidden when only 1 photo)
- Photo counter: "2 / 4"
- Close button (top-right ×)
- Keyboard: `ArrowLeft`, `ArrowRight`, `Escape`
- Touch: swipe left/right via `touchstart`/`touchend` delta
- Click on overlay (outside image) closes
- No external library

### Client wrapper (`components/realisations/realisations-gallery.tsx`)

`'use client'` component. Receives `realisations: RealisationWithPhotos[]` as prop from the server page. Holds `selectedRealisation` state. Renders the masonry grid cards and the lightbox when active.

## Error Handling

- Upload failures: show inline error per photo, do not block form submission for other photos
- DB errors: server actions return `{ error: string }` and the form shows a top-level error message
- Empty gallery: existing "Bientôt disponible." message kept

## Testing

- Unit: `getAdminRealisations`, `getAdminRealisationById` return correct shape
- Unit: lightbox keyboard navigation (next/prev/close with keyboard events)
- Integration: create → edit → delete flow (server actions + revalidation)

## Files Touched

**New:**
- `lib/actions/realisations.ts`
- `components/realisations/lightbox.tsx`
- `components/realisations/realisations-gallery.tsx`
- `app/admin/realisations/page.tsx`
- `app/admin/realisations/new/page.tsx`
- `app/admin/realisations/[id]/edit/page.tsx`

**Modified:**
- `lib/data/realisations.ts` — add admin helpers
- `app/realisations/page.tsx` — use `RealisationsGallery` wrapper
- `app/admin/layout.tsx` (or nav component) — add Réalisations link

## Out of Scope

- Category/filter system
- Detail page (`/realisations/[slug]`)
- Drag-to-reorder photos
- Before/after comparison view
