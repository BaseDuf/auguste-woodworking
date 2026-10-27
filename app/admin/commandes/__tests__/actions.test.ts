// app/admin/commandes/__tests__/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

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

// For requireAdmin: mock createClient from supabase/server
const mockAuthUser = vi.hoisted(() => ({ value: null as { id: string } | null }))
const mockProfileRole = vi.hoisted(() => ({ value: 'admin' as string }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: mockAuthUser.value }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({ data: { role: mockProfileRole.value }, error: null }),
        }),
      }),
    }),
  }),
}))

import { advanceStatus, sendShippingEmail } from '../[id]/actions'

describe('auth guard', () => {
  beforeEach(() => {
    mockAuthUser.value = null
    mockProfileRole.value = 'admin'
  })

  it('advanceStatus returns Non autorisé when user is not admin', async () => {
    // No authenticated user
    mockAuthUser.value = null
    const result = await advanceStatus('order-1')
    expect(result).toEqual({ ok: false, error: 'Non autorisé' })
  })

  it('sendShippingEmail returns Non autorisé when user is not admin', async () => {
    mockAuthUser.value = null
    const result = await sendShippingEmail('order-1')
    expect(result).toEqual({ ok: false, error: 'Non autorisé' })
  })
})

describe('advanceStatus', () => {
  beforeEach(() => {
    mockAuthUser.value = { id: 'user-1' }
    mockProfileRole.value = 'admin'
  })
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
  beforeEach(() => {
    mockAuthUser.value = { id: 'user-1' }
    mockProfileRole.value = 'admin'
    mockSendShippingNotification.mockReset()
    mockRevalidatePath.mockReset()
  })

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

  it('returns Statut invalide when order status is not confirmee', async () => {
    mockGetOrderById.mockResolvedValue({
      id: 'o2', order_number: 'CMD-002', email: 'y@y.fr',
      order_items: [], shipping_addresses: [], status: 'expediee',
    })
    mockStatus.value = 'expediee'
    const result = await sendShippingEmail('o2')
    expect(result).toEqual({ ok: false, error: 'Statut invalide' })
    expect(mockSendShippingNotification).not.toHaveBeenCalled()
  })
})
