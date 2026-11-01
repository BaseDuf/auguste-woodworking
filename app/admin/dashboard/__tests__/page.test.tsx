import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// jsdom does not implement ResizeObserver (used by recharts)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/admin/dashboard',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/data/analytics', () => ({
  getOrderStats: vi.fn().mockResolvedValue({
    totalCents: 15000,
    count: 3,
    avgCents: 5000,
    prevTotalCents: 10000,
    prevCount: 2,
  }),
  getOrdersByStatus: vi.fn().mockResolvedValue({
    en_attente: 1, confirmee: 2, expediee: 0, livree: 0, echouee: 0,
  }),
  getRevenueTimeSeries: vi.fn().mockResolvedValue([
    { date: '2026-10-01', totalCents: 5000 },
  ]),
}))

import DashboardPage from '../page'

describe('DashboardPage', () => {
  it('rend les 3 KPI cards avec les bonnes valeurs', async () => {
    const jsx = await DashboardPage({ searchParams: { period: '30d' } })
    render(jsx)
    expect(screen.getByText('Chiffre d\'affaires')).toBeInTheDocument()
    expect(screen.getByText('Commandes')).toBeInTheDocument()
    expect(screen.getByText('Panier moyen')).toBeInTheDocument()
  })

  it('utilise 30d par défaut si period invalide', async () => {
    const { getOrderStats } = await import('@/lib/data/analytics')
    await DashboardPage({ searchParams: { period: 'xyz' } })
    expect(getOrderStats).toHaveBeenCalled()
    const [from, to] = vi.mocked(getOrderStats).mock.calls.at(-1)!
    const diffDays = Math.round((to.getTime() - from.getTime()) / 86400000)
    expect(diffDays).toBe(30)
  })
})
