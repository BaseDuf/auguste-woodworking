import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types/database.types'

type Order = Database['public']['Tables']['orders']['Row']
type OrderItem = Database['public']['Tables']['order_items']['Row']
type Product = Database['public']['Tables']['products']['Row']
type ShippingAddress = Database['public']['Tables']['shipping_addresses']['Row']

export type OrderWithItems = Order & {
  order_items: (OrderItem & { products: Pick<Product, 'name'> })[]
  shipping_addresses: ShippingAddress[]
}

export async function getOrderByPaymentIntentId(piId: string): Promise<OrderWithItems | null> {
  const supabase = createClient()

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
