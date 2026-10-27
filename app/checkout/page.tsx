'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useCartContext } from '@/lib/cart/cart-context'
import { createPaymentIntent } from './actions'
import { OrderSummary } from './_components/order-summary'
import { StepCoordonnees, type Coordonnees } from './_components/step-coordonnees'
import { StepLivraison, type Adresse } from './_components/step-livraison'
import { StepPaiement } from './_components/step-paiement'

type Step = 1 | 2 | 3

export default function CheckoutPage() {
  const { items, subtotalCents, shippingCents, grandTotalCents, clearCart } = useCartContext()

  const [step, setStep] = useState<Step>(1)
  const [coordonnees, setCoordonnees] = useState<Coordonnees | null>(null)
  const [adresse, setAdresse] = useState<Adresse | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [piError, setPiError] = useState<string | null>(null)

  // Create Payment Intent when reaching step 3
  useEffect(() => {
    if (step !== 3 || !coordonnees || !adresse || clientSecret) return

    setLoading(true)
    setPiError(null)

    createPaymentIntent({
      coordonnees,
      adresse,
      items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
    }).then(result => {
      if (result.ok) {
        setClientSecret(result.clientSecret)
      } else {
        setPiError(result.error)
      }
      setLoading(false)
    })
  }, [step, coordonnees, adresse, clientSecret, items])

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-stone-600 text-lg">Votre panier est vide.</p>
          <Link
            href="/panier"
            className="inline-block bg-stone-900 text-white px-6 py-3 rounded-md font-medium hover:bg-stone-700 transition-colors"
          >
            Voir mon panier
          </Link>
        </div>
      </div>
    )
  }

  const stepLabels = ['Coordonnées', 'Livraison', 'Paiement']

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Step indicator */}
        <div className="flex items-center justify-center mb-8 gap-2">
          {stepLabels.map((label, i) => {
            const num = (i + 1) as Step
            const isActive = step === num
            const isDone = step > num
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors
                  ${isActive ? 'bg-stone-900 text-white' : isDone ? 'bg-stone-200 text-stone-700' : 'bg-stone-100 text-stone-400'}`}>
                  <span>{num}</span>
                  <span className="hidden sm:inline">{label}</span>
                </div>
                {i < 2 && <span className="text-stone-300">›</span>}
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-stone-200 p-6">
            {step === 1 && (
              <StepCoordonnees
                initialData={coordonnees}
                onNext={data => {
                  setCoordonnees(data)
                  setStep(2)
                }}
              />
            )}
            {step === 2 && (
              <StepLivraison
                initialData={adresse}
                onNext={data => {
                  setAdresse(data)
                  setStep(3)
                }}
                onBack={() => setStep(1)}
              />
            )}
            {step === 3 && (
              <div>
                {loading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-stone-500">Initialisation du paiement…</div>
                  </div>
                )}
                {piError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 text-sm mb-4">
                    {piError}
                  </div>
                )}
                {clientSecret && !loading && (
                  <StepPaiement
                    clientSecret={clientSecret}
                    onBack={() => {}}
                    onSuccess={clearCart}
                  />
                )}
              </div>
            )}
          </div>

          {/* Order summary */}
          <div className="lg:col-span-1">
            <OrderSummary
              items={items}
              subtotalCents={subtotalCents}
              shippingCents={shippingCents}
              grandTotalCents={grandTotalCents}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
