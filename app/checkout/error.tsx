'use client'

import { useEffect } from 'react'

export default function CheckoutError({
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
      <h2 className="font-serif text-2xl text-stone-800 mb-3">Erreur lors du paiement</h2>
      <p className="text-stone-500 text-sm mb-2 max-w-sm">
        Une erreur est survenue pendant le processus de paiement. Votre commande n&apos;a pas été passée.
      </p>
      <p className="text-stone-400 text-xs mb-6 max-w-sm">
        Si vous avez été débité, contactez-nous — nous résoudrons le problème rapidement.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors"
        >
          Réessayer
        </button>
        <a
          href="/panier"
          className="px-4 py-2 text-sm border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
        >
          Retour au panier
        </a>
      </div>
      {error.digest && (
        <p className="mt-4 text-xs text-stone-400">Code: {error.digest}</p>
      )}
    </div>
  )
}
