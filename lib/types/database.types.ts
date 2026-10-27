export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; role: 'admin' | 'customer'; created_at: string }
        Insert: { id: string; role?: 'admin' | 'customer' }
        Update: { role?: 'admin' | 'customer' }
        Relationships: []
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
        Relationships: []
      }
      product_photos: {
        Row: { id: string; product_id: string; url: string; position: number }
        Insert: Omit<Database['public']['Tables']['product_photos']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['product_photos']['Insert']>
        Relationships: [
          { foreignKeyName: 'product_photos_product_id_fkey'; columns: ['product_id']; referencedRelation: 'products'; referencedColumns: ['id'] }
        ]
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
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'id' | 'created_at' | 'customer_id'> & { id?: string; customer_id?: string | null }
        Update: Partial<Database['public']['Tables']['orders']['Insert']>
        Relationships: []
      }
      order_items: {
        Row: { id: string; order_id: string; product_id: string; quantity: number; unit_price_cents: number; shipping_price_cents: number }
        Insert: Omit<Database['public']['Tables']['order_items']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['order_items']['Insert']>
        Relationships: [
          { foreignKeyName: 'order_items_order_id_fkey'; columns: ['order_id']; referencedRelation: 'orders'; referencedColumns: ['id'] },
          { foreignKeyName: 'order_items_product_id_fkey'; columns: ['product_id']; referencedRelation: 'products'; referencedColumns: ['id'] }
        ]
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
        Relationships: [
          { foreignKeyName: 'shipping_addresses_order_id_fkey'; columns: ['order_id']; referencedRelation: 'orders'; referencedColumns: ['id'] }
        ]
      }
      realisations: {
        Row: { id: string; title: string; description: string | null; created_at: string }
        Insert: Omit<Database['public']['Tables']['realisations']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Database['public']['Tables']['realisations']['Insert']>
        Relationships: []
      }
      realisation_photos: {
        Row: { id: string; realisation_id: string; url: string; position: number }
        Insert: Omit<Database['public']['Tables']['realisation_photos']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['realisation_photos']['Insert']>
        Relationships: [
          { foreignKeyName: 'realisation_photos_realisation_id_fkey'; columns: ['realisation_id']; referencedRelation: 'realisations'; referencedColumns: ['id'] }
        ]
      }
    }
    Views: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
    Functions: {
      generate_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      decrement_product_stock: {
        Args: { p_product_id: string; p_qty: number }
        Returns: void
      }
    }
  }
}
