import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo/config'
import { getPublishedProducts } from '@/lib/data/products'

const staticRoutes: MetadataRoute.Sitemap = [
  { url: SITE_URL, priority: 1.0, changeFrequency: 'weekly' as const },
  { url: `${SITE_URL}/boutique`, priority: 0.9, changeFrequency: 'weekly' as const },
  { url: `${SITE_URL}/realisations`, priority: 0.8, changeFrequency: 'monthly' as const },
  { url: `${SITE_URL}/atelier`, priority: 0.7, changeFrequency: 'monthly' as const },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let products: Awaited<ReturnType<typeof getPublishedProducts>>
  try {
    products = await getPublishedProducts()
  } catch (error) {
    console.error('[sitemap] getPublishedProducts', error)
    return staticRoutes
  }

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${SITE_URL}/boutique/${product.slug}`,
    priority: 0.8,
    changeFrequency: 'weekly' as const,
  }))

  return [...staticRoutes, ...productRoutes]
}
