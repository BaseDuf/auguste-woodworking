'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <h2 className="font-serif text-2xl text-stone-800 mb-3">Une erreur est survenue</h2>
      <p className="text-stone-500 text-sm mb-6 max-w-sm">
        Quelque chose s&apos;est mal passé. Veuillez réessayer ou revenir à l&apos;accueil.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors"
        >
          Réessayer
        </button>
        <a
          href="/"
          className="px-4 py-2 text-sm border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
        >
          Accueil
        </a>
      </div>
      {error.digest && (
        <p className="mt-4 text-xs text-stone-400">Code: {error.digest}</p>
      )}
    </div>
  )
}
