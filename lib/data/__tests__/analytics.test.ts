import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({
  result: { data: null as unknown, error: null as unknown },
}))

vi.mock('@/lib/supabase/admin', () => {
  const chain: Record<string, unknown> = {}
  const self = () => chain
  Object.assign(chain, {
    select: self,
    gte: self,
    lte: self,
    neq: self,
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(state.result).then(resolve, reject),
  })
  return { createAdminClient: () => ({ from: () => chain }) }
})

import { getOrderStats, getOrdersByStatus, getRevenueTimeSeries } from '../analytics'

beforeEach(() => {
  state.result = { data: null, error: null }
})

describe('getOrderStats', () => {
  it('retourne CA et count corrects', async () => {
    state.result = {
      data: [
        { total_cents: 5000 },
        { total_cents: 3000 },
      ],
      error: null,
    }
    const from = new Date('2026-10-01')
    const to = new Date('2026-10-31')
    const result = await getOrderStats(from, to)
    expect(result.totalCents).toBe(8000)
    expect(result.count).toBe(2)
    expect(result.avgCents).toBe(4000)
  })

  it('retourne zéros si aucune commande sur la période', async () => {
    state.result = { data: [], error: null }
    const result = await getOrderStats(new Date('2026-10-01'), new Date('2026-10-31'))
    expect(result.totalCents).toBe(0)
    expect(result.count).toBe(0)
    expect(result.avgCents).toBe(0)
  })

  it('calcule correctement la période précédente', async () => {
    // Période : oct (31 jours) → prév : sept
    state.result = { data: [], error: null }
    const from = new Date('2026-10-01T00:00:00.000Z')
    const to = new Date('2026-10-31T23:59:59.999Z')
    const result = await getOrderStats(from, to)
    expect(result.prevTotalCents).toBe(0)
    expect(result.prevCount).toBe(0)
  })
})

describe('getOrdersByStatus', () => {
  it('retourne toutes les clés présentes avec valeurs correctes', async () => {
    state.result = {
      data: [
        { status: 'confirmee' },
        { status: 'confirmee' },
        { status: 'expediee' },
      ],
      error: null,
    }
    const result = await getOrdersByStatus()
    expect(result.confirmee).toBe(2)
    expect(result.expediee).toBe(1)
    expect(result.en_attente).toBe(0)
    expect(result.livree).toBe(0)
    expect(result.echouee).toBe(0)
  })
})

describe('getRevenueTimeSeries', () => {
  it('retourne les points triés par date avec granularité day', async () => {
    state.result = {
      data: [
        { created_at: '2026-10-03T10:00:00Z', total_cents: 1000 },
        { created_at: '2026-10-01T08:00:00Z', total_cents: 2000 },
        { created_at: '2026-10-03T14:00:00Z', total_cents: 500 },
      ],
      error: null,
    }
    const from = new Date('2026-10-01')
    const to = new Date('2026-10-03')
    const result = await getRevenueTimeSeries(from, to, 'day')
    expect(result[0].date).toBe('2026-10-01')
    expect(result[0].totalCents).toBe(2000)
    expect(result[2].date).toBe('2026-10-03')
    expect(result[2].totalCents).toBe(1500)
  })

  it('remplit les jours sans commandes avec 0', async () => {
    state.result = {
      data: [{ created_at: '2026-10-01T10:00:00Z', total_cents: 1000 }],
      error: null,
    }
    const from = new Date('2026-10-01')
    const to = new Date('2026-10-03')
    const result = await getRevenueTimeSeries(from, to, 'day')
    expect(result).toHaveLength(3)
    expect(result[1].totalCents).toBe(0) // 2026-10-02
    expect(result[2].totalCents).toBe(0) // 2026-10-03
  })
})
