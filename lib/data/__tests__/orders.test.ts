import { describe, it, expect, vi } from 'vitest'

const state = vi.hoisted(() => ({ result: { data: null as unknown, error: null as unknown } }))

vi.mock('@/lib/supabase/server', () => {
  const chain: Record<string, unknown> = {}
  const self = () => chain
  Object.assign(chain, {
    select: self, eq: self, single: () => Promise.resolve(state.result),
  })
  return { createClient: () => ({ from: () => chain }) }
})

import { getOrderByPaymentIntentId } from '../orders'

it('returns null when order not found', async () => {
  state.result = { data: null, error: { code: 'PGRST116' } }
  const result = await getOrderByPaymentIntentId('pi_test')
  expect(result).toBeNull()
})
