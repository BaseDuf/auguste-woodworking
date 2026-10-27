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
