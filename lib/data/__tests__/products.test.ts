import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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
