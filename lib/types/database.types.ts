export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; role: 'admin' | 'customer'; created_at: string }
        Insert: { id: string; role?: 'admin' | 'customer' }
        Update: { role?: 'admin' | 'customer' }
      }
      products: {
        Row: {
          id: string
          slug: string
          name: string
          description: string | null
          price_cents: number
          shipping_price_cents: number
          stock: number
          allow_preorder: boolean
          category: 'ameublement' | 'objet' | 'piece_limitee' | null
          published: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['products']['Insert']>
      }
      product_photos: {
        Row: { id: string; product_id: string; url: string; position: number }
        Insert: Omit<Database['public']['Tables']['product_photos']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['product_photos']['Insert']>
      }
      orders: {
        Row: {
          id: string
          order_number: string
          status: 'en_attente' | 'confirmee' | 'expediee' | 'livree' | 'echouee'
          email: string
          phone: string | null
          customer_id: string | null
          stripe_payment_intent_id: string | null
          total_cents: number
          shipping_cents: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['orders']['Insert']>
      }
      order_items: {
        Row: { id: string; order_id: string; product_id: string; quantity: number; unit_price_cents: number; shipping_price_cents: number }
        Insert: Omit<Database['public']['Tables']['order_items']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['order_items']['Insert']>
      }
      shipping_addresses: {
        Row: {
          id: string
          order_id: string
          first_name: string
          last_name: string
          line1: string
          line2: string | null
          city: string
          postal_code: string
          country: string
        }
        Insert: Omit<Database['public']['Tables']['shipping_addresses']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['shipping_addresses']['Insert']>
      }
      realisations: {
        Row: { id: string; title: string; description: string | null; created_at: string }
        Insert: Omit<Database['public']['Tables']['realisations']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['realisations']['Insert']>
      }
      realisation_photos: {
        Row: { id: string; realisation_id: string; url: string; position: number }
        Insert: Omit<Database['public']['Tables']['realisation_photos']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['realisation_photos']['Insert']>
      }
    }
  }
}
