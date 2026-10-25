'use client'

import { useState } from 'react'

type CarouselPhoto = { url: string; position: number }

export default function PhotoCarousel({ photos }: { photos: CarouselPhoto[] }) {
  const [currentIndex, setCurrentIndex] = useState(0)

  if (photos.length === 0) {
    return (
      <div
        data-testid="photo-placeholder"
        className="flex aspect-square w-full items-center justify-center bg-stone-100 font-sans text-stone-400"
      >
        Pas de photo
      </div>
    )
  }

  const sorted = [...photos].sort((a, b) => a.position - b.position)
  const index = Math.min(currentIndex, sorted.length - 1)
  const current = sorted[index]
  const hasMany = sorted.length > 1

  const prev = () => setCurrentIndex((i) => (i - 1 + sorted.length) % sorted.length)
  const next = () => setCurrentIndex((i) => (i + 1) % sorted.length)

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square w-full overflow-hidden bg-stone-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.url} alt="" className="h-full w-full object-cover" />
        {hasMany && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Photo précédente"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded bg-stone-50/80 px-3 py-2 font-sans text-stone-800 transition hover:bg-stone-50"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Photo suivante"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-stone-50/80 px-3 py-2 font-sans text-stone-800 transition hover:bg-stone-50"
            >
              ›
            </button>
          </>
        )}
      </div>
      {hasMany && (
        <p className="text-center font-sans text-sm text-stone-500">
          {index + 1} / {sorted.length}
        </p>
      )}
    </div>
  )
}
