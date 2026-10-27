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
