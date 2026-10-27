import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('@/lib/data/products', () => ({
  getPublishedProducts: vi.fn().mockResolvedValue([]),
}))

import BoutiquePage from '../page'

test('boutique shows empty state when no products', async () => {
  const jsx = await BoutiquePage({ searchParams: {} })
  render(jsx)
  expect(screen.getByText(/aucun produit disponible/i)).toBeInTheDocument()
})
