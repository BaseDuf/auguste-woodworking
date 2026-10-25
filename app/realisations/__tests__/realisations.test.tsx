import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('@/lib/data/realisations', () => ({
  getRealisations: vi.fn().mockResolvedValue([
    { id: '1', title: 'Table sur-mesure', description: 'Une belle table',
      created_at: '', realisation_photos: [{ id: 'p1', url: '/photo.jpg', position: 0, realisation_id: '1' }] }
  ]),
}))

import RealisationsPage from '../page'

test('realisations page renders realisation titles', async () => {
  const jsx = await RealisationsPage()
  render(jsx)
  expect(screen.getByText('Table sur-mesure')).toBeInTheDocument()
})
