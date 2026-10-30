import { getRealisations } from '@/lib/data/realisations'
import RealisationsGallery from '@/components/realisations/realisations-gallery'

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
