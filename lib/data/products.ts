import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/types/database.types'

type Product = Database['public']['Tables']['products']['Row']
type ProductPhoto = Database['public']['Tables']['product_photos']['Row']

export type ProductWithPhotos = Product & { product_photos: ProductPhoto[] }

export type AdminProduct = Pick<Product, 'id' | 'slug' | 'name' | 'price_cents' | 'shipping_price_cents' | 'stock' | 'allow_preorder' | 'category' | 'published' | 'created_at'>
export type AdminProductWithPhotos = Product & { product_photos: ProductPhoto[] }

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

export async function getAdminProducts(category?: Category): Promise<AdminProduct[]> {
  const supabase = createAdminClient()
  let query = supabase
    .from('products')
    .select('id, slug, name, price_cents, shipping_price_cents, stock, allow_preorder, category, published, created_at')
  if (category) query = query.eq('category', category)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) console.error('[data:products] getAdminProducts', error)
  return (data as AdminProduct[] | null) ?? []
}

export async function getAdminProductById(id: string): Promise<AdminProductWithPhotos | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('products')
    .select('*, product_photos(*)')
    .eq('id', id)
    .single()
  if (error) {
    if (error.code !== 'PGRST116') console.error('[data:products] getAdminProductById', error)
    return null
  }
  if (!data) return null
  const product = data as AdminProductWithPhotos
  return {
    ...product,
    product_photos: [...product.product_photos].sort((a, b) => a.position - b.position),
  }
}
