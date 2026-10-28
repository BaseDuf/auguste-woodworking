import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const state = vi.hoisted(() => ({ result: { data: [] as unknown, error: null as unknown } }))
const adminState = vi.hoisted(() => ({ result: { data: [] as unknown, error: null as unknown } }))

vi.mock('@/lib/supabase/admin', () => {
  const chain: Record<string, unknown> = {}
  const self = () => chain
  Object.assign(chain, {
    select: self,
    eq: self,
    order: self,
    limit: self,
    single: () => Promise.resolve(adminState.result),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(adminState.result).then(resolve, reject),
  })
  return {
    createAdminClient: () => ({ from: () => chain }),
  }
})

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

import { getPublishedProducts, getProductBySlug, getAdminProducts, getAdminProductById } from '../products'

beforeEach(() => {
  state.result = { data: [], error: null }
  adminState.result = { data: [], error: null }
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

describe('getAdminProducts', () => {
  it('returns all products including unpublished', async () => {
    adminState.result = {
      data: [{ id: 'p1', name: 'Table', published: false, slug: 'table', price_cents: 10000, shipping_price_cents: 0, stock: 1, allow_preorder: false, category: null, created_at: '2026-10-28T00:00:00Z' }],
      error: null,
    }
    const result = await getAdminProducts()
    expect(result).toHaveLength(1)
    expect(result[0].published).toBe(false)
  })

  it('returns empty array when no products match category', async () => {
    adminState.result = { data: [], error: null }
    const result = await getAdminProducts('ameublement')
    expect(result).toEqual([])
  })
})

describe('getAdminProductById', () => {
  it('returns null when product not found (PGRST116)', async () => {
    adminState.result = { data: null, error: { code: 'PGRST116' } }
    const result = await getAdminProductById('unknown-id')
    expect(result).toBeNull()
  })

  it('sorts product_photos by position ascending', async () => {
    // Review Focus #4: photos arrive out-of-order from DB
    adminState.result = {
      data: { id: 'p1', name: 'Table', product_photos: [
        { id: 'ph2', position: 2, url: 'b.jpg' },
        { id: 'ph1', position: 0, url: 'a.jpg' },
        { id: 'ph3', position: 1, url: 'c.jpg' },
      ]},
      error: null,
    }
    const result = await getAdminProductById('p1')
    expect(result?.product_photos.map(p => p.position)).toEqual([0, 1, 2])
  })
})

describe('error handling', () => {
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleError.mockRestore()
  })

  it('getPublishedProducts logs error and returns [] on DB error', async () => {
    state.result = { data: null, error: { code: '42P01', message: 'relation not found' } }
    const result = await getPublishedProducts()
    expect(result).toEqual([])
    expect(consoleError).toHaveBeenCalled()
  })

  it('getProductBySlug does not log on PGRST116 (not found)', async () => {
    state.result = { data: null, error: { code: 'PGRST116' } }
    await getProductBySlug('slug')
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('getProductBySlug logs on non-PGRST116 error', async () => {
    state.result = { data: null, error: { code: '42P01', message: 'table missing' } }
    const result = await getProductBySlug('slug')
    expect(result).toBeNull()
    expect(consoleError).toHaveBeenCalled()
  })
})
