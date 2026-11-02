'use client'

import { useEffect } from 'react'

export default function AdminError({
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
    <div className="p-6">
      <div className="max-w-md">
        <h2 className="text-xl font-semibold text-stone-900 mb-2">Erreur dans le panneau admin</h2>
        <p className="text-stone-500 text-sm mb-4">
          {error.message || 'Une erreur inattendue est survenue.'}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors"
        >
          Réessayer
        </button>
        {error.digest && (
          <p className="mt-3 text-xs text-stone-400">Code: {error.digest}</p>
        )}
      </div>
    </div>
  )
}
