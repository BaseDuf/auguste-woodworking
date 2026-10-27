'use client'

import { useState } from 'react'

export type Adresse = {
  line1: string
  line2?: string
  city: string
  postalCode: string
  country: string
}

type Props = {
  onNext: (data: Adresse) => void
  onBack: () => void
  initialData?: Adresse | null
}

export function StepLivraison({ onNext, onBack, initialData }: Props) {
  const [line1, setLine1] = useState(initialData?.line1 ?? '')
  const [line2, setLine2] = useState(initialData?.line2 ?? '')
  const [city, setCity] = useState(initialData?.city ?? '')
  const [postalCode, setPostalCode] = useState(initialData?.postalCode ?? '')
  const [country, setCountry] = useState(initialData?.country ?? 'FR')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onNext({
      line1,
      ...(line2 ? { line2 } : {}),
      city,
      postalCode,
      country,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-semibold text-stone-900">Adresse de livraison</h2>

      <div>
        <label htmlFor="line1" className="block text-sm font-medium text-stone-700 mb-1">
          Adresse <span className="text-red-500">*</span>
        </label>
        <input
          id="line1"
          type="text"
          required
          value={line1}
          onChange={e => setLine1(e.target.value)}
          placeholder="Numéro et nom de voie"
          className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-500"
        />
      </div>

      <div>
        <label htmlFor="line2" className="block text-sm font-medium text-stone-700 mb-1">
          Complément d&apos;adresse
        </label>
        <input
          id="line2"
          type="text"
          value={line2}
          onChange={e => setLine2(e.target.value)}
          placeholder="Appartement, bâtiment, etc."
          className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="postalCode" className="block text-sm font-medium text-stone-700 mb-1">
            Code postal <span className="text-red-500">*</span>
          </label>
          <input
            id="postalCode"
            type="text"
            required
            value={postalCode}
            onChange={e => setPostalCode(e.target.value)}
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-500"
          />
        </div>
        <div>
          <label htmlFor="city" className="block text-sm font-medium text-stone-700 mb-1">
            Ville <span className="text-red-500">*</span>
          </label>
          <input
            id="city"
            type="text"
            required
            value={city}
            onChange={e => setCity(e.target.value)}
            className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-500"
          />
        </div>
      </div>

      <div>
        <label htmlFor="country" className="block text-sm font-medium text-stone-700 mb-1">
          Pays <span className="text-red-500">*</span>
        </label>
        <select
          id="country"
          required
          value={country}
          onChange={e => setCountry(e.target.value)}
          className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-500"
        >
          <option value="FR">France</option>
          <option value="BE">Belgique</option>
          <option value="CH">Suisse</option>
          <option value="LU">Luxembourg</option>
        </select>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 border border-stone-300 text-stone-700 py-3 rounded-md font-medium hover:bg-stone-50 transition-colors"
        >
          Retour
        </button>
        <button
          type="submit"
          className="flex-1 bg-stone-900 text-white py-3 rounded-md font-medium hover:bg-stone-700 transition-colors"
        >
          Continuer
        </button>
      </div>
    </form>
  )
}
