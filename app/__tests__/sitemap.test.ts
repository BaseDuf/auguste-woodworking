import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/seo/config', () => ({ SITE_URL: 'https://auguste-woodworking.fr' }))
vi.mock('@/lib/data/products', () => ({
  getPublishedProducts: vi.fn().mockResolvedValue([
    { slug: 'table-basse', product_photos: [] },
    { slug: 'etagere', product_photos: [] },
  ]),
}))

import sitemap from '../sitemap'

describe('sitemap', () => {
  it('includes all four static routes', async () => {
    const entries = await sitemap()
    const urls = entries.map((e) => e.url)
    expect(urls).toContain('https://auguste-woodworking.fr')
    expect(urls).toContain('https://auguste-woodworking.fr/boutique')
    expect(urls).toContain('https://auguste-woodworking.fr/realisations')
    expect(urls).toContain('https://auguste-woodworking.fr/atelier')
  })

  it('includes published product slugs', async () => {
    const entries = await sitemap()
    const urls = entries.map((e) => e.url)
    expect(urls).toContain('https://auguste-woodworking.fr/boutique/table-basse')
    expect(urls).toContain('https://auguste-woodworking.fr/boutique/etagere')
  })

  it('does not include admin or legal routes', async () => {
    const entries = await sitemap()
    const urls = entries.map((e) => e.url)
    expect(urls.every((u) => !u.includes('/admin'))).toBe(true)
    expect(urls.every((u) => !u.includes('/cgv'))).toBe(true)
  })

  it('returns static routes only when getPublishedProducts throws', async () => {
    const { getPublishedProducts } = await import('@/lib/data/products')
    vi.mocked(getPublishedProducts).mockRejectedValueOnce(new Error('db error'))
    const entries = await sitemap()
    const urls = entries.map((e) => e.url)
    expect(urls).toContain('https://auguste-woodworking.fr')
    expect(urls.length).toBeGreaterThanOrEqual(4)
  })
})
