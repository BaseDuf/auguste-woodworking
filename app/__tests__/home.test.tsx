import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('@/lib/data/products', () => ({
  getFeaturedProducts: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/data/realisations', () => ({
  getRealisations: vi.fn().mockResolvedValue([]),
}))

// Next.js server components render async — test the rendered output
import Home from '../page'

test('homepage renders boutique and atelier CTAs', async () => {
  const jsx = await Home()
  render(jsx)
  expect(screen.getByRole('link', { name: /voir la boutique/i })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /découvrir l'atelier/i })).toBeInTheDocument()
})
