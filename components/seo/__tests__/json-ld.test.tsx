import { render } from '@testing-library/react'
import { it, expect, vi } from 'vitest'
import { JsonLd } from '../json-ld'

it('renders a script tag with type application/ld+json containing the data', () => {
  const data = { '@context': 'https://schema.org', '@type': 'Organization', name: 'Test' }
  const { container } = render(<JsonLd data={data} />)
  const script = container.querySelector('script[type="application/ld+json"]')
  expect(script).not.toBeNull()
  expect(JSON.parse(script!.textContent!)).toEqual(data)
})

it('SITE_URL falls back to https://auguste-woodworking.fr when env var is absent', async () => {
  const original = process.env.NEXT_PUBLIC_SITE_URL
  delete process.env.NEXT_PUBLIC_SITE_URL
  try {
    // Vitest caches modules: reset the registry so config.ts is re-evaluated without the env var
    vi.resetModules()
    const { SITE_URL } = await import('../../../lib/seo/config')
    expect(SITE_URL).toBe('https://auguste-woodworking.fr')
  } finally {
    if (original !== undefined) process.env.NEXT_PUBLIC_SITE_URL = original
    vi.resetModules()
  }
})
