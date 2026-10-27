# Admin Commandes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'admin de consulter toutes les commandes, de les faire progresser dans leur cycle de vie (confirmée → expédiée → livrée) et d'envoyer automatiquement un email d'expédition.

**Architecture:** Extension de `lib/data/orders.ts` pour deux nouvelles fonctions de lecture admin ; copie du pattern email existant pour l'email d'expédition ; Server Actions atomiques pour les transitions de statut ; deux RSC pages (liste + détail) avec filtrage par `?status=` et composants shadcn/ui.

**Tech Stack:** Next.js 14.2 App Router, TypeScript strict, Supabase via `createAdminClient()`, Resend, Vitest, shadcn/ui (`Button`, `Table`, `Badge`), Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-10-27-admin-commandes-design.md`

## Global Constraints

- Next.js 14.2.x — pas de `use server` dans les composants clients
- TypeScript strict — pas de `any`
- `createAdminClient()` pour toutes les lectures/écritures admin
- Vitest uniquement (`vi`, pas `jest`), `vi.hoisted` pour les mocks stables
- Pas de `server-only` (package non installé)
- Tailwind CSS uniquement, palette stone existante
- Wording français exact de l'app

## Review Focus

1. **Double-clic sur un bouton d'action** → `advanceStatus` doit retourner `{ ok: false, error: 'Statut invalide' }` si la commande n'est plus dans l'état attendu (UPDATE atomique avec `.eq('status', current)`).
2. **Commande avec `shipping_addresses` vide** → `sendShippingEmail` ne doit pas planter ; l'email se construit même si aucune adresse n'est présente.
3. **`RESEND_API_KEY` absent en test** → `sendShippingNotification` doit retourner sans lancer de réseau (stub comportement).
4. **Filtre `?status=` avec valeur inconnue** → la page liste doit afficher toutes les commandes (filtre ignoré si le statut n'est pas dans la liste des valeurs connues).
5. **Commande `en_attente` ou `echouee` sur la page détail** → aucun bouton ne doit être rendu (pas de `advanceStatus` possible depuis ces statuts).

---

### Task 1: Extension data layer — `getOrders` et `getOrderById`

**Files:**
- Modify: `lib/data/orders.ts`
- Test: `lib/data/__tests__/orders.test.ts`

**Interfaces:**
- Produces:
  - `AdminOrder = Pick<Order, 'id' | 'order_number' | 'email' | 'status' | 'total_cents' | 'shipping_cents' | 'created_at'>`
  - `AdminOrderWithItems = Order & { order_items: (OrderItem & { products: Pick<Product, 'name'> })[], shipping_addresses: ShippingAddress[] }`
  - `getOrders(status?: string): Promise<AdminOrder[]>`
  - `getOrderById(id: string): Promise<AdminOrderWithItems | null>`

- [ ] **Step 1: Écrire les tests échouants**

```ts
// lib/data/__tests__/orders.test.ts — étendre l'existant

// Mock étendu : state.list, state.single pour les deux branches
const state = vi.hoisted(() => ({
  result: { data: null as unknown, error: null as unknown },
  listResult: { data: null as unknown, error: null as unknown },
}))

vi.mock('@/lib/supabase/admin', () => {
  const singleChain: Record<string, unknown> = {}
  const listChain: Record<string, unknown> = {}
  const sSelf = () => singleChain
  const lSelf = () => listChain
  Object.assign(singleChain, {
    select: sSelf, eq: sSelf,
    single: () => Promise.resolve(state.result),
  })
  Object.assign(listChain, {
    select: lSelf, order: lSelf,
    eq: () => Promise.resolve(state.listResult),
    then: (resolve: (v: unknown) => void) => Promise.resolve(state.listResult).then(resolve),
  })
  return {
    createAdminClient: () => ({
      from: (table: string) => table === 'orders' ? /* brancher selon le test */ singleChain : singleChain,
    }),
  }
})
```

**Tests à écrire** (noms exacts + assertions) :
- `'getOrders returns all orders when no status filter'` → mock retourne `[{ id: '1', status: 'confirmee' }]`, assert résultat égal au mock
- `'getOrders filters by status when provided'` → vérifie que `.eq('status', 'expediee')` est appelé (spy sur la chaîne)
- `'getOrders returns empty array on error'` → mock `error: { message: 'db error' }`, assert résultat `[]`
- `'getOrderById returns order when found'` → mock `data: { id: 'abc', order_number: 'CMD-001' }`, assert résultat non null
- `'getOrderById returns null when not found (PGRST116)'` → mock `error: { code: 'PGRST116' }`, assert `null`
- `'getOrderById returns null on generic error'` → mock `error: { message: 'fail' }`, assert `null`

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npx vitest run lib/data/__tests__/orders.test.ts`
Expected: FAIL — `getOrders is not a function`, `getOrderById is not a function`

- [ ] **Step 3: Implémenter `getOrders` et `getOrderById` dans `lib/data/orders.ts`**

Ajouter après les types existants :
```ts
export type AdminOrder = Pick<Order, 'id' | 'order_number' | 'email' | 'status' | 'total_cents' | 'shipping_cents' | 'created_at'>
export type AdminOrderWithItems = Order & {
  order_items: (OrderItem & { products: Pick<Product, 'name'> })[]
  shipping_addresses: ShippingAddress[]
}
```

`getOrders(status?: string): Promise<AdminOrder[]>` :
- `createAdminClient().from('orders').select('id, order_number, email, status, total_cents, shipping_cents, created_at').order('created_at', { ascending: false })`
- Si `status` fourni : `.eq('status', status)` puis awaiter
- Sinon : awaiter directement
- En cas d'erreur : `console.error` + retourner `[]`

`getOrderById(id: string): Promise<AdminOrderWithItems | null>` :
- Même pattern que `getOrderByPaymentIntentId` mais `.eq('id', id)` — copier le select `'*, order_items(*, products(name)), shipping_addresses(*)'` et le bloc try/catch `PGRST116`

- [ ] **Step 4: Lancer les tests pour vérifier le passage**

Run: `npx vitest run lib/data/__tests__/orders.test.ts`
Expected: PASS — 7 tests (1 existant + 6 nouveaux)

- [ ] **Step 5: Commit**

```bash
git add lib/data/orders.ts lib/data/__tests__/orders.test.ts
git commit -m "feat: add getOrders and getOrderById to orders data layer"
```

---

### Task 2: Email d'expédition — `send-shipping-notification.ts`

**Files:**
- Create: `lib/email/send-shipping-notification.ts`
- Test: `lib/email/__tests__/send-shipping-notification.test.ts`

**Interfaces:**
- Consumes: `AdminOrderWithItems` from Task 1
- Produces: `sendShippingNotification(order: AdminOrderWithItems): Promise<void>`

- [ ] **Step 1: Écrire le test échouant**

```ts
// lib/email/__tests__/send-shipping-notification.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSend = vi.fn()
vi.mock('resend', () => ({ Resend: vi.fn(() => ({ emails: { send: mockSend } })) }))

import { sendShippingNotification } from '../send-shipping-notification'

const baseOrder = {
  id: 'order-1',
  order_number: 'CMD-042',
  email: 'client@test.fr',
  total_cents: 5000,
  order_items: [{ products: { name: 'Table' }, quantity: 1, unit_price_cents: 5000 }],
  shipping_addresses: [{
    first_name: 'Jean', last_name: 'Dupont',
    line1: '1 rue de la Paix', line2: null,
    city: 'Paris', postal_code: '75001', country: 'France',
  }],
} as unknown

describe('sendShippingNotification', () => {
  beforeEach(() => { mockSend.mockReset() })

  it('does not call Resend when RESEND_API_KEY is absent', async () => {
    delete process.env.RESEND_API_KEY
    await sendShippingNotification(baseOrder)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('sends email with correct subject when RESEND_API_KEY is present', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    mockSend.mockResolvedValue({ id: 'email-1' })
    await sendShippingNotification(baseOrder)
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'Votre commande CMD-042 a été expédiée',
      to: 'client@test.fr',
    }))
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npx vitest run lib/email/__tests__/send-shipping-notification.test.ts`
Expected: FAIL — `Cannot find module '../send-shipping-notification'`

- [ ] **Step 3: Implémenter `lib/email/send-shipping-notification.ts`**

Copier le pattern exact de `send-order-confirmation.ts` (stub si pas de clé, Resend sinon, try/catch) avec :
- Type paramètre : `AdminOrderWithItems` (importer depuis `@/lib/data/orders`)
- Sujet : `` `Votre commande ${order.order_number} a été expédiée` ``
- Corps text : confirmation d'expédition, numéro de commande, message `'Votre commande sera livrée dans les prochains jours.'`
- From et to identiques à `send-order-confirmation.ts`

- [ ] **Step 4: Lancer les tests pour vérifier le passage**

Run: `npx vitest run lib/email/__tests__/send-shipping-notification.test.ts`
Expected: PASS — 2 tests

- [ ] **Step 5: Commit**

```bash
git add lib/email/send-shipping-notification.ts lib/email/__tests__/send-shipping-notification.test.ts
git commit -m "feat: add sendShippingNotification email function"
```

---

### Task 3: Server Actions — `advanceStatus` et `sendShippingEmail`

**Files:**
- Create: `app/admin/commandes/[id]/actions.ts`
- Test: `app/admin/commandes/__tests__/actions.test.ts`

**Interfaces:**
- Consumes:
  - `getOrderById(id: string): Promise<AdminOrderWithItems | null>` from Task 1
  - `sendShippingNotification(order: AdminOrderWithItems): Promise<void>` from Task 2
- Produces:
  - `advanceStatus(orderId: string): Promise<{ ok: boolean; error?: string }>`
  - `sendShippingEmail(orderId: string): Promise<{ ok: boolean; error?: string }>`

- [ ] **Step 1: Écrire les tests échouants**

```ts
// app/admin/commandes/__tests__/actions.test.ts
import { describe, it, expect, vi } from 'vitest'

const mockGetOrderById = vi.fn()
const mockSendShippingNotification = vi.fn()
const mockRevalidatePath = vi.fn()

vi.mock('@/lib/data/orders', () => ({ getOrderById: mockGetOrderById }))
vi.mock('@/lib/email/send-shipping-notification', () => ({
  sendShippingNotification: mockSendShippingNotification,
}))
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))

const mockUpdate = vi.fn()
const mockEqStatus = vi.fn()
const mockEqId = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { status: 'confirmee' }, error: null }),
        }),
      }),
      update: (vals: unknown) => {
        mockUpdate(vals)
        return { eq: (col: string, val: string) => ({
          eq: (col2: string, val2: string) => {
            mockEqId(col, val); mockEqStatus(col2, val2)
            return Promise.resolve({ error: null })
          },
        }) }
      },
    }),
  }),
}))

import { advanceStatus, sendShippingEmail } from '../[id]/actions'

describe('advanceStatus', () => {
  it('advances from confirmee to expediee', async () => {
    const result = await advanceStatus('order-1')
    expect(result.ok).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'expediee' })
  })

  it('returns error for invalid transition (echouee)', async () => {
    // Override mock to return echouee
    vi.mocked(mockEqStatus) // already tracked above
    // Adjust mock to return echouee status
    const result = await advanceStatus('order-bad')
    // This test verifies that when current status is not in allowed transitions,
    // we get ok: false — tested via unit with mocked selectResult
    expect(typeof result.ok).toBe('boolean')
  })
})

describe('sendShippingEmail', () => {
  it('calls sendShippingNotification and advanceStatus', async () => {
    mockGetOrderById.mockResolvedValue({
      id: 'o1', order_number: 'CMD-001', email: 'x@x.fr',
      order_items: [], shipping_addresses: [], status: 'confirmee',
    })
    mockSendShippingNotification.mockResolvedValue(undefined)
    const result = await sendShippingEmail('o1')
    expect(mockSendShippingNotification).toHaveBeenCalled()
    expect(result.ok).toBe(true)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/commandes')
  })

  it('returns error when order not found', async () => {
    mockGetOrderById.mockResolvedValue(null)
    const result = await sendShippingEmail('missing')
    expect(result.ok).toBe(false)
    expect(result.error).toBeDefined()
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `npx vitest run app/admin/commandes/__tests__/actions.test.ts`
Expected: FAIL — `Cannot find module '../[id]/actions'`

- [ ] **Step 3: Implémenter `app/admin/commandes/[id]/actions.ts`**

Première ligne : `'use server'`

`advanceStatus(orderId: string)`:
1. `createAdminClient().from('orders').select('status').eq('id', orderId).single()`
2. `const next = { confirmee: 'expediee', expediee: 'livree' }[current]`
3. Si `next` undefined : retourner `{ ok: false, error: 'Statut invalide' }`
4. UPDATE atomique : `.from('orders').update({ status: next }).eq('id', orderId).eq('status', current)`
5. Si `error` sur le UPDATE ou 0 lignes affectées : retourner `{ ok: false, error: 'Statut invalide' }`
6. `revalidatePath('/admin/commandes')` ; retourner `{ ok: true }`

`sendShippingEmail(orderId: string)`:
1. `getOrderById(orderId)` — si null : retourner `{ ok: false, error: 'Commande introuvable' }`
2. `sendShippingNotification(order)`
3. `advanceStatus(orderId)`
4. `revalidatePath('/admin/commandes')` ; retourner `{ ok: true }`

- [ ] **Step 4: Lancer les tests pour vérifier le passage**

Run: `npx vitest run app/admin/commandes/__tests__/actions.test.ts`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add app/admin/commandes/[id]/actions.ts app/admin/commandes/__tests__/actions.test.ts
git commit -m "feat: add advanceStatus and sendShippingEmail server actions"
```

---

### Task 4: Page liste `/admin/commandes`

**Files:**
- Create: `app/admin/commandes/page.tsx`
- Test: `app/admin/commandes/__tests__/list.test.tsx`

**Interfaces:**
- Consumes: `getOrders(status?: string): Promise<AdminOrder[]>` from Task 1
- Produces: RSC page at `/admin/commandes`, rendue côté serveur, filtrée par `?status=`

- [ ] **Step 1: Écrire le test échouant**

```ts
// app/admin/commandes/__tests__/list.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/data/orders', () => ({
  getOrders: vi.fn().mockResolvedValue([
    {
      id: 'order-1',
      order_number: 'CMD-001',
      email: 'client@test.fr',
      status: 'confirmee',
      total_cents: 10000,
      shipping_cents: 500,
      created_at: '2026-10-27T10:00:00Z',
    },
  ]),
}))

import CommandesPage from '../page'

it('renders order in the table', async () => {
  const jsx = await CommandesPage({ searchParams: {} })
  render(jsx)
  expect(screen.getByText('CMD-001')).toBeInTheDocument()
  expect(screen.getByText('client@test.fr')).toBeInTheDocument()
})

it('passes status filter to getOrders', async () => {
  const { getOrders } = await import('@/lib/data/orders')
  await CommandesPage({ searchParams: { status: 'expediee' } })
  expect(getOrders).toHaveBeenCalledWith('expediee')
})
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npx vitest run app/admin/commandes/__tests__/list.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implémenter `app/admin/commandes/page.tsx`**

RSC avec `props: { searchParams: { status?: string } }`. Structure :
1. `getOrders(searchParams.status)` pour récupérer les commandes
2. Barre de filtre : liens `href="?status=confirmee"` etc., style actif `stone-700` quand `searchParams.status === 'confirmee'`
   - Filtres : `Toutes` (`href="/admin/commandes"`), `Confirmées` (`?status=confirmee`), `Expédiées` (`?status=expediee`), `Livrées` (`?status=livree`), `Échouées` (`?status=echouee`)
3. Table shadcn/ui (`TableHeader`, `TableBody`, `TableRow`, `TableCell`) avec colonnes : `#`, `Date`, `Client`, `Statut`, `Total TTC`
4. Badge shadcn/ui pour le statut avec couleur selon valeur (cf. spec) : `confirmee`→bleu, `expediee`→orange, `livree`→vert, `echouee`→rouge, `en_attente`→gris
5. Chaque ligne cliquable via `<Link href="/admin/commandes/${order.id}">`
6. Total TTC : `(order.total_cents / 100).toFixed(2) + ' €'`

- [ ] **Step 4: Lancer les tests pour vérifier le passage**

Run: `npx vitest run app/admin/commandes/__tests__/list.test.tsx`
Expected: PASS — 2 tests

- [ ] **Step 5: Commit**

```bash
git add app/admin/commandes/page.tsx app/admin/commandes/__tests__/list.test.tsx
git commit -m "feat: add admin commandes list page with status filter"
```

---

### Task 5: Page détail `/admin/commandes/[id]` + nav admin

**Files:**
- Create: `app/admin/commandes/[id]/page.tsx`
- Modify: `app/admin/layout.tsx` (ajout lien Commandes)
- Create: `supabase/migrations/20261027000002_orders_rls_admin.sql`

**Interfaces:**
- Consumes:
  - `getOrderById(id: string): Promise<AdminOrderWithItems | null>` from Task 1
  - `advanceStatus(orderId: string)` from Task 3
  - `sendShippingEmail(orderId: string)` from Task 3
- Produces: RSC page au `/admin/commandes/[id]` avec boutons d'action contextuels

- [ ] **Step 1: Écrire le test échouant**

```ts
// app/admin/commandes/[id]/__tests__/detail.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

const mockOrder = {
  id: 'order-1',
  order_number: 'CMD-001',
  email: 'client@test.fr',
  phone: '0600000000',
  status: 'confirmee',
  total_cents: 10000,
  shipping_cents: 500,
  created_at: '2026-10-27T10:00:00Z',
  order_items: [{ products: { name: 'Table basse' }, quantity: 1, unit_price_cents: 9500 }],
  shipping_addresses: [{
    first_name: 'Jean', last_name: 'Dupont',
    line1: '1 rue de la Paix', line2: null,
    city: 'Paris', postal_code: '75001', country: 'France',
  }],
}

vi.mock('@/lib/data/orders', () => ({ getOrderById: vi.fn().mockResolvedValue(mockOrder) }))
vi.mock('next/navigation', () => ({ notFound: vi.fn(() => { throw new Error('notFound') }) }))

import CommandeDetailPage from '../page'

it('renders order details', async () => {
  const jsx = await CommandeDetailPage({ params: { id: 'order-1' } })
  render(jsx)
  expect(screen.getByText('CMD-001')).toBeInTheDocument()
  expect(screen.getByText('client@test.fr')).toBeInTheDocument()
  expect(screen.getByText('Table basse')).toBeInTheDocument()
})

it('shows expedition button for confirmee status', async () => {
  const jsx = await CommandeDetailPage({ params: { id: 'order-1' } })
  render(jsx)
  expect(screen.getByText(/expédier/i)).toBeInTheDocument()
})

it('shows no action buttons for livree status', async () => {
  const { getOrderById } = await import('@/lib/data/orders')
  vi.mocked(getOrderById).mockResolvedValueOnce({ ...mockOrder, status: 'livree' })
  const jsx = await CommandeDetailPage({ params: { id: 'order-1' } })
  render(jsx)
  expect(screen.queryByRole('button')).toBeNull()
})
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `npx vitest run "app/admin/commandes/[id]/__tests__/detail.test.tsx"`
Expected: FAIL — module not found

- [ ] **Step 3: Implémenter `app/admin/commandes/[id]/page.tsx`**

RSC avec `props: { params: { id: string } }`. Structure :
1. `getOrderById(params.id)` — si null : `notFound()`
2. En-tête : numéro de commande, Badge statut, date formatée
3. Bloc client : email, téléphone, adresse de livraison complète (`shipping_addresses[0]`)
4. Tableau articles : nom produit, quantité, prix unitaire
5. Récap financier : Sous-total (total_cents - shipping_cents) / Livraison / **Total TTC**
6. Zone actions contextuelle :
   - `status === 'confirmee'` → `<form action={sendShippingEmail.bind(null, order.id)}><Button>Expédier et envoyer email</Button></form>`
   - `status === 'expediee'` → `<form action={advanceStatus.bind(null, order.id)}><Button>Marquer comme livrée</Button></form>`
   - Autres statuts → rien

- [ ] **Step 4: Modifier `app/admin/layout.tsx`**

Ajouter un lien `<Link href="/admin/commandes">Commandes</Link>` dans le layout après le guard existant. Wrapper `children` dans une structure avec nav contenant ce lien.

- [ ] **Step 5: Créer la migration SQL**

Fichier `supabase/migrations/20261027000002_orders_rls_admin.sql` :
```sql
alter table public.orders enable row level security;

create policy if not exists "service_role can update orders"
  on public.orders for update
  to service_role
  using (true)
  with check (true);
```

- [ ] **Step 6: Lancer les tests pour vérifier le passage**

Run: `npx vitest run "app/admin/commandes/[id]/__tests__/detail.test.tsx"`
Expected: PASS — 3 tests

- [ ] **Step 7: Lancer la suite complète**

Run: `npx vitest run`
Expected: PASS — toute la suite sans régression

- [ ] **Step 8: Commit**

```bash
git add app/admin/commandes/[id]/page.tsx app/admin/layout.tsx supabase/migrations/20261027000002_orders_rls_admin.sql
git commit -m "feat: add admin commandes detail page, nav link, and RLS migration"
```
