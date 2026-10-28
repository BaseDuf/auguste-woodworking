import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/data/products', () => ({
  getAdminProducts: vi.fn().mockResolvedValue([
    {
      id: 'p1', name: 'Table en chêne', slug: 'table-chene',
      price_cents: 29900, shipping_price_cents: 1500,
      stock: 2, allow_preorder: false,
      category: 'ameublement', published: true,
      created_at: '2026-10-28T10:00:00Z',
    },
    {
      id: 'p2', name: 'Tabouret', slug: 'tabouret',
      price_cents: 8900, shipping_price_cents: 800,
      stock: 0, allow_preorder: true,
      category: null, published: false,
      created_at: '2026-10-27T10:00:00Z',
    },
  ]),
}))

import ProduitsPage from '../page'

it('renders products in the table', async () => {
  const jsx = await ProduitsPage({ searchParams: {} })
  render(jsx)
  expect(screen.getByText('Table en chêne')).toBeInTheDocument()
  expect(screen.getByText('Tabouret')).toBeInTheDocument()
})

it('passes category filter to getAdminProducts', async () => {
  const { getAdminProducts } = await import('@/lib/data/products')
  vi.mocked(getAdminProducts).mockResolvedValueOnce([])
  await ProduitsPage({ searchParams: { categorie: 'ameublement' } })
  expect(getAdminProducts).toHaveBeenCalledWith('ameublement')
})

it('shows published badge green and unpublished badge gray', async () => {
  const jsx = await ProduitsPage({ searchParams: {} })
  render(jsx)
  // published product has "Publié" text
  expect(screen.getByText('Publié')).toBeInTheDocument()
  // unpublished product has "Non publié" text
  expect(screen.getByText('Non publié')).toBeInTheDocument()
})
