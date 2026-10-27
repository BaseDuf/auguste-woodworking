import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('@/lib/cart/cart-context', () => ({
  useCartContext: () => ({
    addItem: vi.fn(), removeItem: vi.fn(), updateQty: vi.fn(), clearCart: vi.fn(),
    items: [], totalItems: 0, subtotalCents: 0, shippingCents: 0, grandTotalCents: 0,
  }),
}))

import AddToCartButton from '../add-to-cart-button'
import type { ProductWithPhotos } from '@/lib/data/products'

const base: ProductWithPhotos = {
  id: '1', slug: 'table', name: 'Table', description: null,
  price_cents: 50000, shipping_price_cents: 1500,
  stock: 1, allow_preorder: false,
  category: 'ameublement', published: true, created_at: '',
  product_photos: [],
}

test('button enabled when stock > 0', () => {
  render(<AddToCartButton product={base} />)
  expect(screen.getByRole('button', { name: /ajouter au panier/i })).not.toBeDisabled()
})

test('button disabled when stock 0 and no preorder', () => {
  render(<AddToCartButton product={{ ...base, stock: 0 }} />)
  const btn = screen.getByRole('button')
  expect(btn).toBeDisabled()
  expect(btn).toHaveTextContent(/rupture de stock/i)
})

test('button enabled with Précommander when stock 0 and allow_preorder', () => {
  render(<AddToCartButton product={{ ...base, stock: 0, allow_preorder: true }} />)
  const btn = screen.getByRole('button', { name: /précommander/i })
  expect(btn).not.toBeDisabled()
})
