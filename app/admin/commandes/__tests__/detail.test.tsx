import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/data/orders', () => ({
  getOrderById: vi.fn().mockResolvedValue({
    id: 'order-1',
    order_number: 'CMD-001',
    email: 'client@test.fr',
    phone: '+33 6 12 34 56 78',
    status: 'confirmee',
    total_cents: 10500,
    shipping_cents: 500,
    created_at: '2026-10-27T10:00:00Z',
    order_items: [
      {
        quantity: 2,
        unit_price_cents: 5000,
        products: { name: 'Table en chêne' },
      },
    ],
    shipping_addresses: [
      {
        first_name: 'Jean',
        last_name: 'Dupont',
        line1: '1 rue de la Paix',
        line2: null,
        postal_code: '75001',
        city: 'Paris',
        country: 'France',
      },
    ],
  }),
}))

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('notFound') }),
}))

vi.mock('@/app/admin/commandes/[id]/actions', () => ({
  advanceStatus: vi.fn().mockResolvedValue({ ok: true }),
  sendShippingEmail: vi.fn().mockResolvedValue({ ok: true }),
}))

import CommandeDetailPage from '../[id]/page'

describe('CommandeDetailPage', () => {
  it('renders order detail', async () => {
    const jsx = await CommandeDetailPage({ params: { id: 'order-1' } })
    render(jsx)
    expect(screen.getByText('CMD-001')).toBeInTheDocument()
    expect(screen.getByText('client@test.fr')).toBeInTheDocument()
    expect(screen.getByText('Table en chêne')).toBeInTheDocument()
  })

  it('calls notFound when order not found', async () => {
    const { getOrderById } = await import('@/lib/data/orders')
    vi.mocked(getOrderById).mockResolvedValueOnce(null)
    const { notFound } = await import('next/navigation')
    await expect(CommandeDetailPage({ params: { id: 'missing' } })).rejects.toThrow('notFound')
    expect(notFound).toHaveBeenCalled()
  })
})
