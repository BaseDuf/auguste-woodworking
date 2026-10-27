// app/admin/commandes/__tests__/actions.test.ts
import { describe, it, expect, vi } from 'vitest'

const mockGetOrderById = vi.hoisted(() => vi.fn())
const mockSendShippingNotification = vi.hoisted(() => vi.fn())
const mockRevalidatePath = vi.hoisted(() => vi.fn())

vi.mock('@/lib/data/orders', () => ({ getOrderById: mockGetOrderById }))
vi.mock('@/lib/email/send-shipping-notification', () => ({
  sendShippingNotification: mockSendShippingNotification,
}))
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))

// For advanceStatus: mock createAdminClient with configurable status
const mockStatus = vi.hoisted(() => ({ value: 'confirmee' as string }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { status: mockStatus.value }, error: null }),
        }),
      }),
      update: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }),
    }),
  }),
}))

import { advanceStatus, sendShippingEmail } from '../[id]/actions'

describe('advanceStatus', () => {
  it('advances from confirmee to expediee', async () => {
    mockStatus.value = 'confirmee'
    const result = await advanceStatus('order-1')
    expect(result).toEqual({ ok: true })
  })

  it('advances from expediee to livree', async () => {
    mockStatus.value = 'expediee'
    const result = await advanceStatus('order-1')
    expect(result).toEqual({ ok: true })
  })

  it('returns error for invalid transition (livree is terminal)', async () => {
    mockStatus.value = 'livree'
    const result = await advanceStatus('order-bad')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Statut invalide')
  })
})

describe('sendShippingEmail', () => {
  it('calls sendShippingNotification and returns ok', async () => {
    mockGetOrderById.mockResolvedValue({
      id: 'o1', order_number: 'CMD-001', email: 'x@x.fr',
      order_items: [], shipping_addresses: [], status: 'confirmee',
    })
    mockSendShippingNotification.mockResolvedValue(undefined)
    mockStatus.value = 'confirmee'
    const result = await sendShippingEmail('o1')
    expect(mockSendShippingNotification).toHaveBeenCalled()
    expect(result).toEqual({ ok: true })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/commandes')
  })

  it('returns error when order not found', async () => {
    mockGetOrderById.mockResolvedValue(null)
    const result = await sendShippingEmail('missing')
    expect(result.ok).toBe(false)
    expect(result.error).toBeDefined()
  })
})
