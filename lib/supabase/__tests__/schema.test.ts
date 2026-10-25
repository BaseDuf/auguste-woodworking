import type { Database } from '@/lib/types/database.types'

type Product = Database['public']['Tables']['products']['Row']
type Order = Database['public']['Tables']['orders']['Row']
type OrderItem = Database['public']['Tables']['order_items']['Row']

test('Product has required money columns as numbers', () => {
  const p: Partial<Product> = { price_cents: 5000, shipping_price_cents: 900 }
  expect(typeof p.price_cents).toBe('number')
  expect(typeof p.shipping_price_cents).toBe('number')
})

test('Order has order_number field', () => {
  const o: Partial<Order> = { order_number: 'AW-2026-00001' }
  expect(o.order_number).toMatch(/^AW-\d{4}-\d{5}$/)
})

test('OrderItem references both order and product', () => {
  const i: Partial<OrderItem> = { order_id: 'uuid', product_id: 'uuid', quantity: 1, unit_price_cents: 5000 }
  expect(i.order_id).toBeDefined()
  expect(i.product_id).toBeDefined()
})
