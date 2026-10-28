# Back-Office Produits — Design Spec

## Objectif

Permettre à l'admin d'Auguste Woodworking de gérer le catalogue produits : consulter et filtrer la liste par catégorie, créer et éditer les fiches produit, gérer les photos (upload vers Supabase Storage, suppression, réordonnancement par position), et dépublier un produit (suppression douce).

---

## Contexte technique

- **Framework :** Next.js 14.2 App Router, TypeScript strict
- **Auth admin :** `app/admin/layout.tsx` (guard existant — redirige vers `/admin/login` si non-admin)
- **DB :** Supabase PostgreSQL via `createAdminClient()` (`lib/supabase/admin.ts`)
- **Storage :** Supabase Storage, bucket `product-photos`, via `createAdminClient()`
- **Tests :** Vitest + @testing-library/react, `vi.hoisted` pour les mocks stables

---

## Architecture

### Fichiers créés

| Chemin | Rôle |
|--------|------|
| `app/admin/produits/page.tsx` | Liste des produits (RSC, filtrée par `?categorie=`) |
| `app/admin/produits/new/page.tsx` | Formulaire création (RSC) |
| `app/admin/produits/[id]/edit/page.tsx` | Formulaire édition + gestion photos (RSC) |
| `app/admin/produits/actions.ts` | Server Actions : `createProduct`, `updateProduct`, `unpublishProduct`, `uploadPhoto`, `deletePhoto`, `reorderPhoto` |
| `lib/storage/upload-product-photo.ts` | Helper Supabase Storage — upload + getPublicUrl |
| `supabase/migrations/20261028000000_products_storage.sql` | Bucket `product-photos` + politique RLS service_role |

### Fichiers modifiés (extensions de l'existant)

| Chemin | Changement |
|--------|------------|
| `lib/data/products.ts` | Ajouter `getAdminProducts(category?)` et `getAdminProductById(id)` — même pattern que les fonctions publiques avec `createAdminClient()` au lieu de `createClient()` |
| `app/admin/layout.tsx` | Ajout lien « Produits » dans la nav admin |

### Réutilisation explicite

- **`app/admin/commandes/[id]/actions.ts`** : `requireAdmin()` copié verbatim dans `app/admin/produits/actions.ts` — même implémentation (getUser → profiles → role === 'admin').
- **`app/admin/commandes/page.tsx`** : pattern barre de filtre `?status=` réutilisé pour `?categorie=` — même structure `FILTERS`, même style pierre actif/inactif.
- **`app/boutique/page.tsx`** : constantes `categories` et `categoryLabels` copiées — mêmes libellés français (`ameublement` / `objet` / `piece_limitee`).
- **`lib/data/products.ts`** : `getAdminProducts` = `getPublishedProducts` sans `.eq('published', true)` + `createAdminClient()`. `getAdminProductById` = `getProductBySlug` avec `.eq('id', id)` à la place de `.eq('slug', slug).eq('published', true)`.
- **shadcn/ui** : `Table`, `Badge`, `Button` déjà installés.
- **`@supabase/storage-js`** : déjà bundlé dans `supabase-js` — zéro dépendance nouvelle.

---

## Data layer — extensions de `lib/data/products.ts`

```ts
export type AdminProduct = Pick<
  Product,
  'id' | 'slug' | 'name' | 'price_cents' | 'shipping_price_cents' |
  'stock' | 'allow_preorder' | 'category' | 'published' | 'created_at'
>
export type AdminProductWithPhotos = Product & { product_photos: ProductPhoto[] }
```

**`getAdminProducts(category?: string): Promise<AdminProduct[]>`**
- `createAdminClient().from('products').select('id, slug, name, price_cents, shipping_price_cents, stock, allow_preorder, category, published, created_at').order('created_at', { ascending: false })`
- Si `category` fourni : `.eq('category', category)`

**`getAdminProductById(id: string): Promise<AdminProductWithPhotos | null>`**
- `createAdminClient().from('products').select('*, product_photos(*)').eq('id', id).single()`
- Retourne `null` si `error.code === 'PGRST116'`
- Tri des photos : `product_photos` triées par `position` ASC côté client après fetch

---

## Server Actions — `app/admin/produits/actions.ts`

Toutes les actions commencent par `requireAdmin()` (copie de commandes/actions.ts).

### `createProduct(formData: FormData): Promise<{ ok: boolean; id?: string; error?: string }>`

Champs lus depuis `formData` : `name`, `slug`, `description`, `price` (euros → cents), `shipping_price` (euros → cents), `stock`, `allow_preorder` (checkbox → boolean), `category` (vide = null), `published` (checkbox → boolean).

```ts
await createAdminClient().from('products').insert({
  name, slug, description: description || null,
  price_cents: Math.round(parseFloat(price) * 100),
  shipping_price_cents: Math.round(parseFloat(shipping_price) * 100),
  stock: parseInt(stock),
  allow_preorder: allow_preorder === 'on',
  category: category || null,
  published: published === 'on',
})
```

Retourne `{ ok: true, id }` ou `{ ok: false, error: 'Slug déjà utilisé' }` si contrainte unique violée (`error.code === '23505'`).

Après succès : `revalidatePath('/admin/produits')` + `redirect(\`/admin/produits/${id}/edit\`)`.

### `updateProduct(productId: string, formData: FormData): Promise<{ ok: boolean; error?: string }>`

Mêmes champs que `createProduct`. UPDATE sur `.eq('id', productId)`.

Retourne `{ ok: false, error: 'Slug déjà utilisé' }` si `error.code === '23505'`.

Après succès : `revalidatePath('/admin/produits')` + `revalidatePath(\`/admin/produits/${productId}/edit\`)`.

### `unpublishProduct(productId: string): Promise<{ ok: boolean; error?: string }>`

`UPDATE products SET published = false WHERE id = productId`.

Après succès : `revalidatePath('/admin/produits')` + `revalidatePath(\`/admin/produits/${productId}/edit\`)`.

### `uploadPhoto(productId: string, formData: FormData): Promise<{ ok: boolean; error?: string }>`

1. `const file = formData.get('file') as File`
2. `uploadProductPhoto(productId, file)` → `url`
3. `position` = MAX(position) existant + 1 (query `select max(position) from product_photos where product_id = productId`)
4. `createAdminClient().from('product_photos').insert({ product_id: productId, url, position })`
5. `revalidatePath(\`/admin/produits/${productId}/edit\`)`

### `deletePhoto(photoId: string, productId: string): Promise<{ ok: boolean; error?: string }>`

`createAdminClient().from('product_photos').delete().eq('id', photoId)`

Après : `revalidatePath(\`/admin/produits/${productId}/edit\`)`.

> Note : l'objet Storage n'est pas supprimé (simplification — les URLs restent valides, le bucket sert de CDN).

### `reorderPhoto(photoId: string, productId: string, direction: 'up' | 'down'): Promise<{ ok: boolean; error?: string }>`

1. Récupère toutes les photos du produit triées par `position`
2. Trouve l'index de `photoId`
3. Échange `position` avec le voisin (`direction === 'up'` → échange avec index-1, `'down'` → index+1)
4. UPDATE atomique des deux lignes avec `upsert`
5. `revalidatePath(\`/admin/produits/${productId}/edit\`)`

Retourne `{ ok: false, error: 'Impossible de déplacer' }` si déjà en première/dernière position.

---

## Storage — `lib/storage/upload-product-photo.ts`

```ts
export async function uploadProductPhoto(productId: string, file: File): Promise<{ url: string }>
```

- Chemin : `${productId}/${Date.now()}.${ext}` (ext depuis `file.name`)
- `createAdminClient().storage.from('product-photos').upload(path, file)`
- `createAdminClient().storage.from('product-photos').getPublicUrl(path)` → retourne `data.publicUrl`
- Lance si erreur Storage

---

## UI

### Liste `/admin/produits`

- **Barre de filtre :** liens `href="?categorie=ameublement"` etc., même style pierre actif que commandes.
  Libellés : Tous · Ameublement · Objets · Pièces limitées
- **Table :**
  | Nom | Catégorie | Prix | Stock | Publié | Actions |
  Chaque ligne → lien `/admin/produits/[id]/edit`
- **Badge publié :** vert si `published`, gris si non publié
- **Bouton :** « Nouveau produit » → `/admin/produits/new`

### Formulaire création `/admin/produits/new` et édition `/admin/produits/[id]/edit`

Champs du formulaire (même `<form action={serverAction}>`):
- **Nom** (`name`, text, required)
- **Slug** (`slug`, text, required — ex: `table-chene-massif`)
- **Description** (`description`, textarea)
- **Prix HT** (`price`, number step=0.01 — converti en cents côté action)
- **Frais de port** (`shipping_price`, number step=0.01)
- **Stock** (`stock`, number)
- **Précommande** (`allow_preorder`, checkbox)
- **Catégorie** (`category`, select : vide / ameublement / objet / piece_limitee)
- **Publié** (`published`, checkbox)

Bouton : « Enregistrer »

En mode édition uniquement :
- **Section photos** (séparée, sous le formulaire) :
  - Liste des photos existantes (miniature 80×80, boutons ↑ ↓ Supprimer — chacun est un `<form action={...}>`)
  - Formulaire upload : `<input type="file" accept="image/*" name="file">` + bouton « Ajouter une photo »
- **Bouton « Dépublier »** si `published === true` (form séparé → `unpublishProduct`)
- **Lien « Retour à la liste »**

---

## Migration SQL — `20261028000000_products_storage.sql`

```sql
-- Créer le bucket product-photos s'il n'existe pas
insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;

-- Permettre au service_role de lire/écrire dans le bucket
drop policy if exists "service_role full access product-photos" on storage.objects;
create policy "service_role full access product-photos"
  on storage.objects
  for all
  to service_role
  using (bucket_id = 'product-photos')
  with check (bucket_id = 'product-photos');

-- Lecture publique des photos
drop policy if exists "public read product-photos" on storage.objects;
create policy "public read product-photos"
  on storage.objects
  for select
  to public
  using (bucket_id = 'product-photos');
```

---

## Tests

| Fichier | Ce qu'il teste |
|---------|---------------|
| `lib/data/__tests__/products.test.ts` | Étendre : `getAdminProducts` (avec/sans filtre, inclut non-publiés), `getAdminProductById` (trouvé / not found) |
| `lib/storage/__tests__/upload-product-photo.test.ts` | Upload (mock Storage), URL publique retournée |
| `app/admin/produits/__tests__/actions.test.ts` | `createProduct` (succès, slug dupliqué), `updateProduct`, `unpublishProduct`, `uploadPhoto`, `deletePhoto`, `reorderPhoto` (up/down/bords) |
| `app/admin/produits/__tests__/list.test.tsx` | Rendu liste, filtre actif dans URL, badge publié/non publié |

---

## Contraintes globales

- Next.js 14.2.x — pas de `use server` dans les composants clients
- TypeScript strict — pas de `any`
- `createAdminClient()` pour toutes les lectures/écritures admin (bypass RLS)
- Vitest uniquement (`vi`, pas `jest`)
- Pas de `server-only` (package non installé)
- Tailwind CSS uniquement, palette pierre/stone existante
- Copie exacte du wording français de l'app
- Suppression = douce (published=false) — pas de DELETE produit
- Slug : champ manuel saisi par l'admin
- Bucket Storage : `product-photos`
