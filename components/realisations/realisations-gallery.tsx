'use client'

import { useState } from 'react'
import type { RealisationWithPhotos } from '@/lib/data/realisations'
import Lightbox from './lightbox'

interface RealisationsGalleryProps {
  realisations: RealisationWithPhotos[]
}

export default function RealisationsGallery({ realisations }: RealisationsGalleryProps): JSX.Element {
  const [selected, setSelected] = useState<RealisationWithPhotos | null>(null)

  return (
    <>
      <div className="mt-10 columns-1 gap-8 sm:columns-2 lg:columns-3">
        {realisations.map((realisation) => {
          const sortedPhotos = [...realisation.realisation_photos].sort(
            (a, b) => a.position - b.position
          )
          const coverPhoto = sortedPhotos[0]
          return (
            <article
              key={realisation.id}
              className="mb-8 flex cursor-pointer break-inside-avoid flex-col gap-3"
              role="button"
              tabIndex={0}
              onClick={() => setSelected({ ...realisation, realisation_photos: sortedPhotos })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setSelected({ ...realisation, realisation_photos: sortedPhotos })
                }
              }}
            >
              {coverPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverPhoto.url}
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

      {selected !== null && (
        <Lightbox
          realisation={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
