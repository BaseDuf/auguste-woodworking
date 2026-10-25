import { createClient } from '@/lib/supabase/client'

test('createClient is a function', () => {
  expect(typeof createClient).toBe('function')
})
