import { describe, it, expect, vi, beforeEach } from 'vitest'

// Stripe mock — hoisted so the same spy instance is shared across all calls
const stripeCreateMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ id: 'pi_test', client_secret: 'pi_test_secret' })
)

vi.mock('@/lib/stripe/server', () => ({
  getStripeServer: () => ({
    paymentIntents: {
      create: stripeCreateMock,
    },
  }),
}))

const supabaseState = vi.hoisted(() => ({
  products: [] as unknown[],
  insertError: null as unknown,
}))

vi.mock('@/lib/supabase/admin', () => {
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
    createAdminClient: () => ({
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
  stripeCreateMock.mockClear()
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
  await createPaymentIntent(validData)
  const callArgs = stripeCreateMock.mock.calls[0]?.[0] as { amount: number } | undefined
  expect(callArgs?.amount).toBe(51500) // 50000 + 1500, server-computed
})
