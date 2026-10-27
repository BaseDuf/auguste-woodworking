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
