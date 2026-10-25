import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({ result: { data: [] as unknown, error: null as unknown } }))

vi.mock('@/lib/supabase/server', () => {
  const chain: Record<string, unknown> = {}
  const self = () => chain
  Object.assign(chain, {
    select: self,
    eq: self,
    order: self,
    limit: self,
    single: () => Promise.resolve(state.result),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(state.result).then(resolve, reject),
  })
  return {
    createClient: () => ({ from: () => chain }),
  }
})

import { getPublishedProducts, getProductBySlug } from '../products'

beforeEach(() => {
  state.result = { data: [], error: null }
})

describe('getPublishedProducts', () => {
  it('returns empty array when no products', async () => {
    const result = await getPublishedProducts()
    expect(result).toEqual([])
  })
})

describe('getProductBySlug', () => {
  it('returns null when product not found', async () => {
    state.result = { data: null, error: { code: 'PGRST116' } }
    const result = await getProductBySlug('unknown-slug')
    expect(result).toBeNull()
  })
})
