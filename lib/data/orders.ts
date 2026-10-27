import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/types/database.types'

type Order = Database['public']['Tables']['orders']['Row']
type OrderItem = Database['public']['Tables']['order_items']['Row']
type Product = Database['public']['Tables']['products']['Row']
type ShippingAddress = Database['public']['Tables']['shipping_addresses']['Row']

export type OrderWithItems = Order & {
  order_items: (OrderItem & { products: Pick<Product, 'name'> })[]
  shipping_addresses: ShippingAddress[]
}

export type AdminOrder = Pick<
  Order,
  'id' | 'order_number' | 'email' | 'status' | 'total_cents' | 'shipping_cents' | 'created_at'
>

export type AdminOrderWithItems = Order & {
  order_items: (OrderItem & { products: Pick<Product, 'name'> })[]
  shipping_addresses: ShippingAddress[]
}

export async function getOrderByPaymentIntentId(piId: string): Promise<OrderWithItems | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*, products(name)), shipping_addresses(*)')
    .eq('stripe_payment_intent_id', piId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('[orders] Error fetching order by payment intent id', error)
    return null
  }

  return data as OrderWithItems
}

export async function getOrders(status?: string): Promise<AdminOrder[]> {
  const supabase = createAdminClient()

  const base = supabase
    .from('orders')
    .select('id, order_number, email, status, total_cents, shipping_cents, created_at')
    .order('created_at', { ascending: false })

  const { data, error } = status
    ? await base.eq('status', status as Order['status'])
    : await base

  if (error) {
    console.error('[orders] Error fetching orders', error)
    return []
  }

  return (data ?? []) as AdminOrder[]
}

export async function getOrderById(id: string): Promise<AdminOrderWithItems | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*, products(name)), shipping_addresses(*)')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('[orders] Error fetching order by id', error)
    return null
  }

  return data as AdminOrderWithItems
}
