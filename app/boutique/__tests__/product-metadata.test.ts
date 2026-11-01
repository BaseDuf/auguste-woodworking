import { describe, it, expect, vi } from 'vitest'

const mockProduct = vi.hoisted(() => ({
  id: '1', slug: 'table-basse', name: 'Table basse', description: 'Une belle table.',
  price_cents: 45000, shipping_price_cents: 2000,
  product_photos: [{ id: 'p1', url: 'https://example.com/photo.jpg', position: 0 }],
}))

vi.mock('@/lib/data/products', () => ({
  getProductBySlug: vi.fn().mockResolvedValue(mockProduct),
}))
vi.mock('@/lib/seo/config', () => ({
  SITE_URL: 'https://auguste-woodworking.fr',
  SITE_NAME: 'Auguste Woodworking',
  DEFAULT_OG_IMAGE: 'https://auguste-woodworking.fr/og-default.jpg',
}))

import { generateMetadata } from '../[slug]/page'

describe('generateMetadata', () => {
  it('returns product title', async () => {
    const meta = await generateMetadata({ params: { slug: 'table-basse' } })
    expect(meta.title).toBe('Table basse')
  })

  it('uses product photo as OG image', async () => {
    const meta = await generateMetadata({ params: { slug: 'table-basse' } })
    const og = meta.openGraph as { images: { url: string }[] }
    expect(og.images[0].url).toBe('https://example.com/photo.jpg')
  })

  it('falls back to DEFAULT_OG_IMAGE when product has no photos', async () => {
    const { getProductBySlug } = await import('@/lib/data/products')
    vi.mocked(getProductBySlug).mockResolvedValueOnce({ ...mockProduct, product_photos: [] })
    const meta = await generateMetadata({ params: { slug: 'table-basse' } })
    const og = meta.openGraph as { images: { url: string }[] }
    expect(og.images[0].url).toBe('https://auguste-woodworking.fr/og-default.jpg')
  })

  it('falls back to default description when product has no description', async () => {
    const { getProductBySlug } = await import('@/lib/data/products')
    vi.mocked(getProductBySlug).mockResolvedValueOnce({ ...mockProduct, description: null })
    const meta = await generateMetadata({ params: { slug: 'table-basse' } })
    expect(meta.description).toBe('Objet en bois fait à la main par Auguste Woodworking.')
  })

  it('returns fallback title when product not found', async () => {
    const { getProductBySlug } = await import('@/lib/data/products')
    vi.mocked(getProductBySlug).mockResolvedValueOnce(null)
    const meta = await generateMetadata({ params: { slug: 'introuvable' } })
    expect(meta.title).toBe('Produit introuvable | Auguste Woodworking')
  })
})
