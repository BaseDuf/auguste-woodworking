import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/data/orders', () => ({
  getOrders: vi.fn().mockResolvedValue([
    {
      id: 'order-1',
      order_number: 'CMD-001',
      email: 'client@test.fr',
      status: 'confirmee',
      total_cents: 10000,
      shipping_cents: 500,
      created_at: '2026-10-27T10:00:00Z',
    },
  ]),
}))

import CommandesPage from '../page'

it('renders order in the table', async () => {
  const jsx = await CommandesPage({ searchParams: {} })
  render(jsx)
  expect(screen.getByText('CMD-001')).toBeInTheDocument()
  expect(screen.getByText('client@test.fr')).toBeInTheDocument()
})

it('passes status filter to getOrders', async () => {
  const { getOrders } = await import('@/lib/data/orders')
  vi.mocked(getOrders).mockResolvedValueOnce([])
  await CommandesPage({ searchParams: { status: 'expediee' } })
  expect(getOrders).toHaveBeenCalledWith('expediee')
})
