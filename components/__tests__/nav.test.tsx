import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
vi.mock('next/navigation', () => ({ usePathname: () => '/' }))
vi.mock('@/lib/cart/cart-context', () => ({
  useCartContext: () => ({
    addItem: vi.fn(), removeItem: vi.fn(), updateQty: vi.fn(), clearCart: vi.fn(),
    items: [], totalItems: 0, subtotalCents: 0, shippingCents: 0, grandTotalCents: 0,
  }),
}))
import Nav from '../nav'

test('nav contains Boutique and Réalisations links', () => {
  render(<Nav />)
  expect(screen.getByRole('link', { name: /boutique/i })).toHaveAttribute('href', '/boutique')
  expect(screen.getByRole('link', { name: /réalisations/i })).toHaveAttribute('href', '/realisations')
})
