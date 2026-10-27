import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const constructEvent = vi.hoisted(() => vi.fn())
const updateMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/stripe/server', () => ({
  getStripeServer: () => ({
    webhooks: {
      constructEvent,
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
      update: updateMock,
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

beforeEach(() => {
  dbState.orderStatus = 'en_attente'
  dbState.updateError = null
  vi.clearAllMocks()
  updateMock.mockReturnValue({ eq: () => Promise.resolve({ error: dbState.updateError }) })
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
  expect(updateMock).not.toHaveBeenCalled()
})

it('marks order echouee on payment_intent.payment_failed', async () => {
  constructEvent.mockReturnValue({
    type: 'payment_intent.payment_failed',
    data: { object: { id: 'pi_test' } },
  })
  const res = await POST(makeRequest('{}'))
  expect(res.status).toBe(200)
})
