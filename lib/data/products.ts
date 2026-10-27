import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types/database.types'

type Product = Database['public']['Tables']['products']['Row']
type ProductPhoto = Database['public']['Tables']['product_photos']['Row']

export type ProductWithPhotos = Product & { product_photos: ProductPhoto[] }

type Category = NonNullable<Product['category']>

export async function getPublishedProducts(category?: Category): Promise<ProductWithPhotos[]> {
  const supabase = createClient()
  let query = supabase
    .from('products')
    .select('*, product_photos(*)')
    .eq('published', true)
  if (category) query = query.eq('category', category)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) console.error('[data:products] getPublishedProducts', error)
  return (data as ProductWithPhotos[] | null) ?? []
}

export async function getProductBySlug(slug: string): Promise<ProductWithPhotos | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*, product_photos(*)')
    .eq('slug', slug)
    .eq('published', true)
    .single()
  if (error) {
    if (error.code !== 'PGRST116') console.error('[data:products] getProductBySlug', error)
    return null
  }
  return data as ProductWithPhotos | null
}

export async function getFeaturedProducts(): Promise<ProductWithPhotos[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*, product_photos(*)')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(4)
  if (error) console.error('[data:products] getFeaturedProducts', error)
  return (data as ProductWithPhotos[] | null) ?? []
}
