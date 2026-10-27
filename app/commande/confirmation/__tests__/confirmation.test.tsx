import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: (k: string) => k === 'payment_intent' ? 'pi_test' : 'succeeded' }),
}))

vi.mock('@/lib/cart/cart-context', () => ({
  useCartContext: () => ({ clearCart: vi.fn() }),
}))

const mockOrder = {
  id: 'order-1',
  order_number: 'AW-2026-00001',
  email: 'jean@example.com',
  status: 'confirmee',
  total_cents: 51500,
  shipping_cents: 1500,
  order_items: [{ quantity: 1, unit_price_cents: 50000, products: { name: 'Table' } }],
  shipping_addresses: [{ first_name: 'Jean', last_name: 'Dupont', line1: '1 rue de la Paix', city: 'Paris', postal_code: '75001', country: 'FR', line2: null }],
}

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(mockOrder),
})

import ConfirmationPage from '../page'

test('shows order number on success', async () => {
  render(<ConfirmationPage />)
  expect(await screen.findByText(/AW-2026-00001/)).toBeInTheDocument()
})

test('shows fallback message while order is loading', () => {
  render(<ConfirmationPage />)
  expect(screen.getByText(/votre commande est en cours de traitement/i)).toBeInTheDocument()
})
