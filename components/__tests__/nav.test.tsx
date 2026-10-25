import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
vi.mock('next/navigation', () => ({ usePathname: () => '/' }))
import Nav from '../nav'

test('nav contains Boutique and Réalisations links', () => {
  render(<Nav />)
  expect(screen.getByRole('link', { name: /boutique/i })).toHaveAttribute('href', '/boutique')
  expect(screen.getByRole('link', { name: /réalisations/i })).toHaveAttribute('href', '/realisations')
})
