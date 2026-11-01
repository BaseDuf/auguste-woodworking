import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({
  result: { data: null as unknown, error: null as unknown },
  gteValues: [] as string[],
  lteValues: [] as string[],
}))

vi.mock('@/lib/supabase/admin', () => {
  const makeChain = () => {
    const chain: Record<string, unknown> = {}
    Object.assign(chain, {
      select: () => chain,
      gte: (_col: string, val: string) => { state.gteValues.push(val); return chain },
      lte: (_col: string, val: string) => { state.lteValues.push(val); return chain },
      neq: () => chain,
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(state.result).then(resolve, reject),
    })
    return chain
  }
  return { createAdminClient: () => ({ from: () => makeChain() }) }
})

import { getOrderStats, getOrdersByStatus, getRevenueTimeSeries } from '../analytics'

beforeEach(() => {
  state.result = { data: null, error: null }
  state.gteValues = []
  state.lteValues = []
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

  it('calcule correctement les bornes de la période précédente', async () => {
    state.result = { data: [], error: null }
    const from = new Date('2026-10-01T00:00:00.000Z')
    const to = new Date('2026-10-31T23:59:59.999Z')
    const duration = to.getTime() - from.getTime()
    const expectedPrevFrom = new Date(from.getTime() - duration)
    const expectedPrevTo = new Date(from.getTime() - 1)
    await getOrderStats(from, to)
    // Both parallel queries push their gte/lte values; prev period bounds must be present
    expect(state.gteValues).toContain(expectedPrevFrom.toISOString())
    expect(state.lteValues).toContain(expectedPrevTo.toISOString())
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

  it('couvre la semaine courante avec granularité week (from mi-semaine)', async () => {
    // from = mercredi 2026-10-14 (W42), to = mercredi 2026-11-04 (W45)
    // Le fill doit inclure W42, W43, W44, W45 même si from n'est pas un lundi
    state.result = {
      data: [{ created_at: '2026-11-04T10:00:00Z', total_cents: 1000 }],
      error: null,
    }
    const from = new Date('2026-10-14T00:00:00Z') // mercredi
    const to = new Date('2026-11-04T00:00:00Z')   // mercredi, W45
    const result = await getRevenueTimeSeries(from, to, 'week')
    const keys = result.map(p => p.date)
    expect(keys[0]).toBe('2026-W42')
    expect(keys.at(-1)).toBe('2026-W45')
    expect(keys).toHaveLength(4)
    const w45 = result.find(p => p.date === '2026-W45')
    expect(w45?.totalCents).toBe(1000)
  })

  it('ne saute pas de mois avec granularité month (from au 31)', async () => {
    // from = 31 jan → sans snap, setUTCMonth(1) donne "fév 31" = 3 mars → février manque
    state.result = { data: [], error: null }
    const from = new Date('2026-01-31T00:00:00Z')
    const to = new Date('2026-04-01T00:00:00Z')
    const result = await getRevenueTimeSeries(from, to, 'month')
    const keys = result.map(p => p.date)
    expect(keys).toContain('2026-01')
    expect(keys).toContain('2026-02')
    expect(keys).toContain('2026-03')
    expect(keys).toContain('2026-04')
    expect(keys).toHaveLength(4)
  })
})
