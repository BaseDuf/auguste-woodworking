import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('@/lib/cart/cart-context', () => ({
  useCartContext: () => ({ totalItems: 0, items: [], addItem: vi.fn(),
    removeItem: vi.fn(), updateQty: vi.fn(), clearCart: vi.fn(),
    subtotalCents: 0, shippingCents: 0, grandTotalCents: 0 }),
}))

import CartIcon from '../cart-icon'

test('renders cart link', () => {
  render(<CartIcon />)
  expect(screen.getByRole('link')).toHaveAttribute('href', '/panier')
})

test('hides badge when cart is empty', () => {
  render(<CartIcon />)
  expect(screen.queryByTestId('cart-badge')).toBeNull()
})
