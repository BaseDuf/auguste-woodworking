import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AdminOrderWithItems } from '@/lib/data/orders'

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }))
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
} as unknown as AdminOrderWithItems

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
