import { it, expect, vi, beforeEach } from 'vitest'
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
  updateShouldReturnRow: true,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'orders') {
        return {
          update: updateMock,
        }
      }
      return {}
    },
    rpc: () => Promise.resolve({ error: null }),
  }),
}))

beforeEach(() => {
  dbState.orderStatus = 'en_attente'
  dbState.updateShouldReturnRow = true
  vi.clearAllMocks()
  // Simulate atomic update chain: .update().eq().in().select().single()
  updateMock.mockReturnValue({
    eq: () => ({
      in: () => ({
        select: () => ({
          single: () => Promise.resolve(
            dbState.updateShouldReturnRow
              ? { data: { id: 'order-1', status: 'confirmee', email: 'test@example.com', order_items: [], shipping_addresses: [] }, error: null }
              : { data: null, error: { code: 'PGRST116' } }
          ),
        }),
      }),
      eq: () => Promise.resolve({ error: null }),
    }),
  })
})

const makeRequest = (body: string) =>
  new NextRequest('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers: { 'stripe-signature': 'valid-sig' },
  })

it('returns 400 on invalid signature', async () => {
  constructEvent.mockImplementation(() => { throw new Error('Bad signature') })
  const { POST } = await import('../route')
  const res = await POST(makeRequest('{}'))
  expect(res.status).toBe(400)
})

it('confirms order and returns 200 on payment_intent.succeeded', async () => {
  constructEvent.mockReturnValue({
    type: 'payment_intent.succeeded',
    data: { object: { id: 'pi_test', metadata: {} } },
  })
  const { POST } = await import('../route')
  const res = await POST(makeRequest('{}'))
  expect(res.status).toBe(200)
})

it('is idempotent: returns 200 without double-processing if order already confirmed', async () => {
  dbState.updateShouldReturnRow = false
  constructEvent.mockReturnValue({
    type: 'payment_intent.succeeded',
    data: { object: { id: 'pi_test', metadata: {} } },
  })
  const { POST } = await import('../route')
  const { sendOrderConfirmation } = await import('@/lib/email/send-order-confirmation')
  const res = await POST(makeRequest('{}'))
  expect(res.status).toBe(200)
  expect(sendOrderConfirmation).not.toHaveBeenCalled()
})

it('confirms order after prior failure (echouee → confirmee on retry)', async () => {
  dbState.orderStatus = 'echouee'
  dbState.updateShouldReturnRow = true
  constructEvent.mockReturnValue({
    type: 'payment_intent.succeeded',
    data: { object: { id: 'pi_test', metadata: {} } },
  })
  const { POST } = await import('../route')
  const res = await POST(makeRequest('{}'))
  expect(res.status).toBe(200)
  expect(updateMock).toHaveBeenCalled()
})

it('marks order echouee on payment_intent.payment_failed', async () => {
  constructEvent.mockReturnValue({
    type: 'payment_intent.payment_failed',
    data: { object: { id: 'pi_test' } },
  })
  const { POST } = await import('../route')
  const res = await POST(makeRequest('{}'))
  expect(res.status).toBe(200)
})
