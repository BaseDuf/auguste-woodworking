# Panier & Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a localStorage cart, a 3-step checkout (coordonnées → livraison → paiement), Stripe Payment Intents, and an order confirmation page with Resend email stub.

**Architecture:** Cart state lives in React context backed by `localStorage` key `"aw_cart"`. At checkout step 3 a Server Action creates the Stripe Payment Intent and the order row in Supabase simultaneously; Stripe's webhook then confirms the order, decrements stock, and sends the confirmation email. The checkout is a single client page with React step state — no per-step routes.

**Tech Stack:** Next.js 14 App Router, Supabase (service role for webhook), Stripe (`stripe` ^23 / `@stripe/stripe-js` ^10 / `@stripe/react-stripe-js`), Resend (stub when `RESEND_API_KEY` absent), Vitest v2 + @testing-library/react

**Spec:** `docs/superpowers/specs/2026-10-26-panier-checkout-design.md`

## Global Constraints

- Branch: stack every commit on `claude/keen-clarke-6b4ggw` (Plan 2)
- Next.js 14.2.x App Router — no Pages Router patterns
- TypeScript strict mode throughout
- Vitest v2 — no Jest APIs
- All monetary values in integer cents
- Prices formatted with `Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })`
- No new external dependencies beyond `resend` and `@stripe/react-stripe-js`
- All user-facing text in French
- Tailwind design tokens: `font-serif` = Cormorant Garamond, `font-sans` = Inter, warm stone/cream palette (#2c2420, #6b5e57, #faf9f7, #e5e0d8)
- `'use client'` only where interactivity requires it

## Review Focus

- **Idempotent webhook:** `payment_intent.succeeded` fires again on retry — only update order if `status = 'en_attente'` to avoid double stock decrement; tested in T6.
- **Server-side price revalidation:** `createPaymentIntent` must reload prices from Supabase, not trust client amounts — add assertion in T5 test that client-submitted price is ignored.
- **Empty-cart guard at checkout:** direct navigation to `/checkout` with empty cart must redirect to `/panier`; tested as a render check in T5.
- **PI already exists for order:** if user navigates back from step 3 and re-submits the checkout form, a new `createPaymentIntent` call would create a second order for the same session — addressed by disabling Back once PI is created; tested UI state in T5.
- **Confirmation page before webhook arrives:** webhook may not have run when Stripe redirects; page polls 3 × 1 s before showing degraded fallback; tested in T7.

---

## File Map

**New files:**
- `supabase/migrations/20261027000000_orders_v2.sql` — adds missing columns + `generate_order_number()` + INSERT RLS
- `lib/format.ts` — `formatPrice(cents: number): string`
- `lib/cart/types.ts` — `CartItem` type
- `lib/cart/use-cart.ts` — `useCart()` hook (localStorage, all mutations)
- `lib/cart/cart-context.tsx` — `CartProvider` + `useCartContext()`
- `lib/stripe/server.ts` — stripe-node singleton (lazy init)
- `lib/stripe/client.ts` — `getStripe()` → `Promise<Stripe | null>`
- `lib/email/send-order-confirmation.ts` — `sendOrderConfirmation(order)` with Resend stub
- `lib/data/orders.ts` — `getOrderByPaymentIntentId(piId: string)`
- `components/cart-icon.tsx` — badge icon for Nav
- `app/panier/page.tsx` — cart page (client component)
- `app/checkout/page.tsx` — 3-step checkout (client component)
- `app/checkout/actions.ts` — `createPaymentIntent` Server Action
- `app/checkout/_components/step-coordonnees.tsx`
- `app/checkout/_components/step-livraison.tsx`
- `app/checkout/_components/step-paiement.tsx`
- `app/checkout/_components/order-summary.tsx`
- `app/commande/confirmation/page.tsx`
- `app/api/webhooks/stripe/route.ts`

**Modified files:**
- `lib/types/database.types.ts` — add `total_cents`, `shipping_cents` to orders; `shipping_price_cents` to order_items
- `lib/supabase/__tests__/schema.test.ts` — add type-level assertions for new columns
- `components/nav.tsx` — add CartIcon
- `components/add-to-cart-button.tsx` — wire `addItem()` + "Ajouté ✓" feedback
- `app/layout.tsx` — wrap children with `CartProvider`

---

### Task 1: DB migration + updated types

**Files:**
- Create: `supabase/migrations/20261027000000_orders_v2.sql`
- Modify: `lib/types/database.types.ts`
- Modify: `lib/supabase/__tests__/schema.test.ts`

**Interfaces:**
- Produces: `Database['public']['Tables']['orders']['Row']` with `total_cents: number`, `shipping_cents: number`; `order_items.Row` with `shipping_price_cents: number`; Supabase RPC `generate_order_number` returning `string`

- [ ] **Step 1: Write failing schema tests**

Add to `lib/supabase/__tests__/schema.test.ts`:

```ts
test('Order has total_cents and shipping_cents', () => {
  const o: Partial<Order> = { total_cents: 6900, shipping_cents: 900 }
  expect(typeof o.total_cents).toBe('number')
  expect(typeof o.shipping_cents).toBe('number')
})

test('OrderItem has shipping_price_cents', () => {
  const i: Partial<OrderItem> = { shipping_price_cents: 900 }
  expect(typeof i.shipping_price_cents).toBe('number')
})
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm test -- --run lib/supabase/__tests__/schema.test.ts`
Expected: 2 new tests FAIL (TypeScript compilation error — property does not exist)

- [ ] **Step 3: Write `supabase/migrations/20261027000000_orders_v2.sql`**

```sql
-- Add missing columns to orders
alter table public.orders
  add column if not exists total_cents    integer not null default 0 check (total_cents >= 0),
  add column if not exists shipping_cents integer not null default 0 check (shipping_cents >= 0);

-- Add missing column to order_items
alter table public.order_items
  add column if not exists shipping_price_cents integer not null default 0 check (shipping_price_cents >= 0);

-- Order number generator
create or replace function public.generate_order_number()
returns text language plpgsql as $$
declare
  year_part text := extract(year from now())::text;
  seq_num   integer;
begin
  select coalesce(max(cast(substring(order_number from 9) as integer)), 0) + 1
  into seq_num
  from public.orders
  where order_number like 'AW-' || year_part || '-%';
  return 'AW-' || year_part || '-' || lpad(seq_num::text, 5, '0');
end;
$$;

-- INSERT RLS for guest checkout (anyone can place an order)
create policy if not exists "Anyone can insert orders"
  on public.orders for insert with check (true);

create policy if not exists "Anyone can insert order_items"
  on public.order_items for insert with check (true);

create policy if not exists "Anyone can insert shipping_addresses"
  on public.shipping_addresses for insert with check (true);
```

- [ ] **Step 4: Update `lib/types/database.types.ts`**

In `orders.Row`, add:
```ts
total_cents: number
shipping_cents: number
```

In `orders.Insert`, these are included via `Omit<Row, 'id' | 'created_at'>` — no change needed there.

In `order_items.Row`, add:
```ts
shipping_price_cents: number
```

- [ ] **Step 5: Run tests to confirm they pass**

Run: `npm test -- --run`
Expected: all tests pass (previously 18, now 20)

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261027000000_orders_v2.sql lib/types/database.types.ts lib/supabase/__tests__/schema.test.ts
git commit -m "feat: orders migration v2 — add total/shipping cols, order number fn, insert RLS"
```

---

### Task 2: Cart — types, hook, context

**Files:**
- Create: `lib/format.ts`
- Create: `lib/cart/types.ts`
- Create: `lib/cart/use-cart.ts`
- Create: `lib/cart/cart-context.tsx`
- Modify: `app/layout.tsx`
- Create: `lib/cart/__tests__/use-cart.test.ts`

**Interfaces:**
- Consumes: `ProductWithPhotos` from `lib/data/products`
- Produces:
  - `formatPrice(cents: number): string` from `lib/format`
  - `CartItem` from `lib/cart/types`
  - `useCartContext(): CartContextValue` from `lib/cart/cart-context`
  - `CartContextValue`: `{ items, addItem, removeItem, updateQty, clearCart, totalItems, subtotalCents, shippingCents, grandTotalCents }`

- [ ] **Step 1: Write failing tests for useCart**

Create `lib/cart/__tests__/use-cart.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'

// mock localStorage
const store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
})

import { CartProvider } from '../cart-context'
import { useCartContext } from '../cart-context'

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(CartProvider, null, children)

const mockProduct = {
  id: 'prod-1', slug: 'table', name: 'Table', price_cents: 50000,
  shipping_price_cents: 1500, stock: 3, allow_preorder: false,
  product_photos: [], description: null, category: null,
  published: true, created_at: '2026-01-01',
}

beforeEach(() => { Object.keys(store).forEach(k => delete store[k]) })

describe('addItem', () => {
  it('adds new item with quantity 1', () => {
    const { result } = renderHook(() => useCartContext(), { wrapper })
    act(() => result.current.addItem(mockProduct))
    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].quantity).toBe(1)
  })

  it('increments quantity when same product added twice', () => {
    const { result } = renderHook(() => useCartContext(), { wrapper })
    act(() => { result.current.addItem(mockProduct); result.current.addItem(mockProduct) })
    expect(result.current.items[0].quantity).toBe(2)
  })

  it('caps quantity at stock when allow_preorder is false', () => {
    const { result } = renderHook(() => useCartContext(), { wrapper })
    act(() => {
      result.current.addItem(mockProduct)
      result.current.addItem(mockProduct)
      result.current.addItem(mockProduct)
      result.current.addItem(mockProduct) // 4th — stock is 3
    })
    expect(result.current.items[0].quantity).toBe(3)
  })

  it('allows over-stock quantity when allow_preorder is true', () => {
    const preorderProduct = { ...mockProduct, stock: 0, allow_preorder: true }
    const { result } = renderHook(() => useCartContext(), { wrapper })
    act(() => { result.current.addItem(preorderProduct); result.current.addItem(preorderProduct) })
    expect(result.current.items[0].quantity).toBe(2)
  })
})

describe('removeItem', () => {
  it('removes item by productId', () => {
    const { result } = renderHook(() => useCartContext(), { wrapper })
    act(() => { result.current.addItem(mockProduct); result.current.removeItem('prod-1') })
    expect(result.current.items).toHaveLength(0)
  })
})

describe('updateQty', () => {
  it('removes item when qty set to 0', () => {
    const { result } = renderHook(() => useCartContext(), { wrapper })
    act(() => { result.current.addItem(mockProduct); result.current.updateQty('prod-1', 0) })
    expect(result.current.items).toHaveLength(0)
  })
})

describe('totals', () => {
  it('calculates subtotalCents, shippingCents, grandTotalCents correctly', () => {
    const { result } = renderHook(() => useCartContext(), { wrapper })
    act(() => { result.current.addItem(mockProduct); result.current.addItem(mockProduct) })
    // 2 × 50000 = 100000; 2 × 1500 = 3000; grand = 103000
    expect(result.current.subtotalCents).toBe(100000)
    expect(result.current.shippingCents).toBe(3000)
    expect(result.current.grandTotalCents).toBe(103000)
    expect(result.current.totalItems).toBe(2)
  })
})
```

- [ ] **Step 2: Run to confirm tests fail**

Run: `npm test -- --run lib/cart/__tests__/use-cart.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Create `lib/format.ts`**

Export `formatPrice(cents: number): string` using `Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100)`.

- [ ] **Step 4: Create `lib/cart/types.ts`**

```ts
export type CartItem = {
  productId: string
  slug: string
  name: string
  price_cents: number
  shipping_price_cents: number
  stock: number
  allow_preorder: boolean
  photo_url: string | null
  quantity: number
}
```

- [ ] **Step 5: Create `lib/cart/use-cart.ts`**

Export `useCart(): CartContextValue` implemented with `useState<CartItem[]>` + `useEffect` for localStorage persistence (key `"aw_cart"`). Implement `addItem`, `removeItem`, `updateQty`, `clearCart`, and derive `totalItems`, `subtotalCents`, `shippingCents`, `grandTotalCents`. `addItem` snapshots `productId`, `slug`, `name`, `price_cents`, `shipping_price_cents`, `stock`, `allow_preorder`, `photo_url` (first `product_photos[0]?.url ?? null`) from the `ProductWithPhotos` argument.

- [ ] **Step 6: Create `lib/cart/cart-context.tsx`**

`'use client'`. Create `CartContext` with `React.createContext`. Export `CartProvider` (wraps children, uses `useCart()`). Export `useCartContext()` that throws if used outside provider.

- [ ] **Step 7: Update `app/layout.tsx`**

Wrap `<Nav /><main ...>{children}</main><Footer />` with `<CartProvider>`. The layout itself stays a Server Component — `CartProvider` is the client boundary.

- [ ] **Step 8: Run all tests**

Run: `npm test -- --run`
Expected: all tests pass (≥ 28)

- [ ] **Step 9: Commit**

```bash
git add lib/format.ts lib/cart/ app/layout.tsx
git commit -m "feat: cart — CartItem type, useCart hook, CartProvider, layout wrap"
```

---

### Task 3: Cart UI — icon, AddToCartButton, /panier page

**Files:**
- Create: `components/cart-icon.tsx`
- Modify: `components/nav.tsx`
- Modify: `components/add-to-cart-button.tsx`
- Create: `app/panier/page.tsx`
- Create: `app/panier/__tests__/panier.test.tsx`
- Create: `components/__tests__/cart-icon.test.tsx`

**Interfaces:**
- Consumes: `useCartContext()` from `lib/cart/cart-context`; `CartItem` from `lib/cart/types`; `formatPrice` from `lib/format`
- Produces: `<CartIcon />` component; `/panier` page; wired `<AddToCartButton />`

- [ ] **Step 1: Write failing tests**

Create `components/__tests__/cart-icon.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('@/lib/cart/cart-context', () => ({
  useCartContext: () => ({ totalItems: 0, items: [], addItem: vi.fn(),
    removeItem: vi.fn(), updateQty: vi.fn(), clearCart: vi.fn(),
    subtotalCents: 0, shippingCents: 0, grandTotalCents: 0 }),
}))

import CartIcon from '../cart-icon'

test('renders cart link', () => {
  render(<CartIcon />)
  expect(screen.getByRole('link')).toHaveAttribute('href', '/panier')
})

test('hides badge when cart is empty', () => {
  render(<CartIcon />)
  expect(screen.queryByTestId('cart-badge')).toBeNull()
})
```

Create `app/panier/__tests__/panier.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

vi.mock('@/lib/cart/cart-context', () => ({
  useCartContext: () => ({
    items: [], totalItems: 0, subtotalCents: 0, shippingCents: 0,
    grandTotalCents: 0, removeItem: vi.fn(), updateQty: vi.fn(),
    addItem: vi.fn(), clearCart: vi.fn(),
  }),
}))

import PanierPage from '../page'

test('shows empty state when cart is empty', () => {
  render(<PanierPage />)
  expect(screen.getByText(/votre panier est vide/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to confirm they fail**

Run: `npm test -- --run components/__tests__/cart-icon.test.tsx app/panier/__tests__/panier.test.tsx`
Expected: FAIL — modules not found

- [ ] **Step 3: Create `components/cart-icon.tsx`**

`'use client'`. Link to `/panier`. Show `data-testid="cart-badge"` span with `totalItems` only when `totalItems > 0`. Styling: small red badge overlaid on a shopping bag icon (use a simple SVG inline or `🛒` unicode, consistent with the warm palette).

- [ ] **Step 4: Update `components/nav.tsx`**

Import `CartIcon` and render it after the navigation links `<ul>`, inside the `<nav>` flex container.

- [ ] **Step 5: Update `components/add-to-cart-button.tsx`**

Import `useCartContext`. Replace the `console.log` placeholder with `addItem(product)`. Add `added` state (boolean, resets after 1 000 ms via `setTimeout`). When `added` is true, show "Ajouté ✓" as the label (button still enabled).

- [ ] **Step 6: Create `app/panier/page.tsx`**

`'use client'`. Renders:
- Empty state (when `items.length === 0`): "Votre panier est vide." + Link to `/boutique`
- Item list: each item shows `name`, `formatPrice(price_cents)` per unit, frais de livraison `formatPrice(shipping_price_cents)`, quantity selector (−/+) calling `updateQty`, delete button calling `removeItem`
- Summary: sous-total `formatPrice(subtotalCents)`, frais de livraison `formatPrice(shippingCents)`, **total TTC** `formatPrice(grandTotalCents)`
- CTA button: `<Link href="/checkout">Passer commande</Link>` (disabled-style if empty)

- [ ] **Step 7: Run all tests**

Run: `npm test -- --run`
Expected: all tests pass (≥ 30)

- [ ] **Step 8: Commit**

```bash
git add components/cart-icon.tsx components/nav.tsx components/add-to-cart-button.tsx app/panier/ components/__tests__/cart-icon.test.tsx
git commit -m "feat: cart UI — CartIcon in Nav, AddToCartButton wired, /panier page"
```

---

### Task 4: Stripe + Resend plumbing

**Files:**
- Create: `lib/stripe/server.ts`
- Create: `lib/stripe/client.ts`
- Create: `lib/email/send-order-confirmation.ts`
- Create: `lib/data/orders.ts`
- Create: `lib/email/__tests__/send-order-confirmation.test.ts`
- Create: `lib/data/__tests__/orders.test.ts`

**Interfaces:**
- Produces:
  - `getStripe(): Promise<Stripe | null>` from `lib/stripe/client`
  - `getStripeServer(): Stripe` from `lib/stripe/server` (lazy singleton)
  - `sendOrderConfirmation(order: OrderForEmail): Promise<void>` from `lib/email/send-order-confirmation`
  - `getOrderByPaymentIntentId(piId: string): Promise<OrderWithItems | null>` from `lib/data/orders`
  - `OrderWithItems` = `Order & { order_items: (OrderItem & { product: Pick<Product, 'name'> })[] } & { shipping_addresses: ShippingAddress[] }`

- [ ] **Step 1: Install dependencies**

```bash
npm install resend @stripe/react-stripe-js
```

Verify `package.json` now lists `resend` and `@stripe/react-stripe-js`.

- [ ] **Step 2: Write failing tests for email stub**

Create `lib/email/__tests__/send-order-confirmation.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(() => { vi.unstubAllEnvs() })

const mockOrder = {
  id: 'order-1', order_number: 'AW-2026-00001', email: 'test@example.com',
  order_items: [{ product: { name: 'Table' }, quantity: 1, unit_price_cents: 50000 }],
  shipping_addresses: [{ first_name: 'Jean', last_name: 'Dupont', line1: '1 rue de la Paix', city: 'Paris', postal_code: '75001', country: 'FR', line2: null }],
}

describe('sendOrderConfirmation', () => {
  it('logs and returns when RESEND_API_KEY is absent', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { sendOrderConfirmation } = await import('../send-order-confirmation')
    await expect(sendOrderConfirmation(mockOrder as never)).resolves.toBeUndefined()
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('RESEND_API_KEY'), expect.any(String))
    consoleSpy.mockRestore()
  })
})
```

Create `lib/data/__tests__/orders.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

const state = vi.hoisted(() => ({ result: { data: null as unknown, error: null as unknown } }))

vi.mock('@/lib/supabase/server', () => {
  const chain: Record<string, unknown> = {}
  const self = () => chain
  Object.assign(chain, {
    select: self, eq: self, single: () => Promise.resolve(state.result),
  })
  return { createClient: () => ({ from: () => chain }) }
})

import { getOrderByPaymentIntentId } from '../orders'

it('returns null when order not found', async () => {
  state.result = { data: null, error: { code: 'PGRST116' } }
  const result = await getOrderByPaymentIntentId('pi_test')
  expect(result).toBeNull()
})
```

- [ ] **Step 3: Run to confirm they fail**

Run: `npm test -- --run lib/email/__tests__/send-order-confirmation.test.ts lib/data/__tests__/orders.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 4: Create `lib/stripe/server.ts`**

Lazy singleton: `let stripe: Stripe | null = null`. Export `getStripeServer(): Stripe` that initialises on first call with `new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })`.

- [ ] **Step 5: Create `lib/stripe/client.ts`**

```ts
import { loadStripe } from '@stripe/stripe-js'
let stripePromise: ReturnType<typeof loadStripe>
export function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
  }
  return stripePromise
}
```

- [ ] **Step 6: Create `lib/email/send-order-confirmation.ts`**

Export `OrderForEmail` type and `sendOrderConfirmation(order: OrderForEmail): Promise<void>`. If `!process.env.RESEND_API_KEY`, log `'[email] RESEND_API_KEY absent — confirmation non envoyée'` and return. Otherwise wrap a `new Resend(process.env.RESEND_API_KEY).emails.send(...)` call in try/catch, logging errors without rethrowing.

Email content: plain subject `Confirmation de commande ${order.order_number}`, `from: 'Auguste Woodworking <commandes@auguste-woodworking.fr>'`, `to: order.email`. Body: text listing order number, items, total, shipping address.

- [ ] **Step 7: Create `lib/data/orders.ts`**

Export `getOrderByPaymentIntentId(piId: string): Promise<OrderWithItems | null>`. Uses `createClient()` (server). Selects `*, order_items(*, products(name)), shipping_addresses(*)` from `orders` where `stripe_payment_intent_id = piId`. Returns `null` on `PGRST116`; logs other errors.

- [ ] **Step 8: Run all tests**

Run: `npm test -- --run`
Expected: all tests pass (≥ 32)

- [ ] **Step 9: Commit**

```bash
git add lib/stripe/ lib/email/ lib/data/orders.ts lib/email/__tests__/ lib/data/__tests__/orders.test.ts package.json package-lock.json
git commit -m "feat: Stripe + Resend plumbing — server/client helpers, email stub, orders data layer"
```

---

### Task 5: Checkout page + Server Action

**Files:**
- Create: `app/checkout/actions.ts`
- Create: `app/checkout/page.tsx`
- Create: `app/checkout/_components/step-coordonnees.tsx`
- Create: `app/checkout/_components/step-livraison.tsx`
- Create: `app/checkout/_components/step-paiement.tsx`
- Create: `app/checkout/_components/order-summary.tsx`
- Create: `app/checkout/__tests__/checkout.test.tsx`
- Create: `app/checkout/__tests__/actions.test.ts`

**Interfaces:**
- Consumes: `useCartContext()`, `getStripeServer()`, `createClient` (supabase server), `formatPrice`, `getStripe()`, `@stripe/react-stripe-js`
- Produces:
  - `createPaymentIntent(data: CheckoutData): Promise<CreatePIResult>` — Server Action
  - `/checkout` page

```ts
// app/checkout/actions.ts
type CheckoutData = {
  coordonnees: { firstName: string; lastName: string; email: string; phone: string }
  adresse: { line1: string; line2?: string; city: string; postalCode: string; country: string }
  items: { productId: string; quantity: number }[]
}
type CreatePIResult =
  | { ok: true; clientSecret: string; orderId: string }
  | { ok: false; error: string }
```

- [ ] **Step 1: Write failing tests**

Create `app/checkout/__tests__/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Stripe mock
vi.mock('@/lib/stripe/server', () => ({
  getStripeServer: () => ({
    paymentIntents: {
      create: vi.fn().mockResolvedValue({ id: 'pi_test', client_secret: 'pi_test_secret' }),
    },
  }),
}))

const supabaseState = vi.hoisted(() => ({
  products: [] as unknown[],
  insertError: null as unknown,
}))

vi.mock('@/lib/supabase/server', () => {
  const makeChain = (data: unknown) => {
    const chain: Record<string, unknown> = {}
    const self = () => chain
    Object.assign(chain, {
      select: self, eq: self, in: () => Promise.resolve({ data, error: null }),
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'order-1', order_number: 'AW-2026-00001' }, error: supabaseState.insertError }) }) }),
    })
    return chain
  }
  return {
    createClient: () => ({
      from: (table: string) => {
        if (table === 'products') return makeChain(supabaseState.products)
        return makeChain([])
      },
      rpc: () => Promise.resolve({ data: 'AW-2026-00001', error: null }),
    }),
  }
})

import { createPaymentIntent } from '../actions'

const validData = {
  coordonnees: { firstName: 'Jean', lastName: 'Dupont', email: 'jean@example.com', phone: '0612345678' },
  adresse: { line1: '1 rue de la Paix', city: 'Paris', postalCode: '75001', country: 'FR' },
  items: [{ productId: 'prod-1', quantity: 1 }],
}

beforeEach(() => {
  supabaseState.products = [{
    id: 'prod-1', price_cents: 50000, shipping_price_cents: 1500,
    stock: 5, allow_preorder: false,
  }]
  supabaseState.insertError = null
})

it('returns clientSecret on success', async () => {
  const result = await createPaymentIntent(validData)
  expect(result).toMatchObject({ ok: true, clientSecret: 'pi_test_secret' })
})

it('rejects if product stock is 0 and allow_preorder is false', async () => {
  supabaseState.products = [{ id: 'prod-1', price_cents: 50000, shipping_price_cents: 1500, stock: 0, allow_preorder: false }]
  const result = await createPaymentIntent(validData)
  expect(result).toMatchObject({ ok: false })
})

it('uses server-side price, ignoring any client-submitted amount', async () => {
  // products returns price_cents 50000; PI must be created with that, not any client value
  const { getStripeServer } = await import('@/lib/stripe/server')
  const piCreate = (getStripeServer() as ReturnType<typeof getStripeServer>).paymentIntents.create as ReturnType<typeof vi.fn>
  await createPaymentIntent(validData)
  const callArgs = piCreate.mock.calls[0]?.[0] as { amount: number } | undefined
  expect(callArgs?.amount).toBe(51500) // 50000 + 1500, server-computed
})
```

Create `app/checkout/__tests__/checkout.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), redirect: vi.fn() }))
vi.mock('@/lib/cart/cart-context', () => ({
  useCartContext: () => ({
    items: [], totalItems: 0, subtotalCents: 0, shippingCents: 0,
    grandTotalCents: 0, clearCart: vi.fn(),
  }),
}))

import CheckoutPage from '../page'

test('redirects / shows empty cart message when cart is empty', () => {
  render(<CheckoutPage />)
  expect(screen.getByText(/votre panier est vide/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to confirm they fail**

Run: `npm test -- --run app/checkout/__tests__/`
Expected: FAIL — modules not found

- [ ] **Step 3: Create `app/checkout/actions.ts`**

`'use server'` at top. Implement `createPaymentIntent(data: CheckoutData): Promise<CreatePIResult>`:
1. Load products from Supabase by `id IN (data.items.map(i => i.productId))`
2. Verify each item: product found, `stock > 0 || allow_preorder` — return `{ ok: false, error: 'Stock insuffisant pour ...' }` on failure
3. Compute `totalCents = Σ price_cents × qty` and `shippingCents = Σ shipping_price_cents × qty` using server-loaded prices only
4. Call `supabase.rpc('generate_order_number')` → `orderNumber`
5. Create PI: `getStripeServer().paymentIntents.create({ amount: totalCents + shippingCents, currency: 'eur', metadata: { order_number: orderNumber } })`
6. Insert into `orders` (status `en_attente`, `stripe_payment_intent_id: pi.id`, `total_cents`, `shipping_cents`, email, phone)
7. Insert `order_items` rows
8. Insert `shipping_addresses` row
9. Return `{ ok: true, clientSecret: pi.client_secret!, orderId: order.id }`
10. Wrap in try/catch → `{ ok: false, error: 'Erreur inattendue' }`

Use `createClient()` from `@/lib/supabase/server`.

- [ ] **Step 4: Create `app/checkout/_components/order-summary.tsx`**

Props: `{ items: CartItem[]; subtotalCents: number; shippingCents: number; grandTotalCents: number }`. Renders a right-column summary with item list, sous-total, frais de livraison, total TTC using `formatPrice`. No client directive needed (pure display).

- [ ] **Step 5: Create `app/checkout/_components/step-coordonnees.tsx`**

`'use client'`. Props: `{ onNext: (data: Coordonnees) => void }`. Simple controlled form: prénom, nom, email (required), téléphone. Checkbox "Créer un compte" — `disabled`, label "Bientôt disponible". Submit → `onNext(data)`.

- [ ] **Step 6: Create `app/checkout/_components/step-livraison.tsx`**

`'use client'`. Props: `{ onNext: (data: Adresse) => void; onBack: () => void }`. Fields: ligne 1 (required), ligne 2, ville (required), code postal (required), pays (select with FR default). Submit → `onNext(data)`.

- [ ] **Step 7: Create `app/checkout/_components/step-paiement.tsx`**

`'use client'`. Props: `{ clientSecret: string; onBack: () => void; onSuccess: () => void }`. Uses `@stripe/react-stripe-js`: wraps in `<Elements stripe={getStripe()} options={{ clientSecret }}>`. Inner component uses `useStripe()`, `useElements()`. On submit: `stripe.confirmPayment({ elements, confirmParams: { return_url: window.location.origin + '/commande/confirmation' } })`. On error: show inline below form. Back button disabled (PI already created).

- [ ] **Step 8: Create `app/checkout/page.tsx`**

`'use client'`. Types: `Step = 1 | 2 | 3`. State: `step`, `coordonnees: Coordonnees | null`, `adresse: Adresse | null`, `clientSecret: string | null`, `loading: boolean`, `piError: string | null`.

If `items.length === 0`: render "Votre panier est vide." + Link `/panier`.

Step 1 → renders `<StepCoordonnees onNext={...} />` + `<OrderSummary ... />`
Step 2 → renders `<StepLivraison onNext={...} onBack={...} />` + `<OrderSummary ... />`
Step 3 → on mount (when coordonnees + adresse set): call `createPaymentIntent()` → set `clientSecret`. Show spinner while loading. On `ok: false` show `piError`. Once `clientSecret` set: render `<StepPaiement clientSecret={clientSecret} onBack={...} onSuccess={clearCart} />` + `<OrderSummary ... />`.

- [ ] **Step 9: Run all tests**

Run: `npm test -- --run`
Expected: all tests pass (≥ 36)

- [ ] **Step 10: Commit**

```bash
git add app/checkout/
git commit -m "feat: checkout — 3-step form, createPaymentIntent server action, Stripe Elements"
```

---

### Task 6: Stripe webhook route

**Files:**
- Create: `app/api/webhooks/stripe/route.ts`
- Create: `app/api/webhooks/stripe/__tests__/webhook.test.ts`

**Interfaces:**
- Consumes: `getStripeServer()`, `createClient` (supabase server — service role key), `sendOrderConfirmation`
- Produces: POST `/api/webhooks/stripe`

- [ ] **Step 1: Write failing tests**

Create `app/api/webhooks/stripe/__tests__/webhook.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/stripe/server', () => ({
  getStripeServer: () => ({
    webhooks: {
      constructEvent: vi.fn(),
    },
  }),
}))

vi.mock('@/lib/email/send-order-confirmation', () => ({
  sendOrderConfirmation: vi.fn().mockResolvedValue(undefined),
}))

const dbState = vi.hoisted(() => ({
  orderStatus: 'en_attente' as string,
  updateError: null as unknown,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: 'order-1', status: dbState.orderStatus, email: 'test@example.com', order_items: [], shipping_addresses: [] }, error: null }) }) }),
      update: () => ({ eq: () => Promise.resolve({ error: dbState.updateError }) }),
    }),
    rpc: () => Promise.resolve({ error: null }),
  }),
}))

import { POST } from '../route'

const makeRequest = (body: string) =>
  new NextRequest('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers: { 'stripe-signature': 'valid-sig' },
  })

const { getStripeServer } = await import('@/lib/stripe/server')
const constructEvent = (getStripeServer() as ReturnType<typeof getStripeServer>).webhooks.constructEvent as ReturnType<typeof vi.fn>

beforeEach(() => {
  dbState.orderStatus = 'en_attente'
  dbState.updateError = null
  vi.clearAllMocks()
})

it('returns 400 on invalid signature', async () => {
  constructEvent.mockImplementation(() => { throw new Error('Bad signature') })
  const res = await POST(makeRequest('{}'))
  expect(res.status).toBe(400)
})

it('confirms order and returns 200 on payment_intent.succeeded', async () => {
  constructEvent.mockReturnValue({
    type: 'payment_intent.succeeded',
    data: { object: { id: 'pi_test', metadata: {} } },
  })
  const res = await POST(makeRequest('{}'))
  expect(res.status).toBe(200)
})

it('is idempotent: skips update if order already confirmed', async () => {
  dbState.orderStatus = 'confirmee'
  constructEvent.mockReturnValue({
    type: 'payment_intent.succeeded',
    data: { object: { id: 'pi_test', metadata: {} } },
  })
  const res = await POST(makeRequest('{}'))
  expect(res.status).toBe(200)
  // update should NOT have been called (idempotency guard)
})

it('marks order echouee on payment_intent.payment_failed', async () => {
  constructEvent.mockReturnValue({
    type: 'payment_intent.payment_failed',
    data: { object: { id: 'pi_test' } },
  })
  const res = await POST(makeRequest('{}'))
  expect(res.status).toBe(200)
})
```

- [ ] **Step 2: Run to confirm they fail**

Run: `npm test -- --run app/api/webhooks/stripe/__tests__/webhook.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create `app/api/webhooks/stripe/route.ts`**

Export `POST(request: NextRequest)`.

```
1. const sig = request.headers.get('stripe-signature') ?? ''
2. const body = await request.text()
3. Try: const event = getStripeServer().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
   Catch: return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
4. const pi = event.data.object as Stripe.PaymentIntent
5. switch (event.type):
   - 'payment_intent.succeeded':
       a. Fetch order by stripe_payment_intent_id = pi.id
       b. If not found or status !== 'en_attente': return 200 (idempotency)
       c. Update order status to 'confirmee'
       d. For each order_item: call supabase.rpc('decrement_product_stock', { product_id, qty: quantity })
          (or inline UPDATE products SET stock = stock - quantity)
       e. sendOrderConfirmation(order)
   - 'payment_intent.payment_failed':
       a. Update order status to 'echouee'
   - default: no-op
6. return NextResponse.json({ received: true }, { status: 200 })
```

For stock decrement, use a direct supabase call (service role client):
```ts
await supabase.rpc('decrement_product_stock', { p_product_id: item.product_id, p_qty: item.quantity })
```

Add a helper SQL function to the migration (or inline it in the route with raw update — prefer the SQL approach). **Add to `supabase/migrations/20261027000000_orders_v2.sql`:**

```sql
create or replace function public.decrement_product_stock(p_product_id uuid, p_qty integer)
returns void language plpgsql security definer as $$
begin
  update public.products
  set stock = greatest(0, stock - p_qty)
  where id = p_product_id;
end;
$$;
```

Update the migration file accordingly before running the test.

- [ ] **Step 4: Run all tests**

Run: `npm test -- --run`
Expected: all tests pass (≥ 40)

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/ supabase/migrations/20261027000000_orders_v2.sql
git commit -m "feat: Stripe webhook — confirm order, decrement stock, send confirmation email"
```

---

### Task 7: Confirmation page

**Files:**
- Create: `app/commande/confirmation/page.tsx`
- Create: `app/commande/confirmation/__tests__/confirmation.test.tsx`

**Interfaces:**
- Consumes: `getOrderByPaymentIntentId` from `lib/data/orders`; `formatPrice` from `lib/format`
- Produces: `/commande/confirmation?payment_intent=pi_xxx&redirect_status=succeeded` page

- [ ] **Step 1: Write failing test**

Create `app/commande/confirmation/__tests__/confirmation.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: (k: string) => k === 'payment_intent' ? 'pi_test' : 'succeeded' }),
}))

vi.mock('@/lib/data/orders', () => ({
  getOrderByPaymentIntentId: vi.fn().mockResolvedValue({
    id: 'order-1',
    order_number: 'AW-2026-00001',
    email: 'jean@example.com',
    status: 'confirmee',
    total_cents: 51500,
    shipping_cents: 1500,
    order_items: [{ quantity: 1, unit_price_cents: 50000, products: { name: 'Table' } }],
    shipping_addresses: [{ first_name: 'Jean', last_name: 'Dupont', line1: '1 rue de la Paix', city: 'Paris', postal_code: '75001', country: 'FR', line2: null }],
  }),
}))

import ConfirmationPage from '../page'

test('shows order number on success', async () => {
  render(<ConfirmationPage />)
  // wait for async load
  expect(await screen.findByText(/AW-2026-00001/)).toBeInTheDocument()
})

test('shows fallback message while order is loading', () => {
  render(<ConfirmationPage />)
  expect(screen.getByText(/votre commande est en cours de traitement/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to confirm test fails**

Run: `npm test -- --run app/commande/confirmation/__tests__/confirmation.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Create `app/commande/confirmation/page.tsx`**

`'use client'`. Uses `useSearchParams()` to read `payment_intent` and `redirect_status`.

State: `order: OrderWithItems | null`, `loading: boolean`, `attempts: number`.

On mount: if `redirect_status === 'failed'` → show "Votre paiement a été refusé. Veuillez réessayer." + Link back to checkout.

Otherwise: call `getOrderByPaymentIntentId(payment_intent)`. If null and `attempts < 3`: retry after 1 000 ms (increment `attempts`). If null after 3 attempts: show degraded fallback "Votre commande est en cours de traitement. Numéro de référence : {payment_intent}".

When `order` found:
- Titre h1: "Merci pour votre commande !"
- Numéro: `order.order_number` (prominent, data-testid="order-number")
- "Un email de confirmation a été envoyé à {order.email}"
- Table des lignes: nom, qté, prix
- Total TTC: `formatPrice(order.total_cents)`
- Adresse de livraison
- Link "Retourner à la boutique" → `/boutique`

While loading: "Votre commande est en cours de traitement…" (visible immediately before order loads)

- [ ] **Step 4: Run all tests**

Run: `npm test -- --run`
Expected: all tests pass (≥ 42)

- [ ] **Step 5: Commit**

```bash
git add app/commande/
git commit -m "feat: confirmation page — order details, polling for webhook, fallback"
```

---

## Post-implementation checklist

After all tasks, verify:
- [ ] `npm test -- --run` passes with ≥ 42 tests
- [ ] `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` documented in `.env.example` (add file if absent)
- [ ] `RESEND_API_KEY` also in `.env.example` marked optional
- [ ] Cart badge disappears after `clearCart()` on successful payment
- [ ] `/checkout` with empty cart shows the empty-cart guard (not a blank page)
