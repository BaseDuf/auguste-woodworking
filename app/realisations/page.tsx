import { getRealisations } from '@/lib/data/realisations'

export default async function RealisationsPage() {
  const realisations = await getRealisations()

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="font-serif text-4xl text-stone-800">Réalisations</h1>

      {realisations.length === 0 ? (
        <p className="mt-16 text-center font-sans text-stone-600">Bientôt disponible.</p>
      ) : (
        <div className="mt-10 columns-1 gap-8 sm:columns-2 lg:columns-3">
          {realisations.map((realisation) => {
            const photo = realisation.realisation_photos[0]
            return (
              <article
                key={realisation.id}
                className="mb-8 flex break-inside-avoid flex-col gap-3"
              >
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.url}
                    alt={realisation.title}
                    className="w-full object-cover"
                  />
                ) : (
                  <div className="aspect-[4/3] w-full bg-stone-200" aria-hidden="true" />
                )}
                <h2 className="font-serif text-xl text-stone-800">{realisation.title}</h2>
                {realisation.description && (
                  <p className="font-sans text-stone-600">{realisation.description}</p>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
