'use client'

import { useEffect, useState } from 'react'
import type { RealisationWithPhotos } from '@/lib/data/realisations'

interface LightboxProps {
  realisation: RealisationWithPhotos
  onClose: () => void
}

export default function Lightbox({ realisation, onClose }: LightboxProps): JSX.Element | null {
  const photos = realisation.realisation_photos
  const [index, setIndex] = useState(0)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)

  useEffect(() => {
    if (photos.length === 0) {
      onClose()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (photos.length === 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowRight') {
        setIndex((prev) => Math.min(prev + 1, photos.length - 1))
      } else if (e.key === 'ArrowLeft') {
        setIndex((prev) => Math.max(prev - 1, 0))
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [photos.length, onClose])

  if (photos.length === 0) return null

  const currentPhoto = photos[index]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
      onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStartX === null) return
        const diff = e.changedTouches[0].clientX - touchStartX
        if (diff < -50) {
          setIndex((prev) => Math.min(prev + 1, photos.length - 1))
        } else if (diff > 50) {
          setIndex((prev) => Math.max(prev - 1, 0))
        }
        setTouchStartX(null)
      }}
    >
      <button
        className="absolute right-4 top-4 text-white text-3xl leading-none"
        onClick={onClose}
        aria-label="Fermer"
      >
        ×
      </button>

      <div
        className="relative flex flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentPhoto.url}
          alt={realisation.title}
          className="max-h-[90vh] max-w-[90vw] object-contain"
        />

        <span role="status" className="text-white text-sm">
          {index + 1} / {photos.length}
        </span>

        {photos.length > 1 && (
          <div className="absolute inset-y-0 flex w-full items-center justify-between px-2">
            {index > 0 ? (
              <button
                className="text-white text-4xl leading-none"
                onClick={() => setIndex((prev) => Math.max(prev - 1, 0))}
                aria-label="Photo précédente"
              >
                ‹
              </button>
            ) : (
              <span />
            )}
            {index < photos.length - 1 ? (
              <button
                className="text-white text-4xl leading-none"
                onClick={() => setIndex((prev) => Math.min(prev + 1, photos.length - 1))}
                aria-label="Photo suivante"
              >
                ›
              </button>
            ) : (
              <span />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
