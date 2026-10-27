import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({
  // Résultat de la branche `.single()` (getOrderByPaymentIntentId, getOrderById)
  result: { data: null as unknown, error: null as unknown },
  // Résultat de la branche liste (getOrders : chaîne awaitée directement)
  listResult: { data: null as unknown, error: null as unknown },
  eq: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => {
  const chain: Record<string, unknown> = {}
  const self = () => chain
  Object.assign(chain, {
    select: self,
    order: self,
    eq: (...args: unknown[]) => {
      state.eq(...args)
      return chain
    },
    single: () => Promise.resolve(state.result),
    // Thenable : permet `await supabase.from('orders').select(...).order(...)`
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(state.listResult).then(resolve, reject),
  })
  return { createAdminClient: () => ({ from: () => chain }) }
})

import { getOrderByPaymentIntentId, getOrders, getOrderById } from '../orders'

beforeEach(() => {
  state.eq.mockClear()
  state.result = { data: null, error: null }
  state.listResult = { data: null, error: null }
})

describe('getOrderByPaymentIntentId', () => {
  it('returns null when order not found', async () => {
    state.result = { data: null, error: { code: 'PGRST116' } }
    const result = await getOrderByPaymentIntentId('pi_test')
    expect(result).toBeNull()
  })
})

describe('getOrders', () => {
  it('getOrders returns all orders when no status filter', async () => {
    const rows = [{ id: '1', status: 'confirmee' }]
    state.listResult = { data: rows, error: null }
    const result = await getOrders()
    expect(result).toEqual(rows)
    expect(state.eq).not.toHaveBeenCalled()
  })

  it('getOrders filters by status when provided', async () => {
    state.listResult = { data: [], error: null }
    await getOrders('expediee')
    expect(state.eq).toHaveBeenCalledWith('status', 'expediee')
  })

  it('getOrders returns empty array on error', async () => {
    state.listResult = { data: null, error: { message: 'db error' } }
    const result = await getOrders()
    expect(result).toEqual([])
  })
})

describe('getOrderById', () => {
  it('getOrderById returns order when found', async () => {
    state.result = { data: { id: 'abc', order_number: 'CMD-001' }, error: null }
    const result = await getOrderById('abc')
    expect(result).not.toBeNull()
    expect(state.eq).toHaveBeenCalledWith('id', 'abc')
  })

  it('getOrderById returns null when not found (PGRST116)', async () => {
    state.result = { data: null, error: { code: 'PGRST116' } }
    const result = await getOrderById('missing')
    expect(result).toBeNull()
  })

  it('getOrderById returns null on generic error', async () => {
    state.result = { data: null, error: { message: 'fail' } }
    const result = await getOrderById('abc')
    expect(result).toBeNull()
  })
})
