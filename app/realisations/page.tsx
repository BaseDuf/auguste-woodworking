import type { Metadata } from 'next'
import { getRealisations } from '@/lib/data/realisations'
import RealisationsGallery from '@/components/realisations/realisations-gallery'
import { SITE_URL, DEFAULT_OG_IMAGE, BASE_OPEN_GRAPH } from '@/lib/seo/config'

const realisationsTitle = 'Réalisations | Auguste Woodworking'
const realisationsDescription = 'Aménagements intérieurs, mobilier sur mesure — nos chantiers réalisés.'

export const metadata: Metadata = {
  title: 'Réalisations',
  description: realisationsDescription,
  openGraph: {
    ...BASE_OPEN_GRAPH,
    title: realisationsTitle,
    description: realisationsDescription,
    url: `${SITE_URL}/realisations`,
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: realisationsTitle,
    description: realisationsDescription,
    images: [DEFAULT_OG_IMAGE],
  },
  alternates: { canonical: `${SITE_URL}/realisations` },
}

export default async function RealisationsPage() {
  const realisations = await getRealisations()
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="font-serif text-4xl text-stone-800">Réalisations</h1>
      {realisations.length === 0 ? (
        <p className="mt-16 text-center font-sans text-stone-600">Bientôt disponible.</p>
      ) : (
        <RealisationsGallery realisations={realisations} />
      )}
    </div>
  )
}
