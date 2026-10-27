# Back-Office Commandes — Design Spec

## Objectif

Permettre à l'admin d'Auguste Woodworking de consulter toutes les commandes passées sur le site, de suivre leur statut, de les faire progresser dans le cycle de vie (confirmée → expédiée → livrée) et d'envoyer automatiquement un email d'expédition au client.

---

## Contexte technique

- **Framework :** Next.js 14.2 App Router, TypeScript strict
- **Auth admin :** `app/admin/layout.tsx` (guard existant — redirige vers `/admin/login` si non-admin)
- **DB :** Supabase PostgreSQL via `createAdminClient()` (`lib/supabase/admin.ts`)
- **Email :** Resend via `lib/email/send-order-confirmation.ts` (pattern à reproduire)
- **Tests :** Vitest + @testing-library/react, `vi.hoisted` pour les mocks stables

---

## Statuts de commande

```
en_attente → confirmee → expediee → livree
                      ↘ echouee (terminal, via webhook Stripe)
```

Seule l'admin avance manuellement de `confirmee` vers `expediee` puis `livree`. `echouee` est terminal.

---

## Architecture

### Fichiers créés

| Chemin | Rôle |
|--------|------|
| `app/admin/commandes/page.tsx` | Liste des commandes (RSC, filtrée par `?status=`) |
| `app/admin/commandes/[id]/page.tsx` | Détail d'une commande (RSC) |
| `app/admin/commandes/[id]/actions.ts` | Server Actions : `advanceStatus`, `sendShippingEmail` |
| `lib/data/admin-orders.ts` | `getOrders(status?)`, `getOrderById(id)` |
| `lib/email/send-shipping-notification.ts` | Email d'expédition (Resend) |
| `supabase/migrations/20261027000002_orders_rls_admin.sql` | RLS : autoriser UPDATE sur orders pour service_role |

### Fichiers modifiés

| Chemin | Changement |
|--------|------------|
| `app/admin/layout.tsx` | Ajout d'un lien « Commandes » dans la nav admin |

---

## Data layer — `lib/data/admin-orders.ts`

```ts
export type AdminOrder = Pick<Order, 'id' | 'order_number' | 'email' | 'phone' | 'status' | 'total_cents' | 'shipping_cents' | 'created_at'>
export type AdminOrderWithItems = Order & {
  order_items: (OrderItem & { products: Pick<Product, 'name'> })[]
  shipping_addresses: ShippingAddress[]
}
```

**`getOrders(status?: string): Promise<AdminOrder[]>`**
- `createAdminClient().from('orders').select('id, order_number, email, status, total_cents, shipping_cents, created_at').order('created_at', { ascending: false })`
- Si `status` fourni : `.eq('status', status)`

**`getOrderById(id: string): Promise<AdminOrderWithItems | null>`**
- `createAdminClient().from('orders').select('*, order_items(*, products(name)), shipping_addresses(*)').eq('id', id).single()`
- Retourne `null` si `error.code === 'PGRST116'`

---

## Server Actions — `app/admin/commandes/[id]/actions.ts`

### `advanceStatus(orderId: string): Promise<{ ok: boolean; error?: string }>`

Transitions autorisées :
```
confirmee → expediee
expediee  → livree
```

Implémentation : UPDATE atomique avec guard sur le statut courant.
```ts
const next = { confirmee: 'expediee', expediee: 'livree' }[current]
await supabase.from('orders').update({ status: next }).eq('id', orderId).eq('status', current)
```
Retourne `{ ok: false, error: 'Statut invalide' }` si la commande n'est plus dans l'état attendu (double-clic, actualisation).

### `sendShippingEmail(orderId: string): Promise<{ ok: boolean; error?: string }>`

1. `getOrderById(orderId)`
2. `sendShippingNotification(order)`
3. `advanceStatus(orderId)` (passe à `expediee` si encore `confirmee`)
4. `revalidatePath('/admin/commandes')`

---

## Email — `lib/email/send-shipping-notification.ts`

```ts
export async function sendShippingNotification(order: AdminOrderWithItems): Promise<void>
```

Même pattern que `send-order-confirmation.ts` : stub si `RESEND_API_KEY` absent.

Contenu de l'email :
- **Sujet :** `Votre commande ${order.order_number} a été expédiée`
- **Corps HTML :** Confirmation d'expédition, numéro de commande, message « Votre commande sera livrée dans les prochains jours. »

---

## UI

### Liste `/admin/commandes`

- **Barre de filtre :** liens `href="?status=confirmee"` etc., style pierre actif (stone-700 / stone-100).
  Libellés : Toutes · Confirmées · Expédiées · Livrées · Échouées
- **Table :**
  | # | Date | Client | Statut | Total TTC |
  Chaque ligne est cliquable → `/admin/commandes/[id]`
- **Badge statut :** couleur selon statut
  - `confirmee` → bleu
  - `expediee` → orange
  - `livree` → vert
  - `echouee` → rouge
  - `en_attente` → gris

### Détail `/admin/commandes/[id]`

- **En-tête :** numéro de commande, badge statut, date
- **Bloc client :** email, téléphone, adresse de livraison complète
- **Tableau articles :** nom produit, quantité, prix unitaire, frais de port ligne
- **Récap financier :** Sous-total / Livraison / **Total TTC**
- **Zone actions** (contextuelle selon statut) :
  - `confirmee` → bouton « Expédier et envoyer email » (appelle `sendShippingEmail`)
  - `expediee` → bouton « Marquer comme livrée » (appelle `advanceStatus`)
  - `livree` / `echouee` / `en_attente` → aucun bouton

---

## Migration SQL — `20261027000002_orders_rls_admin.sql`

```sql
-- La politique RLS actuelle bloque les UPDATE depuis le service_role si aucune politique UPDATE n'existe.
-- On s'assure que service_role peut mettre à jour le statut.
alter table public.orders enable row level security;

create policy if not exists "service_role can update orders"
  on public.orders for update
  to service_role
  using (true)
  with check (true);
```

> Note : `createAdminClient()` utilise la clé `SUPABASE_SERVICE_ROLE_KEY` qui bypasse RLS par défaut. Cette migration est une sécurité explicite au cas où le comportement changerait.

---

## Tests

| Fichier | Ce qu'il teste |
|---------|---------------|
| `lib/data/__tests__/admin-orders.test.ts` | `getOrders` (avec et sans filtre), `getOrderById` (trouvé / not found) |
| `lib/email/__tests__/send-shipping-notification.test.ts` | Stub quand pas de clé, appel Resend quand clé présente |
| `app/admin/commandes/__tests__/actions.test.ts` | `advanceStatus` (transitions valides, double-clic), `sendShippingEmail` (appelle email + avance statut) |
| `app/admin/commandes/__tests__/list.test.tsx` | Rendu de la liste, filtre actif dans l'URL |

---

## Contraintes globales

- Next.js 14.2.x — pas de `use server` dans les composants clients
- TypeScript strict — pas de `any`
- `createAdminClient()` pour toutes les lectures/écritures admin (bypass RLS)
- Vitest uniquement (`vi`, pas `jest`)
- Pas de `server-only` (package non installé)
- Tailwind CSS uniquement, palette pierre/stone existante
- Copie exacte du wording français de l'app
