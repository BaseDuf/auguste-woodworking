'use client'

import { useState } from 'react'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { getStripe } from '@/lib/stripe/client'

type Props = {
  clientSecret: string
  onBack: () => void
  onSuccess: () => void
}

function PaymentForm({ onBack }: { onBack: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setError(null)

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + '/commande/confirmation',
      },
    })

    if (stripeError) {
      setError(stripeError.message ?? 'Une erreur est survenue lors du paiement.')
      setLoading(false)
    }
    // On success, Stripe redirects — no need to call onSuccess here
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-xl font-semibold text-stone-900">Paiement</h2>

      <PaymentElement />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled
          className="flex-1 border border-stone-300 text-stone-400 py-3 rounded-md font-medium cursor-not-allowed opacity-50"
          title="Le paiement a déjà été initialisé"
        >
          Retour
        </button>
        <button
          type="submit"
          disabled={!stripe || loading}
          className="flex-1 bg-stone-900 text-white py-3 rounded-md font-medium hover:bg-stone-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Traitement…' : 'Payer'}
        </button>
      </div>
    </form>
  )
}

export function StepPaiement({ clientSecret, onBack, onSuccess }: Props) {
  return (
    <Elements
      stripe={getStripe()}
      options={{ clientSecret }}
    >
      <PaymentForm onBack={onBack} />
    </Elements>
  )
}
