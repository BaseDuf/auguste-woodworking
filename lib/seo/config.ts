export const SITE_URL: string =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://auguste-woodworking.fr'

export const SITE_NAME: string = 'Auguste Woodworking'

export const SITE_DESCRIPTION: string =
  'Objets en bois faits à la main par un menuisier artisan en Allier.'

export const DEFAULT_OG_IMAGE: string = `${SITE_URL}/og-default.jpg`

export const BASE_OPEN_GRAPH = {
  siteName: SITE_NAME,
  locale: 'fr_FR' as const,
  type: 'website' as const,
} satisfies import('next').Metadata['openGraph']
